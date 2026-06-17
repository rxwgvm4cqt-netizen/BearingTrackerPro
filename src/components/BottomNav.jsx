const navItems = [
  { id: 'tracking', label: 'Tracking' },
  { id: 'analysis', label: 'Analyse' },
  { id: 'bearingData', label: 'Lagerdaten' },
]

function BottomNav({ activePage, onPageChange }) {
  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
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
          {item.label}
        </button>
      ))}
    </nav>
  )
}

export default BottomNav
