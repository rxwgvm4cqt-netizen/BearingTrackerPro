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

const OCR_INTERVAL_MS = 800
const OCR_OUTPUT_WIDTH = 360
const OCR_ROI = {
  height: 0.24,
  left: 0.24,
  top: 0.38,
  width: 0.52,
}
const OCR_WHITELIST = '0123456789.,'

const OCR_STATUS = {
  ERROR: 'error',
  OFF: 'off',
  RECOGNIZED: 'recognized',
  RUNNING: 'running',
}

export function captureFrameForOCR(videoElement, canvasElement) {
  if (!videoElement || !canvasElement) {
    throw new Error('OCR-Bildquelle nicht verfuegbar')
  }

  const sourceVideoWidth = videoElement.videoWidth
  const sourceVideoHeight = videoElement.videoHeight
  const previewWidth = videoElement.clientWidth
  const previewHeight = videoElement.clientHeight

  if (!sourceVideoWidth || !sourceVideoHeight || !previewWidth || !previewHeight) {
    throw new Error('Kamerabild noch nicht bereit')
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
    throw new Error('OCR-Bereich ausserhalb des Kamerabildes')
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

function getDeviceLabel(device, index) {
  return device.label || `Kamera ${index + 1}`
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

function CameraRPMPanel({ onOcrStop, onStableRpm, rpm }) {
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
  const [ocrPlausibility, setOcrPlausibility] = useState('OCR aus')
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
        ? 'Keine Kameraliste verfuegbar - Safari erlaubt Auswahl ggf. erst nach Berechtigung.'
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
      tessedit_pageseg_mode: PSM.SINGLE_WORD,
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
    setOcrPlausibility('OCR aus')

    if (resetToMock) {
      onOcrStop?.()
    }

    try {
      await terminateOcrWorker()
    } catch {
      setOcrError('OCR konnte nicht sauber beendet werden')
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
      const frame = captureFrameForOCR(videoRef.current, ocrCanvasRef.current)
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
        setOcrPlausibility('OCR unsicher')
      } else {
        const nextSamples = [...ocrSamplesRef.current, parsedRpm].slice(-2)
        const lastStableRpm = stableOcrRpmRef.current
        const stableRpm =
          lastStableRpm !== null && Math.abs(parsedRpm - lastStableRpm) <= 0.2
            ? parsedRpm
            : getStableRpmValue(nextSamples)

        ocrSamplesRef.current = nextSamples

        if (stableRpm === null) {
          setOcrStatus(OCR_STATUS.RUNNING)
          setOcrPlausibility('OCR unsicher')
        } else {
          setOcrStatus(OCR_STATUS.RECOGNIZED)
          setOcrPlausibility('OCR stabil')
          stableOcrRpmRef.current = stableRpm
          setStableOcrRpm(stableRpm)
          setOcrRpm(stableRpm)
          onStableRpm?.(stableRpm)
        }
      }

      setOcrError('')
    } catch (error) {
      setOcrStatus(OCR_STATUS.ERROR)
      setOcrError(error?.message || 'OCR fehlgeschlagen')
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
      setCameraError('Kamera blockiert: HTTPS oder localhost erforderlich')
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
      setCameraError(error?.message || 'Kameraliste konnte nicht geladen werden')
    } finally {
      permissionStream?.getTracks().forEach((track) => track.stop())
    }
  }

  const handleStartCamera = async () => {
    setCameraError('')

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus(CAMERA_STATUS.BLOCKED)
      setCameraError('Kamera blockiert: HTTPS oder localhost erforderlich')
      return
    }

    try {
      await startDefaultCamera()
    } catch (error) {
      stopCameraStream()
      setCameraStatus(CAMERA_STATUS.ERROR)
      setCameraError(error?.message || 'Kamera nicht erlaubt oder nicht verfuegbar')
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
      setCameraError(error?.message || 'Kamera nicht erlaubt oder nicht verfuegbar')
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
      setOcrError('OCR benoetigt eine laufende Kamera')
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
    setOcrPlausibility('Stabilisierung laeuft')
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

  const ocrStatusLabel =
    ocrStatus === OCR_STATUS.RUNNING
      ? 'OCR unsicher'
      : ocrStatus === OCR_STATUS.RECOGNIZED
        ? 'OCR stabil'
        : ocrStatus === OCR_STATUS.ERROR
          ? 'OCR Fehler'
          : 'OCR aus'

  const statusLabel =
    cameraStatus === CAMERA_STATUS.LIVE
      ? 'Kamera Live'
      : cameraStatus === CAMERA_STATUS.BLOCKED
        ? 'Kamera blockiert'
      : cameraStatus === CAMERA_STATUS.ERROR
        ? 'Kamera Fehler'
        : 'Kamera Mock aktiv'

  return (
    <section className="camera-rpm-panel" aria-label="Kamera RPM">
      <div className="camera-rpm-panel__preview">
        <video
          ref={videoRef}
          aria-label="Kamera Livebild"
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
          <span>RPM Bereich</span>
        </div>
        {cameraStatus !== CAMERA_STATUS.LIVE && <span>Camera Preview</span>}
      </div>
      <div className="camera-rpm-panel__content">
        <div className="camera-rpm-panel__header">
          <div>
            <span className="eyebrow">Kamera RPM</span>
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
            Kamera starten
          </button>
          <button
            disabled={cameraStatus !== CAMERA_STATUS.LIVE}
            type="button"
            onClick={handleStopCamera}
          >
            Kamera stoppen
          </button>
        </div>
        <div className="camera-rpm-panel__device-row">
          {videoDevices.length > 0 && (
            <label className="camera-rpm-panel__device-select">
              <span>Kamera</span>
              <select value={selectedDeviceId} onChange={handleCameraChange}>
                {videoDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {getDeviceLabel(device, index)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={handleRefreshDevices}>
            Kameras neu laden
          </button>
        </div>
        {deviceListScanned && (
          <span className="camera-rpm-panel__debug">
            Anzahl gefundener Kameras: {videoDevices.length}
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
            OCR Start
          </button>
          <button
            disabled={!ocrActiveRef.current}
            type="button"
            onClick={handleStopOcr}
          >
            OCR Stop
          </button>
        </div>
        <div className="camera-rpm-panel__ocr-readout">
          <span>{ocrStatusLabel}</span>
          <span>{ocrPlausibility}</span>
          <span>Kandidat {ocrRpm === null ? '--' : ocrRpm.toFixed(2)}</span>
          <span>Stabil {stableOcrRpm === null ? '--' : stableOcrRpm.toFixed(2)}</span>
          <span>OCR Dauer {ocrDurationMs === null ? '--' : ocrDurationMs} ms</span>
          {ocrCandidates.length > 0 && (
            <small>
              Kandidaten:{' '}
              {ocrCandidates
                .slice(0, 4)
                .map((candidate) => candidate.toFixed(2))
                .join(', ')}
            </small>
          )}
          {ocrRawText && <small>Text: {ocrRawText.slice(0, 28)}</small>}
        </div>
        {ocrError && <span className="camera-rpm-panel__error">{ocrError}</span>}
        <span className="camera-rpm-panel__hint">OCR vorbereitet</span>
        <span className="camera-rpm-panel__secure-hint">
          Kamera benoetigt HTTPS oder localhost
        </span>
        {cameraError && (
          <span className="camera-rpm-panel__error">{cameraError}</span>
        )}
      </div>
    </section>
  )
}

export default CameraRPMPanel
