import { useState } from 'react'

function LoginScreen({ onLogin }) {
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
      setError('Benutzername oder Passwort ist falsch.')
      return
    }

    setError('')
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-label="Login">
        <div className="login-panel__header">
          <span className="eyebrow">Secure Access</span>
          <h1>Bearing Tracker Pro</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Benutzername</span>
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
            <span>Passwort</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-button">
            Login
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginScreen
