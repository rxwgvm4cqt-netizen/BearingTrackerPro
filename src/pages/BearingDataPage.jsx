import BearingPresetSelect from '../components/BearingPresetSelect'

const fieldGroups = [
  {
    titleKey: 'geometry',
    fields: [
      ['outerDiameterCm', 'outerDiameter', 'cm'],
      ['innerDiameterCm', 'innerDiameter', 'cm'],
      ['pitchDiameterCm', 'pitchDiameter', 'cm'],
      ['rollerDiameterCm', 'rollerDiameter', 'cm'],
    ],
  },
  {
    titleKey: 'structure',
    fields: [
      ['rollerCount', 'rollerCount', ''],
      ['rows', 'rows', ''],
      ['bearingType', 'bearingType', ''],
      ['rotatingRing', 'rotatingRing', ''],
    ],
  },
  {
    titleKey: 'tracking',
    fields: [
      ['innerRingFixed', 'innerRingFixed', ''],
      ['direction', 'direction', ''],
      ['rpmSource', 'rpmSource', ''],
      ['id', 'presetId', ''],
    ],
  },
]

function formatValue(value, t) {
  if (typeof value === 'boolean') {
    return value ? t('yes') : t('no')
  }

  return value
}

function BearingDataPage({
  bearingData,
  selectedBearingPreset,
  t,
  onPresetChange,
}) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t('bearingData')}</span>
          <h1>{bearingData.label}</h1>
        </div>
        <BearingPresetSelect
          selectedPresetId={selectedBearingPreset.id}
          t={t}
          onPresetChange={onPresetChange}
        />
      </header>

      <section className="data-groups">
        {fieldGroups.map((group) => (
          <article className="data-group" key={group.titleKey}>
            <h2>{t(group.titleKey)}</h2>
            <div className="readonly-fields">
              {group.fields.map(([key, labelKey, unit]) => (
                <label className="readonly-field" key={key}>
                  <span>{t(labelKey)}</span>
                  <input
                    readOnly
                    value={`${formatValue(bearingData[key], t)}${
                      unit ? ` ${unit}` : ''
                    }`}
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
