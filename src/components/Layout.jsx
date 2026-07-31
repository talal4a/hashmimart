import { useLocation, useNavigationType } from "react-router-dom";
import Header from "./Header";
import BottomNavigation from "./BottomNavigation";
import Toast from "./Toast";
import { useStore } from "../context/StoreContext";

export default function Layout({ title, showBack, backTo, children }) {
  const location = useLocation();
  const navType = useNavigationType();
  const { toast, setToast } = useStore();
  // PUSH → moving deeper (slide in from right); POP → going back (slide in from
  // left); REPLACE → neutral fade. Keyed on location.key so it re-runs per nav.
  const direction =
    navType === "POP" ? "back" : navType === "PUSH" ? "forward" : "neutral";

  return (
    <div className="app-shell">
      <Header title={title} showBack={showBack} backTo={backTo} />
      <main className="main-content">
        <div
          className="page-wrapper"
          data-direction={direction}
          key={location.key}
        >
          {children}
        </div>
      </main>
      <BottomNavigation />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
