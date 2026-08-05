import { useEffect } from "react";
import confetti from "canvas-confetti";

/* Metallic & bright glitter — gold, silver, platinum, hot pink, cyan, orange. */
const GLITTER_COLORS = [
  "#FFD700",
  "#C0C0C0",
  "#E5E4E2",
  "#FF69B4",
  "#00FFFF",
  "#FF4500",
];

/* Party-popper celebration that covers the whole screen:
   1. Center high-velocity burst
   2. Side cannons from the left & right corners
   3. A slow glitter shower drifting down for ~3 seconds
   Fires once on mount. Respects prefers-reduced-motion, cancels every timer
   and canvas on unmount, and works under StrictMode (cleanup → re-fire). */
export default function Celebration() {
  useEffect(() => {
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (reducedMotion) return;

    const timers = [];

    // 1. Center high-velocity party popper burst
    confetti({
      particleCount: 120,
      spread: 100,
      startVelocity: 60,
      origin: { y: 0.6 },
      colors: GLITTER_COLORS,
      ticks: 300,
      gravity: 0.8,
      drift: 0,
      scalar: 1.2,
    });

    // 2. Side cannon angle bursts (left + right corners)
    timers.push(
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#FFD700", "#FFA500", "#FFFFFF"],
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#FFD700", "#FFA500", "#FFFFFF"],
        });
      }, 150),
    );

    // 3. Continuous glitter shower from the top for ~3 seconds
    const end = Date.now() + 3 * 1000;
    let rafId;
    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 90,
        spread: 180,
        origin: { y: 0 },
        colors: GLITTER_COLORS,
        ticks: 200,
        gravity: 0.5,
        drift: 0.2,
      });
      if (Date.now() < end) {
        rafId = requestAnimationFrame(frame);
      }
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      timers.forEach((t) => clearTimeout(t));
      if (rafId) cancelAnimationFrame(rafId);
      confetti.reset();
    };
  }, []);

  return null;
}
