import BearingPresetSelect from '../components/BearingPresetSelect'

const fieldGroups = [
  {
    title: 'Geometrie',
    fields: [
      ['outerDiameterCm', 'Aussendurchmesser', 'cm'],
      ['innerDiameterCm', 'Innendurchmesser', 'cm'],
      ['pitchDiameterCm', 'Teilkreisdurchmesser', 'cm'],
      ['rollerDiameterCm', 'Rollerdurchmesser', 'cm'],
    ],
  },
  {
    title: 'Aufbau',
    fields: [
      ['rollerCount', 'Rolleranzahl', ''],
      ['rows', 'Reihen', ''],
      ['bearingType', 'Lagertyp', ''],
      ['rotatingRing', 'Rotierender Ring', ''],
    ],
  },
  {
    title: 'Tracking',
    fields: [
      ['innerRingFixed', 'Innenring fixiert', ''],
      ['direction', 'Drehrichtung', ''],
      ['rpmSource', 'RPM Quelle', ''],
      ['id', 'Preset ID', ''],
    ],
  },
]

function formatValue(value) {
  if (typeof value === 'boolean') {
    return value ? 'Ja' : 'Nein'
  }

  return value
}

function BearingDataPage({ bearingData, selectedBearingPreset, onPresetChange }) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Lagerdaten</span>
          <h1>{bearingData.label}</h1>
        </div>
        <BearingPresetSelect
          selectedPresetId={selectedBearingPreset.id}
          onPresetChange={onPresetChange}
        />
      </header>

      <section className="data-groups">
        {fieldGroups.map((group) => (
          <article className="data-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="readonly-fields">
              {group.fields.map(([key, label, unit]) => (
                <label className="readonly-field" key={key}>
                  <span>{label}</span>
                  <input
                    readOnly
                    value={`${formatValue(bearingData[key])}${unit ? ` ${unit}` : ''}`}
                  />
                </label>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

export default BearingDataPage
