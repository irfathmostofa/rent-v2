import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    if (!data.user.email_confirmed_at) {
      setError('Please verify your email before logging in.')
      await supabase.auth.signOut()
      return
    }

    navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Login</h2>
        {error && <p className="error-text">{error}</p>}
        <label>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={submitting}>{submitting ? 'Logging in...' : 'Login'}</button>
        <p>No account? <Link to="/register">Register</Link></p>
      </form>
    </div>
  )
}
