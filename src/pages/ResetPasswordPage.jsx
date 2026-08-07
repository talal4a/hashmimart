import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { IconEye, IconEyeOff } from "../components/Icons";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    // The email link lands here with #access_token=...&type=recovery in the
    // URL. supabase-js automatically parses and exchanges it — this listener
    // catches the resulting sign-in, and getSession() covers the case where
    // the exchange already finished before this page mounted.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setValidSession(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data?.session?.user) {
        setValidSession(true);
        setChecking(false);
      } else {
        // Give the token exchange a moment before declaring the link invalid.
        setTimeout(() => {
          if (active) setChecking(false);
        }, 2500);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Sign out so the user logs in fresh with their new password.
      // If sign-out fails the password is still updated — don't surface a
      // confusing error after a successful change.
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore: password was already updated.
      }
      setDone(true);
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

        {checking ? (
          <>
            <h1 className="auth-title-new">Resetting Password</h1>
            <p className="auth-subtitle">Verifying your reset link…</p>
          </>
        ) : done ? (
          <>
            <h1 className="auth-title-new">Password Updated</h1>
            <p className="auth-subtitle">
              Your password has been changed successfully.{" "}
              <Link to="/login" className="auth-link">
                Login now
              </Link>
            </p>
          </>
        ) : !validSession ? (
          <>
            <h1 className="auth-title-new">Link Invalid or Expired</h1>
            <p className="auth-subtitle">
              This password reset link is no longer valid. Please request a new
              one.
            </p>
            <Link to="/forgot-password" className="auth-btn-new">
              Request a new link
            </Link>
            <div className="auth-footer-new">
              <Link to="/login" className="auth-link-small">
                Back to login
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="auth-title-new">Set New Password</h1>
            <p className="auth-subtitle">
              Enter a new password for your account.
            </p>
            <form onSubmit={handleSubmit} className="auth-form-new">
              {error && <div className="auth-error">{error}</div>}
              <div className="auth-field">
                <div className="auth-password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="auth-input"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <IconEyeOff size={20} />
                    ) : (
                      <IconEye size={20} />
                    )}
                  </button>
                </div>
              </div>
              <div className="auth-field">
                <div className="auth-password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="auth-input"
                    placeholder="Confirm new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="auth-btn-new"
                disabled={submitting}
              >
                {submitting ? "Updating…" : "Update Password"}
              </button>
            </form>
            <div className="auth-footer-new">
              <Link to="/login" className="auth-link-small">
                Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
