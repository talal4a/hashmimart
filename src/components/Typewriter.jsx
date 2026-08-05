import { useEffect, useRef, useState } from "react";

/**
 * Lightweight typewriter — types, pauses, deletes, then cycles to the next
 * phrase (the classic "Typing and Deleting" effect). No library: a single
 * chained timeout, so it costs nothing on low-end phones.
 *
 * Accessibility / battery:
 *  - Under `prefers-reduced-motion` it renders the first phrase statically
 *    (no typing, no blinking cursor, no timers).
 *  - The typed text is aria-hidden; the parent heading should carry the full
 *    text as an aria-label so screen readers get the complete phrase.
 */
export default function Typewriter({
  phrases,
  typingMs = 40,
  deletingMs = 22,
  holdMs = 1600,
  cursorClassName = "typewriter-cursor",
}) {
  /* Start one character in so the heading reads as "mid-type" from frame one
     (no empty-heading flash before the first tick). */
  const [text, setText] = useState(() => phrases[0]?.[0] ?? "");
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
  );
  const phraseIdx = useRef(0);
  const mode = useRef("type"); // "type" | "hold" | "delete"

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || phrases.length === 0) {
      return undefined; // static phrase rendered below — no typing, no timers
    }

    const phrase = phrases[phraseIdx.current % phrases.length];
    let timer;

    const tick = () => {
      if (mode.current === "type") {
        if (text.length < phrase.length) {
          setText(phrase.slice(0, text.length + 1));
          timer = setTimeout(tick, typingMs);
        } else {
          mode.current = "hold";
          timer = setTimeout(tick, holdMs);
        }
      } else if (mode.current === "hold") {
        mode.current = "delete";
        timer = setTimeout(tick, 30);
      } else if (text.length > 0) {
        setText(text.slice(0, -1));
        timer = setTimeout(tick, deletingMs);
      } else {
        phraseIdx.current += 1;
        mode.current = "type";
        timer = setTimeout(tick, 220);
      }
    };

    timer = setTimeout(tick, typingMs);
    return () => clearTimeout(timer);
  }, [text, reducedMotion, phrases, typingMs, deletingMs, holdMs]);

  const shown = reducedMotion ? (phrases[0] ?? "") : text;

  return (
    <span className="typewriter" aria-hidden="true">
      {shown}
      {!reducedMotion && (
        <span className={cursorClassName} aria-hidden="true">
          |
        </span>
      )}
    </span>
  );
}
