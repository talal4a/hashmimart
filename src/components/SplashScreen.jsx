import { useEffect, useState } from "react";

// First-load splash screen that shows the brand logo with a subtle fade, then dismisses.
export default function SplashScreen() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const showFor = reduce ? 400 : 1600;
    const hideTimer = setTimeout(() => setHidden(true), showFor);
    const removeTimer = setTimeout(() => setRemoved(true), showFor + 450);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (removed) return null;

  return (
    <div
      className={`splash ${hidden ? "splash--hidden" : ""}`}
      aria-hidden="true"
    >
      <div className="splash__inner">
        <img
          className="splash__logo"
          src="/logo-black.png"
          alt="Hashmi"
          width="160"
          height="107"
          fetchPriority="high"
        />
      </div>
    </div>
  );
}
