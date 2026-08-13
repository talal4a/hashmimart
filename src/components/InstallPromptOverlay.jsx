import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AppWindow,
  ArrowRight,
  Download,
  MonitorSmartphone,
  Share,
  Smartphone,
  X,
} from "lucide-react";

// Shown once per browser session (per tab) so it reappears on each new visit.
const SESSION_KEY = "hashmi-install-prompt-session";
// Set once the app is installed, so we never nag again on that browser.
const INSTALLED_KEY = "hashmi-install-prompt-installed";

function detectPlatform() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Mobi/i.test(ua)) return "unknown";
  return "desktop";
}

function isStandalone() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true)
  );
}

function safeGet(key) {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
}

const COPY = {
  android: {
    badge: "Android",
    title: "Install the Hashmi Mart app",
    icon: Smartphone,
    installSteps: [
      "Tap “Install App” below — a confirmation appears.",
      "Tap “Install” again and the app lands on your home screen.",
      "Open it from your home screen — it runs full-screen, like a native app.",
    ],
    manualSteps: [
      "Open the ⋮ menu in the top-right corner of Chrome.",
      'Tap "Add to Home screen" (or "Install app").',
      'Tap "Install" to confirm — the app appears on your home screen.',
    ],
    note: "Free, takes a few seconds, and works even with a weak connection. No Play Store needed.",
  },
  ios: {
    badge: "iPhone / iPad",
    title: "Add Hashmi Mart to your Home Screen",
    icon: Share,
    manualSteps: [
      "Tap the Share button (square with an up arrow) at the bottom of Safari.",
      'Scroll down and tap "Add to Home Screen".',
      'Tap "Add" in the top-right corner — the app appears on your home screen.',
    ],
    note: "Apple requires this step in Safari — it takes about 10 seconds.",
  },
  desktop: {
    badge: "Desktop",
    title: "Install the Hashmi Mart app",
    icon: MonitorSmartphone,
    installSteps: [
      "Tap “Install App” below, or click the install icon in the address bar.",
      "Tap “Install” — the app opens in its own window.",
    ],
    manualSteps: [
      "Click the install icon (monitor with a down arrow) in the address bar.",
      'Click "Install" — the app opens in its own window.',
    ],
    note: "Works in Chrome and Edge on Windows, macOS and Linux.",
  },
  unknown: {
    badge: "Mobile browser",
    title: "Install the Hashmi Mart app",
    icon: AppWindow,
    manualSteps: [
      "Open the browser menu (⋮ or the share icon).",
      'Tap "Add to Home screen" or "Install app".',
      "Confirm — the app appears on your home screen.",
    ],
    note: "For the best experience use Chrome on Android or Safari on iPhone.",
  },
};

export default function InstallPromptOverlay() {
  const [open, setOpen] = useState(false);
  // Client-only app, so detectPlatform() runs in the browser on first render.
  const [platform] = useState(() => detectPlatform());
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    // Already running as an installed app → never nag.
    if (isStandalone()) return;
    // Once per browser session; and never after a real install.
    if (safeGet(SESSION_KEY) || safeGet(INSTALLED_KEY)) return;

    const onPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      safeSet(INSTALLED_KEY, "1");
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Let the splash screen finish before the prompt slides in.
    const timer = window.setTimeout(() => setOpen(true), 1800);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  const askToInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      safeSet(INSTALLED_KEY, "1");
      setOpen(false);
    } else {
      dismiss();
    }
  }, [installPrompt, dismiss]);

  // Escape closes + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, dismiss]);

  if (!open) return null;

  const c = COPY[platform] ?? COPY.unknown;
  const canInstall = platform === "android" || platform === "desktop";
  const showInstallButton = canInstall && installPrompt !== null;
  const steps = showInstallButton ? c.installSteps : c.manualSteps;
  const Icon = c.icon;

  const modalContent = (
    <div
      className="install-prompt__overlay"
      onClick={dismiss}
      role="presentation"
    >
      <div
        className="install-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="install-prompt__close"
          aria-label="Close"
          onClick={dismiss}
        >
          <X size={18} />
        </button>

        <div className="install-prompt__head">
          <span className="install-prompt__icon">
            <Icon size={24} />
          </span>
          <div>
            <p className="install-prompt__badge">{c.badge}</p>
            <h2 id="install-prompt-title" className="install-prompt__title">
              {c.title}
            </h2>
          </div>
        </div>

        <ol className="install-prompt__steps">
          {steps.map((step, i) => (
            <li key={step} className="install-prompt__step">
              <span className="install-prompt__step-num">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <p className="install-prompt__note">{c.note}</p>

        <div className="install-prompt__actions">
          {showInstallButton ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={askToInstall}
            >
              <Download size={18} />
              Install App
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={dismiss}
            >
              Got it
              <ArrowRight size={18} />
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={dismiss}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
