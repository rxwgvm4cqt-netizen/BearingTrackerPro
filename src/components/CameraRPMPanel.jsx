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
  const [deviceListMessage, setDeviceListMessage] = useState('')
  const [deviceListScanned, setDeviceListScanned] = useState(false)
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
