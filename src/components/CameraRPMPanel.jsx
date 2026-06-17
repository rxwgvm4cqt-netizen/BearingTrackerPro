import { useEffect, useRef, useState } from 'react'

const CAMERA_STATUS = {
  BLOCKED: 'blocked',
  ERROR: 'error',
  LIVE: 'live',
  MOCK: 'mock',
}

function CameraRPMPanel({ rpm }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraStatus, setCameraStatus] = useState(CAMERA_STATUS.MOCK)
  const [cameraError, setCameraError] = useState('')

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
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
      stopCameraStream()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraStatus(CAMERA_STATUS.LIVE)
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
