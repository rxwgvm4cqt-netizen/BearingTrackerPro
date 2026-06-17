import BearingPresetSelect from '../components/BearingPresetSelect'
import BearingVisualization from '../components/BearingVisualization'
import CameraRPMPanel from '../components/CameraRPMPanel'
import KPIBox from '../components/KPIBox'

function formatDecimal(value, digits = 2) {
  return value.toFixed(digits)
}

function TrackingPage({
  bearingData,
  jogRpm,
  jogRpmMax,
  jogRpmMin,
  jogRpmStep,
  onCombinedStartStop,
  onDefectHeard,
  onJogDirectionChange,
  onJogRpmChange,
  onOcrStop,
  onPlantStop,
  onResetTracking,
  onSetCageRunning,
  onSetOuterRunning,
  onStableOcrRpm,
  onTogglePositioningMode,
  selectedBearingPreset,
  trackingMetrics,
  trackingState,
  onPresetChange,
}) {
  const combinedIsRunning = trackingState.outerRunning || trackingState.cageRunning
  const positioningAllowed =
    !trackingState.outerRunning &&
    !trackingState.cageRunning &&
    !trackingState.plantStopping

  const startJog = (direction) => {
    onJogDirectionChange(direction)
  }

  const stopJog = () => {
    onJogDirectionChange(0)
  }

  const handleJogRpmChange = (event) => {
    onJogRpmChange(Number(event.target.value))
  }

  return (
    <div className="page page--tracking">
      <header className="tracking-header">
        <div className="tracking-title-stack">
          <span className="eyebrow">Industrial Roller Tracking</span>
          <h1>Bearing Tracker Pro</h1>
        </div>
      </header>

      <section className="tracking-workspace">
        <div className="tracking-visual-column">
          <BearingVisualization
            bearingData={bearingData}
            trackingState={trackingState}
          />
        </div>

        <section className="tracking-main-actions" aria-label="Hauptaktionen">
          <button
            type="button"
            className="primary-action-button primary-action-button--start"
            onClick={() => onSetOuterRunning(true)}
          >
            START AUSSENRING
          </button>
          <button
            type="button"
            className="primary-action-button primary-action-button--start"
            onClick={() => onSetCageRunning(true)}
          >
            START ROLLER
          </button>
          <button
            type="button"
            className="primary-action-button primary-action-button--warning"
            onClick={onPlantStop}
          >
            ANLAGEN STOP
          </button>
        </section>

        <aside className="tracking-side-panel" aria-label="Tracking Steuerung">
          <CameraRPMPanel
            rpm={formatDecimal(trackingMetrics.rpm)}
            onOcrStop={onOcrStop}
            onStableRpm={onStableOcrRpm}
          />

          <BearingPresetSelect
            compact
            selectedPresetId={selectedBearingPreset.id}
            onPresetChange={onPresetChange}
          />

          <section className="kpi-grid tracking-kpi-grid">
            <KPIBox
              compact
              label="Außenring Umdrehungen"
              value={formatDecimal(trackingMetrics.outerRevolutions, 3)}
              meta={trackingState.outerRunning ? 'läuft' : 'gestoppt'}
            />
            <KPIBox
              compact
              label="Roller/Käfig Umdrehungen"
              value={formatDecimal(trackingMetrics.cageRevolutions, 3)}
              meta={`${formatDecimal(trackingMetrics.cageRpm, 2)} RPM`}
              tone="orange"
            />
          </section>

          <section
            className="action-grid tracking-defect-row"
            aria-label="Tracking Aktionen"
          >
            <button
              type="button"
              className="action-button action-button--danger"
              onClick={onDefectHeard}
            >
              DEFEKT GEHÖRT
            </button>
          </section>

          <section className="motion-controls" aria-label="Start Stop Steuerung">
            <button
              type="button"
              className="control-button"
              onClick={() => onSetOuterRunning(false)}
            >
              Stop Außenring
            </button>
            <button
              type="button"
              className="control-button"
              onClick={() => onSetCageRunning(false)}
            >
              Stop Roller
            </button>
            <button
              type="button"
              className="control-button control-button--combined"
              onClick={onCombinedStartStop}
            >
              {combinedIsRunning ? 'Gemeinsam Stop' : 'Gemeinsam Start'}
            </button>
            <button
              type="button"
              className={`control-button control-button--position ${
                trackingState.positioningMode ? 'is-active' : ''
              }`}
              disabled={!positioningAllowed}
              onClick={onTogglePositioningMode}
            >
              Positionieren
            </button>
            <button
              type="button"
              className="control-button jog-button"
              disabled={!trackingState.positioningMode || !positioningAllowed}
              onMouseDown={() => startJog(-1)}
              onMouseLeave={stopJog}
              onMouseUp={stopJog}
              onTouchCancel={stopJog}
              onTouchEnd={stopJog}
              onTouchStart={() => startJog(-1)}
            >
              ◀
            </button>
            <button
              type="button"
              className="control-button jog-button"
              disabled={!trackingState.positioningMode || !positioningAllowed}
              onMouseDown={() => startJog(1)}
              onMouseLeave={stopJog}
              onMouseUp={stopJog}
              onTouchCancel={stopJog}
              onTouchEnd={stopJog}
              onTouchStart={() => startJog(1)}
            >
              ▶
            </button>
            <button
              type="button"
              className="control-button control-button--reset"
              onClick={onResetTracking}
            >
              Reset
            </button>
          </section>

          <label className="jog-speed-control">
            <span>Jog {formatDecimal(jogRpm)} RPM</span>
            <input
              max={jogRpmMax}
              min={jogRpmMin}
              step={jogRpmStep}
              type="range"
              value={jogRpm}
              onChange={handleJogRpmChange}
            />
            <em>
              <small>Langsam</small>
              <small>Schnell</small>
            </em>
          </label>
        </aside>
      </section>

      <p className="tracking-context">
        {bearingData.label} · {bearingData.rollerCount} Roller ·{' '}
        {bearingData.bearingType}
      </p>
    </div>
  )
}

export default TrackingPage
