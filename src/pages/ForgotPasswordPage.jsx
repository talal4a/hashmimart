import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { landingPathForRole } from '../lib/permissions'

export default function ForgotPasswordPage() {
  const { resetPassword, isAuthenticated, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  if (!loading && isAuthenticated) {
    return <Navigate to={landingPathForRole(profile?.role)} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Forgot Password</h1>
        {sent ? (
          <div className="auth-success">
            Password reset link sent to <strong>{email}</strong>. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="checkout-form">
            {error && <div className="field-error">{error}</div>}
            <p className="form-hint">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <div className="field">
              <label className="field-label">Email</label>
              <input
                type="email"
                className="text-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
        <div className="auth-footer">
          <span>
            Remember your password? <Link to="/login">Login</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
