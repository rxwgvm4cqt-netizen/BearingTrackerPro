import BottomNav from './BottomNav'

function AppShell({
  activePage,
  children,
  language,
  onLanguageChange,
  onLogout,
  onPageChange,
  t,
}) {
  return (
    <div className="app-shell">
      <header className="shell-topbar">
        <span>{t('appTitle')}</span>
        <div className="shell-topbar__actions">
          <div className="language-toggle" aria-label="Language">
            {['de', 'en'].map((languageCode) => (
              <button
                className={language === languageCode ? 'is-active' : ''}
                key={languageCode}
                type="button"
                onClick={() => onLanguageChange(languageCode)}
              >
                {languageCode.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" className="logout-button" onClick={onLogout}>
            {t('logout')}
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <BottomNav activePage={activePage} t={t} onPageChange={onPageChange} />
    </div>
  )
}

export default AppShell
