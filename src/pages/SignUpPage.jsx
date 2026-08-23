import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { landingPathForRole } from "../lib/permissions";
import { IconEye, IconEyeOff } from "../components/Icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpPage() {
  const { signUp, isAuthenticated, profile, loading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  if (!loading && isAuthenticated) {
    return <Navigate to={landingPathForRole(profile?.role)} replace />;
  }

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) errs.fullName = "Full name is required.";
    if (!EMAIL_RE.test(email)) errs.email = "Enter a valid email address.";
    if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone))
      errs.phone = "Enter a valid phone number.";
    if (password.length < 8)
      errs.password = "Password must be at least 8 characters.";
    if (confirmPassword !== password)
      errs.confirmPassword = "Passwords do not match.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const result = await signUp(email, password, fullName, phone);
      if (result?.user && !result?.session) {
        setSuccess("Account created! Check your email for confirmation.");
      }
    } catch (err) {
      console.error("Signup error:", err);
      let errorMessage = "An error occurred during signup";
      
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.error_description) {
        errorMessage = err.error_description;
      } else if (err?.error) {
        errorMessage = err.error;
      } else if (JSON.stringify(err) !== '{}') {
        errorMessage = JSON.stringify(err);
      }
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-new">
      <div className="auth-card-new">
        <img src="/logo-black.png" alt="Logo" className="auth-logo" />
        <h1 className="auth-title-new">Sign up & Start Shopping</h1>
        <p className="auth-subtitle">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">
            Log in
          </Link>
        </p>
        {success ? (
          <div className="auth-success-new">{success}</div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form-new" noValidate>
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-field">
              <input
                type="text"
                className="auth-input"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
              {fieldErrors.fullName && (
                <span className="auth-field-error">{fieldErrors.fullName}</span>
              )}
            </div>
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
              {fieldErrors.email && (
                <span className="auth-field-error">{fieldErrors.email}</span>
              )}
            </div>
            <div className="auth-field">
              <input
                type="tel"
                className="auth-input"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
              {fieldErrors.phone && (
                <span className="auth-field-error">{fieldErrors.phone}</span>
              )}
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
                  minLength={8}
                  autoComplete="new-password"
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
              {fieldErrors.password && (
                <span className="auth-field-error">{fieldErrors.password}</span>
              )}
            </div>
            <div className="auth-field">
              <div className="auth-password-field">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="auth-input"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? (
                    <IconEyeOff size={20} />
                  ) : (
                    <IconEye size={20} />
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <span className="auth-field-error">
                  {fieldErrors.confirmPassword}
                </span>
              )}
            </div>
            <button
              type="submit"
              className="auth-btn-new"
              disabled={submitting}
            >
              {submitting ? "Creating account..." : "Sign Up"}
            </button>
          </form>
        )}
        <p className="auth-legal-text">
          By signing up you agree to our{' '}
          <Link to="/privacy-policy" className="auth-link">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link to="/terms" className="auth-link">
            Terms &amp; Conditions
          </Link>.
        </p>
      </div>
    </div>
  );
}
