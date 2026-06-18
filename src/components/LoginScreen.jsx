import { useState } from 'react'

function LoginScreen({ onLogin, t }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    const loginSucceeded = onLogin({
      username: username.trim(),
      password,
    })

    if (!loginSucceeded) {
      setError(t('invalidLogin'))
      return
    }

    setError('')
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-label={t('login')}>
        <div className="login-panel__header">
          <span className="eyebrow">{t('secureAccess')}</span>
          <h1>{t('appTitle')}</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>{t('username')}</span>
            <input
              autoComplete="username"
              autoFocus
              inputMode="text"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label>
            <span>{t('password')}</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-button">
            {t('login')}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginScreen
