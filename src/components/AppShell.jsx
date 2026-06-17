import BottomNav from './BottomNav'

function AppShell({ activePage, onLogout, onPageChange, children }) {
  return (
    <div className="app-shell">
      <header className="shell-topbar">
        <span>Bearing Tracker Pro</span>
        <button type="button" className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </header>
      <main className="app-main">{children}</main>
      <BottomNav activePage={activePage} onPageChange={onPageChange} />
    </div>
  )
}

export default AppShell
