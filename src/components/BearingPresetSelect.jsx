import { bearingPresets } from '../data/bearingPresets'

function BearingPresetSelect({
  compact = false,
  selectedPresetId,
  onPresetChange,
}) {
  return (
    <label className={`preset-select ${compact ? 'preset-select--compact' : ''}`}>
      {!compact && <span>Lager-Preset</span>}
      <select
        value={selectedPresetId}
        onChange={(event) => onPresetChange(event.target.value)}
      >
        {bearingPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default BearingPresetSelect
