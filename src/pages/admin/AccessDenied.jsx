import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { landingPathForRole } from "../../lib/permissions";

// 403 shown when a signed-in staff member opens an admin section their role
// does not cover. Reuses the shared empty-page styling so it matches the theme.
export default function AccessDenied() {
  const { profile } = useAuth();

  return (
    <div className="empty-page" role="alert">
      <h2 className="access-denied__title">Access Denied</h2>
      <p className="empty-state">
        You do not have permission to view this page.
      </p>
      <Link to={landingPathForRole(profile?.role)} className="btn btn-primary">
        Back to Orders
      </Link>
    </div>
  );
}
