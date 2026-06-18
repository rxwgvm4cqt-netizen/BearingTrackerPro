import BearingPresetSelect from '../components/BearingPresetSelect'
import KPIBox from '../components/KPIBox'

function formatDecimal(value, digits = 2) {
  return value.toFixed(digits)
}

function formatAngle(value) {
  return value === null ? '-- °' : `${value.toFixed(1)} °`
}

function formatStopTime(seconds) {
  if (seconds === null) {
    return '--:--'
  }

  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return '--'
  }

  return new Date(timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function AnalysisPage({
  bearingData,
  defectEvents,
  selectedBearingPreset,
  t,
  trackingMetrics,
  onPresetChange,
}) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t('analysis')}</span>
          <h1>{t('analysisTitle')}</h1>
        </div>
        <BearingPresetSelect
          selectedPresetId={selectedBearingPreset.id}
          t={t}
          onPresetChange={onPresetChange}
        />
      </header>

      <section className="kpi-grid">
        <KPIBox
          label={t('outerRevolutions')}
          value={formatDecimal(trackingMetrics.outerRevolutions, 3)}
          meta={bearingData.label}
        />
        <KPIBox
          label={t('cageRevolutions')}
          value={formatDecimal(trackingMetrics.cageRevolutions, 3)}
          meta={`${formatDecimal(trackingMetrics.cageRpm, 2)} RPM`}
          tone="orange"
        />
        <KPIBox
          label={t('angleToA')}
          value={formatAngle(trackingMetrics.angleToA)}
          meta={t('suspiciousRoller')}
        />
        <KPIBox
          label={t('referenceBlade')}
          value={trackingMetrics.referenceBlade}
          meta={t('active')}
          tone="green"
        />
        <KPIBox
          label={t('suspiciousRoller')}
          value={trackingMetrics.suspiciousRollerNumber ?? '--'}
          meta={t('number')}
          tone="orange"
        />
        <KPIBox
          compact
          label={t('position')}
          value={trackingMetrics.positionLabel}
          meta={t('sector')}
        />
      </section>

      <section className="plant-stop-status analysis-stop-status">
        <strong>{trackingMetrics.plantStatus}</strong>
        <div>
          <span>{t('stopStartedAt')}</span>
          <b>{formatTimestamp(trackingMetrics.plantStopStartTime)}</b>
        </div>
        <div>
          <span>{t('startRpm')}</span>
          <b>
            {trackingMetrics.plantStopStartRPM === null
              ? '--'
              : formatDecimal(trackingMetrics.plantStopStartRPM)}
          </b>
        </div>
        <div>
          <span>{t('stopDuration')}</span>
          <b>{trackingMetrics.stopDurationSeconds}s</b>
        </div>
        <div>
          <span>{t('currentRpm')}</span>
          <b>{formatDecimal(trackingMetrics.rpm)}</b>
        </div>
        <div>
          <span>{t('remainingTime')}</span>
          <b>{formatStopTime(trackingMetrics.estimatedStopSeconds)}</b>
        </div>
        <div>
          <span>plantStopped</span>
          <b>{trackingMetrics.plantStopped ? 'true' : 'false'}</b>
        </div>
      </section>

      <section className="analysis-layout">
        <article className="placeholder-panel placeholder-panel--chart">
          <div>
            <span className="eyebrow">{t('angleHistory')}</span>
            <h2>{t('signalAngleCurve')}</h2>
          </div>
          <div className="chart-placeholder" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </article>

        <article className="placeholder-panel">
          <div>
            <span className="eyebrow">{t('defectHistory')}</span>
            <h2>{t('markers')}</h2>
          </div>
          {defectEvents.length === 0 ? (
            <div className="event-list">
              <div>
                <strong>{t('defectEventsEmpty')}</strong>
                <span>{t('trackingWaitingForDefect')}</span>
              </div>
            </div>
          ) : (
            <div className="defect-history">
              {defectEvents.map((event) => (
                <article key={event.id}>
                  <strong>{event.timestamp}</strong>
                  <span>RPM {formatDecimal(event.rpm, 2)}</span>
                  <span>Ref {event.referenceBlade}</span>
                  <span>{t('roller')} {event.rollerNumber}</span>
                  <span>{formatAngle(event.angleToA)}</span>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  )
}

export default AnalysisPage
