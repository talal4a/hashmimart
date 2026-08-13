import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const SUPPORT_EMAIL = "support@hashminetwork.com";

const DELETED_ITEMS = [
  "Your account and login credentials",
  "Your profile (name, phone number, delivery addresses)",
  "Your wishlist and saved items",
  "Your chat and support conversations",
  "Voice notes you recorded for voice orders",
  "Your order history and notifications",
];

export default function DeleteAccountPage() {
  const { logOut } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | deleting | deleted | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleDelete = async () => {
    if (!confirmed || status === "deleting") return;
    setStatus("deleting");
    setErrorMsg("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("no-session");

      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "request-failed");
      }

      // The account is gone server-side; clear the local session.
      try {
        await logOut();
      } catch {
        /* session already invalid — fine */
      }
      setStatus("deleted");
    } catch {
      setStatus("error");
      setErrorMsg(
        `We couldn't complete the deletion right now. Please try again, or email ${SUPPORT_EMAIL} with the subject “Delete my account” from your registered email address.`
      );
    }
  };

  return (
    <Layout title="Delete Account" showBack backTo="/">
      <div className="legal-page">
        <header className="legal-page__header">
          <p>
            We&apos;re sorry to see you go. This page explains what deleting
            your Hashmi Mart account means, what happens to your data, and how
            to submit a deletion request.
          </p>
        </header>

        <h2>What account deletion means</h2>
        <p>
          When you delete your account, your access to the app ends and we
          begin removing your personal data from our systems. This includes:
        </p>
        <ul>
          {DELETED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2>What may be retained</h2>
        <p>
          Certain records may need to be kept for a limited time to comply with
          legal, tax and accounting obligations (for example, records related
          to past orders).{" "}
          <span className="legal-page__placeholder">
            Retention period: to be confirmed by the operator
          </span>{" "}
          — any retained data is not used for any other purpose.
        </p>

        <h2>How long does it take?</h2>
        <p>
          Deletion requests are processed as soon as we can verify the request.{" "}
          <span className="legal-page__placeholder">
            Expected processing time: to be confirmed by the operator
          </span>{" "}
          — you&apos;ll receive a confirmation once your account and data have
          been removed.
        </p>

        {status === "deleted" ? (
          <div className="delete-account__success">
            <p className="delete-account__success-title">
              Your deletion request has been processed.
            </p>
            <p>
              Your account and personal data have been removed from our systems,
              except for records we are legally required to keep. If you have
              any questions, contact{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
            <Link to="/" className="btn btn-primary delete-account__success-link">
              Back to home
            </Link>
          </div>
        ) : (
          <>
            <h2>Request deletion</h2>
            <p>
              Deleting your account is permanent and cannot be undone. Please
              confirm that you understand before continuing.
            </p>

            <label className="delete-account__confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                I understand that deleting my account is permanent and that my
                account, profile and personal data will be removed in line with
                the{" "}
                <Link to="/privacy-policy">Privacy Policy</Link>.
              </span>
            </label>

            {status === "error" && (
              <p className="delete-account__error">{errorMsg}</p>
            )}

            <div className="delete-account__actions">
              <button
                type="button"
                className="btn btn-danger"
                disabled={!confirmed || status === "deleting"}
                onClick={handleDelete}
              >
                {status === "deleting" ? "Deleting…" : "Delete my account"}
              </button>
            </div>

            <p className="legal-page__muted">
              Not sure yet? Read the{" "}
              <Link to="/terms">Terms &amp; Conditions</Link> or the{" "}
              <Link to="/privacy-policy">Privacy Policy</Link> first.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
