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
  trackingMetrics,
  onPresetChange,
}) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Analyse</span>
          <h1>Auswertung</h1>
        </div>
        <BearingPresetSelect
          selectedPresetId={selectedBearingPreset.id}
          onPresetChange={onPresetChange}
        />
      </header>

      <section className="kpi-grid">
        <KPIBox
          label="Außenring Umdrehungen"
          value={formatDecimal(trackingMetrics.outerRevolutions, 3)}
          meta={bearingData.label}
        />
        <KPIBox
          label="Roller/Käfig Umdrehungen"
          value={formatDecimal(trackingMetrics.cageRevolutions, 3)}
          meta={`${formatDecimal(trackingMetrics.cageRpm, 2)} RPM`}
          tone="orange"
        />
        <KPIBox
          label="Winkel zu A"
          value={formatAngle(trackingMetrics.angleToA)}
          meta="Verdächtiger Roller"
        />
        <KPIBox
          label="Referenzblatt"
          value={trackingMetrics.referenceBlade}
          meta="Aktuell"
          tone="green"
        />
        <KPIBox
          label="Verdächtiger Roller"
          value={trackingMetrics.suspiciousRollerNumber ?? '--'}
          meta="Nummer"
          tone="orange"
        />
        <KPIBox
          compact
          label="Position"
          value={trackingMetrics.positionLabel}
          meta="Sektor"
        />
      </section>

      <section className="plant-stop-status analysis-stop-status">
        <strong>{trackingMetrics.plantStatus}</strong>
        <div>
          <span>Stop gestartet um</span>
          <b>{formatTimestamp(trackingMetrics.plantStopStartTime)}</b>
        </div>
        <div>
          <span>Start-RPM</span>
          <b>
            {trackingMetrics.plantStopStartRPM === null
              ? '--'
              : formatDecimal(trackingMetrics.plantStopStartRPM)}
          </b>
        </div>
        <div>
          <span>Stop-Dauer</span>
          <b>{trackingMetrics.stopDurationSeconds}s</b>
        </div>
        <div>
          <span>Aktuelle RPM</span>
          <b>{formatDecimal(trackingMetrics.rpm)}</b>
        </div>
        <div>
          <span>Restzeit</span>
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
            <span className="eyebrow">Winkelverlauf</span>
            <h2>Signal- und Winkelkurve</h2>
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
            <span className="eyebrow">Event-Historie</span>
            <h2>Markierungen</h2>
          </div>
          {defectEvents.length === 0 ? (
            <div className="event-list">
              <div>
                <strong>Keine Defektevents</strong>
                <span>Warte auf DEFEKT GEHÖRT im Tracking</span>
              </div>
            </div>
          ) : (
            <div className="defect-history">
              {defectEvents.map((event) => (
                <article key={event.id}>
                  <strong>{event.timestamp}</strong>
                  <span>RPM {formatDecimal(event.rpm, 2)}</span>
                  <span>Ref {event.referenceBlade}</span>
                  <span>Roller {event.rollerNumber}</span>
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
