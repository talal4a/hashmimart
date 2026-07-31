import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { landingPathForRole } from "../lib/permissions";
import { IconEye, IconEyeOff } from "../components/Icons";

export default function LoginPage() {
  const { logIn, isAuthenticated, profile, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTo =
    searchParams.get("redirect") || landingPathForRole(profile?.role);

  if (!loading && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await logIn(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-new">
      <div className="auth-card-new">
        <img src="/logo-black.png" alt="Logo" className="auth-logo" />
        <h1 className="auth-title-new">Welcome Back</h1>
        <p className="auth-subtitle">
          Don't have an account?{" "}
          <Link to="/signup" className="auth-link">
            Sign up
          </Link>
        </p>
        <form onSubmit={handleSubmit} className="auth-form-new">
          {error && <div className="auth-error">{error}</div>}
          <div className="auth-field">
            <input
              type="email"
              className="auth-input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <div className="auth-password-field">
              <input
                type={showPassword ? "text" : "password"}
                className="auth-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <IconEyeOff size={20} />
                ) : (
                  <IconEye size={20} />
                )}
              </button>
            </div>
          </div>
          <button type="submit" className="auth-btn-new" disabled={submitting}>
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="auth-footer-new">
          <Link to="/forgot-password" className="auth-link-small">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
