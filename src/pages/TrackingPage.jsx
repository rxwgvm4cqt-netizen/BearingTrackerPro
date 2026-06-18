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
  t,
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
          <span className="eyebrow">{t('trackingSubtitle')}</span>
          <h1>{t('appTitle')}</h1>
        </div>
      </header>

      <section className="tracking-workspace">
        <div className="tracking-visual-column">
          <BearingVisualization
            bearingData={bearingData}
            t={t}
            trackingState={trackingState}
          />
        </div>

        <section className="tracking-main-actions" aria-label="Hauptaktionen">
          <button
            type="button"
            className="primary-action-button primary-action-button--start"
            onClick={() => onSetOuterRunning(true)}
          >
            {t('startOuterRing')}
          </button>
          <button
            type="button"
            className="primary-action-button primary-action-button--start"
            onClick={() => onSetCageRunning(true)}
          >
            {t('startRoller')}
          </button>
          <button
            type="button"
            className="primary-action-button primary-action-button--warning"
            onClick={onPlantStop}
          >
            {t('plantStop')}
          </button>
        </section>

        <aside className="tracking-side-panel" aria-label={t('trackingControls')}>
          <CameraRPMPanel
            rpm={formatDecimal(trackingMetrics.rpm)}
            t={t}
            onOcrStop={onOcrStop}
            onStableRpm={onStableOcrRpm}
          />

          <BearingPresetSelect
            compact
            selectedPresetId={selectedBearingPreset.id}
            t={t}
            onPresetChange={onPresetChange}
          />

          <section className="kpi-grid tracking-kpi-grid">
            <KPIBox
              compact
              label={t('outerRevolutions')}
              value={formatDecimal(trackingMetrics.outerRevolutions, 3)}
              meta={
                trackingState.outerRunning
                  ? t('turbineStatusRunning')
                  : t('turbineStatusStopped')
              }
            />
            <KPIBox
              compact
              label={t('cageRevolutions')}
              value={formatDecimal(trackingMetrics.cageRevolutions, 3)}
              meta={`${formatDecimal(trackingMetrics.cageRpm, 2)} RPM`}
              tone="orange"
            />
          </section>

          <section
            className="action-grid tracking-defect-row"
            aria-label={t('trackingActions')}
          >
            <button
              type="button"
              className="action-button action-button--danger"
              onClick={onDefectHeard}
            >
              {t('defectHeard')}
            </button>
          </section>

          <section className="motion-controls" aria-label={t('trackingControls')}>
            <button
              type="button"
              className="control-button"
              onClick={() => onSetOuterRunning(false)}
            >
              {t('stopOuterRing')}
            </button>
            <button
              type="button"
              className="control-button"
              onClick={() => onSetCageRunning(false)}
            >
              {t('stopRoller')}
            </button>
            <button
              type="button"
              className="control-button control-button--combined"
              onClick={onCombinedStartStop}
            >
              {combinedIsRunning ? t('combinedStop') : t('combinedStart')}
            </button>
            <button
              type="button"
              className={`control-button control-button--position ${
                trackingState.positioningMode ? 'is-active' : ''
              }`}
              disabled={!positioningAllowed}
              onClick={onTogglePositioningMode}
            >
              {t('positioning')}
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
              {t('reset')}
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
              <small>{t('jogSlow')}</small>
              <small>{t('jogFast')}</small>
            </em>
          </label>
        </aside>
      </section>

      <p className="tracking-context">
        {bearingData.label} · {bearingData.rollerCount} {t('roller')} ·{' '}
        {bearingData.bearingType}
      </p>
    </div>
  )
}

export default TrackingPage
