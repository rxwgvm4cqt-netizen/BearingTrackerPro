import { useEffect, useRef, useState } from 'react'
import { PSM, createWorker } from 'tesseract.js'
import {
  getRpmCandidatesFromText,
  getStableRpmValue,
  parseRpmFromText,
} from '../utils/ocrRpm'

const CAMERA_STATUS = {
  BLOCKED: 'blocked',
  ERROR: 'error',
  LIVE: 'live',
  MOCK: 'mock',
}

const OCR_INTERVAL_MS = 1800
const OCR_OUTPUT_WIDTH = 520
const OCR_ROI = {
  height: 0.32,
  left: 0.18,
  top: 0.34,
  width: 0.64,
}
const OCR_WHITELIST = '0123456789.,RPM rpm'

const OCR_STATUS = {
  ERROR: 'error',
  OFF: 'off',
  RECOGNIZED: 'recognized',
  RUNNING: 'running',
}

export function captureFrameForOCR(videoElement, canvasElement, t) {
  if (!videoElement || !canvasElement) {
    throw new Error(t('ocrSourceMissing'))
  }

  const sourceVideoWidth = videoElement.videoWidth
  const sourceVideoHeight = videoElement.videoHeight
  const previewWidth = videoElement.clientWidth
  const previewHeight = videoElement.clientHeight

  if (!sourceVideoWidth || !sourceVideoHeight || !previewWidth || !previewHeight) {
    throw new Error(t('ocrSourceNotReady'))
  }

  const coverScale = Math.max(
    previewWidth / sourceVideoWidth,
    previewHeight / sourceVideoHeight,
  )
  const renderedVideoWidth = sourceVideoWidth * coverScale
  const renderedVideoHeight = sourceVideoHeight * coverScale
  const hiddenVideoX = (renderedVideoWidth - previewWidth) / 2
  const hiddenVideoY = (renderedVideoHeight - previewHeight) / 2
  const roiPreviewX = OCR_ROI.left * previewWidth
  const roiPreviewY = OCR_ROI.top * previewHeight
  const roiPreviewWidth = OCR_ROI.width * previewWidth
  const roiPreviewHeight = OCR_ROI.height * previewHeight
  const sourceX = Math.max(0, (roiPreviewX + hiddenVideoX) / coverScale)
  const sourceY = Math.max(0, (roiPreviewY + hiddenVideoY) / coverScale)
  const sourceWidth = Math.min(
    sourceVideoWidth - sourceX,
    roiPreviewWidth / coverScale,
  )
  const sourceHeight = Math.min(
    sourceVideoHeight - sourceY,
    roiPreviewHeight / coverScale,
  )

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error(t('ocrZoneOutside'))
  }

  const outputScale = OCR_OUTPUT_WIDTH / sourceWidth
  const outputWidth = Math.round(sourceWidth * outputScale)
  const outputHeight = Math.round(sourceHeight * outputScale)

  canvasElement.width = outputWidth
  canvasElement.height = outputHeight

  const context = canvasElement.getContext('2d', { willReadFrequently: true })
  context.drawImage(
    videoElement,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  )

  const imageData = context.getImageData(0, 0, outputWidth, outputHeight)
  const pixels = imageData.data

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance =
      pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114
    const contrasted = (luminance - 128) * 1.7 + 128
    const threshold = contrasted > 150 ? 255 : 0

    pixels[index] = threshold
    pixels[index + 1] = threshold
    pixels[index + 2] = threshold
  }

  context.putImageData(imageData, 0, 0)

  return canvasElement
}

function getDeviceLabel(device, index, t) {
  return device.label || `${t('cameraSelect')} ${index + 1}`
}

function getPreferredDeviceId(devices) {
  const externalDevice = devices.find((device) =>
    /usb|external|uvc/i.test(device.label),
  )

  if (externalDevice) {
    return externalDevice.deviceId
  }

  const rearDevice = devices.find((device) =>
    /back|rear|environment|hinten|rueck|rück/i.test(device.label),
  )

  return rearDevice?.deviceId || devices[0]?.deviceId || ''
}

function getVideoConstraints(deviceId) {
  if (deviceId) {
    return {
      deviceId: { exact: deviceId },
      height: { ideal: 720 },
      width: { ideal: 1280 },
    }
  }

  return {
    facingMode: { ideal: 'environment' },
    height: { ideal: 720 },
    width: { ideal: 1280 },
  }
}

function CameraRPMPanel({ onOcrStop, onStableRpm, rpm, t }) {
  const videoRef = useRef(null)
  const ocrCanvasRef = useRef(null)
  const ocrActiveRef = useRef(false)
  const ocrJobRunningRef = useRef(false)
  const ocrSamplesRef = useRef([])
  const ocrTimerRef = useRef(null)
  const ocrWorkerRef = useRef(null)
  const stableOcrRpmRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraStatus, setCameraStatus] = useState(CAMERA_STATUS.MOCK)
  const [cameraError, setCameraError] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [deviceListMessage, setDeviceListMessage] = useState('')
  const [deviceListScanned, setDeviceListScanned] = useState(false)
  const [ocrCandidates, setOcrCandidates] = useState([])
  const [ocrError, setOcrError] = useState('')
  const [ocrDurationMs, setOcrDurationMs] = useState(null)
  const [ocrRawText, setOcrRawText] = useState('')
  const [ocrRpm, setOcrRpm] = useState(null)
  const [stableOcrRpm, setStableOcrRpm] = useState(null)
  const [ocrStatus, setOcrStatus] = useState(OCR_STATUS.OFF)
  const [ocrPlausibility, setOcrPlausibility] = useState(t('ocrOff'))
  const [videoDevices, setVideoDevices] = useState([])

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const attachStream = async (stream) => {
    streamRef.current = stream

    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }
  }

  const collectVideoDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoInputs = devices.filter((device) => device.kind === 'videoinput')
    setVideoDevices(videoInputs)
    setDeviceListScanned(true)
    setDeviceListMessage(
      videoInputs.length === 0
        ? t('cameraDeviceListUnavailable')
        : '',
    )

    return videoInputs
  }

  const requestCameraStream = (deviceId) =>
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: getVideoConstraints(deviceId),
    })

  const clearOcrTimer = () => {
    if (ocrTimerRef.current) {
      window.clearInterval(ocrTimerRef.current)
      ocrTimerRef.current = null
    }
  }

  const getOcrWorker = async () => {
    if (ocrWorkerRef.current) {
      return ocrWorkerRef.current
    }

    const worker = await createWorker('eng')
    await worker.setParameters({
      tessedit_char_whitelist: OCR_WHITELIST,
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
    })
    ocrWorkerRef.current = worker

    return worker
  }

  const terminateOcrWorker = async () => {
    if (!ocrWorkerRef.current) {
      return
    }

    const worker = ocrWorkerRef.current
    ocrWorkerRef.current = null
    await worker.terminate()
  }

  const stopOcr = async ({ resetToMock = true } = {}) => {
    ocrActiveRef.current = false
    ocrJobRunningRef.current = false
    clearOcrTimer()
    ocrSamplesRef.current = []
    stableOcrRpmRef.current = null
    setOcrCandidates([])
    setOcrDurationMs(null)
    setOcrRawText('')
    setOcrRpm(null)
    setStableOcrRpm(null)
    setOcrStatus(OCR_STATUS.OFF)
    setOcrPlausibility(t('ocrOff'))

    if (resetToMock) {
      onOcrStop?.()
    }

    try {
      await terminateOcrWorker()
    } catch {
      setOcrError(t('ocrCannotStop'))
    }
  }

  const scheduleOcrPass = () => {
    clearOcrTimer()
    ocrTimerRef.current = window.setInterval(() => {
      if (!ocrJobRunningRef.current) {
        void runOcrPass()
      }
    }, OCR_INTERVAL_MS)
  }

  async function runOcrPass() {
    if (
      !ocrActiveRef.current ||
      !streamRef.current ||
      ocrJobRunningRef.current
    ) {
      return
    }

    const startedAt = performance.now()
    ocrJobRunningRef.current = true

    try {
      setOcrStatus((currentStatus) =>
        currentStatus === OCR_STATUS.RECOGNIZED
          ? OCR_STATUS.RECOGNIZED
          : OCR_STATUS.RUNNING,
      )
      const worker = await getOcrWorker()
      const frame = captureFrameForOCR(videoRef.current, ocrCanvasRef.current, t)
      const {
        data: { text },
      } = await worker.recognize(frame)
      const candidates = getRpmCandidatesFromText(text)
      const parsedRpm = parseRpmFromText(text)

      setOcrRawText(text.trim())
      setOcrCandidates(candidates.map((candidate) => candidate.value))
      setOcrRpm(parsedRpm)

      if (parsedRpm === null) {
        setOcrStatus(OCR_STATUS.RUNNING)
        setOcrPlausibility(t('ocrUncertain'))
      } else {
        const nextSamples = [...ocrSamplesRef.current, parsedRpm].slice(-3)
        const stableRpm = getStableRpmValue(nextSamples)

        ocrSamplesRef.current = nextSamples

        if (stableRpm === null) {
          setOcrStatus(OCR_STATUS.RUNNING)
          setOcrPlausibility(t('ocrUncertain'))
        } else {
          setOcrStatus(OCR_STATUS.RECOGNIZED)
          setOcrPlausibility(t('ocrStable'))
          stableOcrRpmRef.current = stableRpm
          setStableOcrRpm(stableRpm)
          setOcrRpm(stableRpm)
          onStableRpm?.(stableRpm)
        }
      }

      setOcrError('')
    } catch (error) {
      setOcrStatus(OCR_STATUS.ERROR)
      setOcrError(error?.message || t('ocrFailed'))
    } finally {
      setOcrDurationMs(Math.round(performance.now() - startedAt))
      ocrJobRunningRef.current = false
    }
  }

  const startDefaultCamera = async () => {
    stopCameraStream()
    const stream = await requestCameraStream('')
    await attachStream(stream)
    setCameraStatus(CAMERA_STATUS.LIVE)

    const devices = await collectVideoDevices()
    const streamDeviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId
    setSelectedDeviceId(streamDeviceId || getPreferredDeviceId(devices))
  }

  const startSelectedCamera = async (deviceId) => {
    stopCameraStream()
    const stream = await requestCameraStream(deviceId)
    await attachStream(stream)
    setCameraStatus(CAMERA_STATUS.LIVE)
    await collectVideoDevices()
  }

  const refreshVideoDevices = async () => {
    setDeviceListMessage('')

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus(CAMERA_STATUS.BLOCKED)
      setCameraError(t('cameraApiBlocked'))
      return
    }

    let permissionStream = null

    try {
      if (!streamRef.current) {
        permissionStream = await requestCameraStream('')
      }

      const devices = await collectVideoDevices()

      if (!selectedDeviceId && devices.length > 0) {
        setSelectedDeviceId(getPreferredDeviceId(devices))
      }
    } catch (error) {
      setCameraStatus(CAMERA_STATUS.ERROR)
      setCameraError(error?.message || t('cameraListLoadFailed'))
    } finally {
      permissionStream?.getTracks().forEach((track) => track.stop())
    }
  }

  const handleStartCamera = async () => {
    setCameraError('')

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus(CAMERA_STATUS.BLOCKED)
      setCameraError(t('cameraApiBlocked'))
      return
    }

    try {
      await startDefaultCamera()
    } catch (error) {
      stopCameraStream()
      setCameraStatus(CAMERA_STATUS.ERROR)
      setCameraError(error?.message || t('cameraNotAllowed'))
    }
  }

  const handleCameraChange = async (event) => {
    const nextDeviceId = event.target.value
    setSelectedDeviceId(nextDeviceId)

    if (cameraStatus !== CAMERA_STATUS.LIVE) {
      return
    }

    setCameraError('')

    try {
      await startSelectedCamera(nextDeviceId)
    } catch (error) {
      stopCameraStream()
      setCameraStatus(CAMERA_STATUS.ERROR)
      setCameraError(error?.message || t('cameraNotAllowed'))
    }
  }

  const handleRefreshDevices = async () => {
    await refreshVideoDevices()
  }

  const handleStopCamera = () => {
    void stopOcr()
    stopCameraStream()
    setCameraError('')
    setCameraStatus(CAMERA_STATUS.MOCK)
  }

  const handleStartOcr = async () => {
    if (cameraStatus !== CAMERA_STATUS.LIVE || !streamRef.current) {
      setOcrStatus(OCR_STATUS.ERROR)
      setOcrError(t('ocrNeedsCamera'))
      return
    }

    ocrActiveRef.current = true
    stableOcrRpmRef.current = null
    ocrSamplesRef.current = []
    setOcrCandidates([])
    setOcrDurationMs(null)
    setOcrError('')
    setOcrRawText('')
    setOcrRpm(null)
    setStableOcrRpm(null)
    setOcrPlausibility(t('ocrUncertain'))
    setOcrStatus(OCR_STATUS.RUNNING)
    scheduleOcrPass()
    void runOcrPass()
  }

  const handleStopOcr = () => {
    void stopOcr()
  }

  useEffect(() => {
    return () => {
      void stopOcr({ resetToMock: false })
      stopCameraStream()
    }
  }, [])

  useEffect(() => {
    if (ocrStatus === OCR_STATUS.OFF) {
      setOcrPlausibility(t('ocrOff'))
    }
  }, [ocrStatus, t])

  const ocrStatusLabel =
    ocrStatus === OCR_STATUS.RUNNING
      ? t('ocrUncertain')
      : ocrStatus === OCR_STATUS.RECOGNIZED
        ? t('ocrStable')
        : ocrStatus === OCR_STATUS.ERROR
          ? t('ocrError')
          : t('ocrOff')

  const statusLabel =
    cameraStatus === CAMERA_STATUS.LIVE
      ? t('cameraLive')
      : cameraStatus === CAMERA_STATUS.BLOCKED
        ? t('cameraBlocked')
      : cameraStatus === CAMERA_STATUS.ERROR
        ? t('cameraError')
        : t('cameraMockActive')

  return (
    <section className="camera-rpm-panel" aria-label={t('cameraRpm')}>
      <div className="camera-rpm-panel__preview">
        <video
          ref={videoRef}
          aria-label={t('cameraLive')}
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={ocrCanvasRef}
          aria-hidden="true"
          className="camera-rpm-panel__ocr-canvas"
        />
        <div className="camera-rpm-panel__ocr-roi" aria-hidden="true">
          <span>{t('ocrRoiLabel')}</span>
        </div>
        {cameraStatus !== CAMERA_STATUS.LIVE && <span>{t('cameraPreview')}</span>}
      </div>
      <div className="camera-rpm-panel__content">
        <div className="camera-rpm-panel__header">
          <div>
            <span className="eyebrow">{t('cameraRpm')}</span>
            <h2>{statusLabel}</h2>
          </div>
          <span
            className={`camera-rpm-panel__status camera-rpm-panel__status--${cameraStatus}`}
            aria-label={statusLabel}
          />
        </div>
        <strong>{rpm}</strong>
        <div className="camera-rpm-panel__actions">
          <button
            disabled={cameraStatus === CAMERA_STATUS.LIVE}
            type="button"
            onClick={handleStartCamera}
          >
            {t('cameraStart')}
          </button>
          <button
            disabled={cameraStatus !== CAMERA_STATUS.LIVE}
            type="button"
            onClick={handleStopCamera}
          >
            {t('cameraStop')}
          </button>
        </div>
        <div className="camera-rpm-panel__device-row">
          {videoDevices.length > 0 && (
            <label className="camera-rpm-panel__device-select">
              <span>{t('cameraSelect')}</span>
              <select value={selectedDeviceId} onChange={handleCameraChange}>
                {videoDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {getDeviceLabel(device, index, t)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={handleRefreshDevices}>
            {t('refreshCameras')}
          </button>
        </div>
        {deviceListScanned && (
          <span className="camera-rpm-panel__debug">
            {t('cameraDeviceCount')}: {videoDevices.length}
          </span>
        )}
        {deviceListMessage && (
          <span className="camera-rpm-panel__secure-hint">
            {deviceListMessage}
          </span>
        )}
        <div className="camera-rpm-panel__ocr-controls">
          <button
            disabled={cameraStatus !== CAMERA_STATUS.LIVE || ocrActiveRef.current}
            type="button"
            onClick={handleStartOcr}
          >
            {t('ocrStart')}
          </button>
          <button
            disabled={!ocrActiveRef.current}
            type="button"
            onClick={handleStopOcr}
          >
            {t('ocrStop')}
          </button>
        </div>
        <div className="camera-rpm-panel__ocr-readout">
          <span>{ocrStatusLabel}</span>
          <span>{ocrPlausibility}</span>
          <span>
            {t('ocrCandidate')} {ocrRpm === null ? '--' : ocrRpm.toFixed(2)}
          </span>
          <span>
            {t('ocrStable')} {stableOcrRpm === null ? '--' : stableOcrRpm.toFixed(2)}
          </span>
          <span>
            {t('ocrDuration')} {ocrDurationMs === null ? '--' : ocrDurationMs} ms
          </span>
          {ocrCandidates.length > 0 && (
            <small>
              {t('ocrCandidates')}:{' '}
              {ocrCandidates
                .slice(0, 4)
                .map((candidate) => candidate.toFixed(2))
                .join(', ')}
            </small>
          )}
          {ocrRawText && (
            <small>
              {t('ocrText')}: {ocrRawText.slice(0, 28)}
            </small>
          )}
        </div>
        {ocrError && <span className="camera-rpm-panel__error">{ocrError}</span>}
        <span className="camera-rpm-panel__hint">{t('ocrPrepared')}</span>
        <span className="camera-rpm-panel__secure-hint">
          {t('cameraNeedsSecureContext')}
        </span>
        {cameraError && (
          <span className="camera-rpm-panel__error">{cameraError}</span>
        )}
      </div>
    </section>
  )
}

export default CameraRPMPanel
