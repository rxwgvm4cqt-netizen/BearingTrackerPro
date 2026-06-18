const navItems = [
  { id: 'tracking', labelKey: 'tracking' },
  { id: 'analysis', labelKey: 'analysis' },
  { id: 'bearingData', labelKey: 'bearingData' },
]

function BottomNav({ activePage, onPageChange, t }) {
  return (
    <nav className="bottom-nav" aria-label={t('mainNavigation')}>
      {navItems.map((item) => (
        <button
          className={`bottom-nav__item ${
            activePage === item.id ? 'is-active' : ''
          }`}
          key={item.id}
          type="button"
          onClick={() => onPageChange(item.id)}
        >
          <span className="bottom-nav__indicator" aria-hidden="true" />
          {t(item.labelKey)}
        </button>
      ))}
    </nav>
  )
}

export default BottomNav
