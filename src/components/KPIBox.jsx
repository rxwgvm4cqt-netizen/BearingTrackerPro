function KPIBox({ compact = false, label, value, meta, tone = 'cyan' }) {
  return (
    <article className={`kpi-box kpi-box--${tone} ${compact ? 'kpi-box--compact' : ''}`}>
      <span className="kpi-box__label">{label}</span>
      <strong className="kpi-box__value">{value}</strong>
      {meta && <span className="kpi-box__meta">{meta}</span>}
    </article>
  )
}

export default KPIBox
