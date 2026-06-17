import { useEffect, useRef, useState } from 'react'

const CAMERA_STATUS = {
  BLOCKED: 'blocked',
  ERROR: 'error',
  LIVE: 'live',
  MOCK: 'mock',
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

function CameraRPMPanel({ rpm }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraStatus, setCameraStatus] = useState(CAMERA_STATUS.MOCK)
  const [cameraError, setCameraError] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
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

    return videoInputs
  }

  const requestCameraStream = (deviceId) =>
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: getVideoConstraints(deviceId),
    })

  const startCamera = async (deviceId = '') => {
    let stream
    let activeDeviceId = deviceId

    stopCameraStream()

    try {
      stream = await requestCameraStream(activeDeviceId)
    } catch (error) {
      if (!activeDeviceId) {
        throw error
      }

      activeDeviceId = ''
      setCameraError('Ausgewaehlte Kamera nicht verfuegbar, nutze Standardkamera')
      stream = await requestCameraStream('')
    }

    await attachStream(stream)

    const devices = await collectVideoDevices()
    const streamDeviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId
    const preferredDeviceId = activeDeviceId || getPreferredDeviceId(devices)

    setSelectedDeviceId(streamDeviceId || preferredDeviceId)

    if (!deviceId && preferredDeviceId && preferredDeviceId !== streamDeviceId) {
      try {
        const preferredStream = await requestCameraStream(preferredDeviceId)
        stopCameraStream()
        await attachStream(preferredStream)
        setSelectedDeviceId(preferredDeviceId)
      } catch {
        setCameraError('Bevorzugte Kamera nicht verfuegbar, nutze Standardkamera')
      }
    }

    setCameraStatus(CAMERA_STATUS.LIVE)
  }

  const handleStartCamera = async () => {
    setCameraError('')

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus(CAMERA_STATUS.BLOCKED)
      setCameraError('Kamera blockiert: HTTPS oder localhost erforderlich')
      return
    }

    try {
      await startCamera(selectedDeviceId)
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
      await startCamera(nextDeviceId)
    } catch (error) {
      stopCameraStream()
      setCameraStatus(CAMERA_STATUS.ERROR)
      setCameraError(error?.message || 'Kamera nicht erlaubt oder nicht verfuegbar')
    }
  }

  const handleStopCamera = () => {
    stopCameraStream()
    setCameraError('')
    setCameraStatus(CAMERA_STATUS.MOCK)
  }

  useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [])

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
