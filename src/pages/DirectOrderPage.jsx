import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useVoiceRecorder from "../hooks/useVoiceRecorder";
import { useStore } from "../context/StoreContext";
import { IconMic } from "../components/Icons";
import { transcribeOrderVoice } from "../lib/orderTranscription";

const MAX_CHARS = 1000;
const EXAMPLE = "2 kg sugar\n1 dozen eggs\n1 pack Tapal Danedar tea";

/* Direct Order: the customer says (or types) what they need. Speech is
   turned into text they can read and fix before sending — staff then work
   from the written list instead of listening to a recording. */
export default function DirectOrderPage() {
  const navigate = useNavigate();
  const { directOrderText, setDirectOrderText } = useStore();
  const [text, setText] = useState(directOrderText);
  const [transcribing, setTranscribing] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'error' | 'info', text }
  const textareaRef = useRef(null);

  // Append whatever was heard to the list, on its own line.
  const handleRecording = useCallback(async (blob) => {
    if (!blob || blob.size === 0) {
      setNotice({ type: "error", text: "Didn't catch that — please try again." });
      return;
    }
    setTranscribing(true);
    setNotice(null);
    try {
      const heard = await transcribeOrderVoice(blob);
      if (!heard) {
        setNotice({
          type: "error",
          text: "Couldn't hear any items. Try again closer to the mic, or type your list.",
        });
        return;
      }
      setText((prev) =>
        (prev.trim() ? `${prev.trimEnd()}\n${heard}` : heard).slice(0, MAX_CHARS),
      );
      setNotice({
        type: "info",
        text: "Here's what we heard — check it and fix anything before you continue.",
      });
      // Put the cursor at the end so a quick correction is one tap away.
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus({ preventScroll: true });
        el.setSelectionRange(el.value.length, el.value.length);
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: `${err.message || "Voice to text failed."} You can type your list instead.`,
      });
    } finally {
      setTranscribing(false);
    }
  }, []);

  const {
    state: voiceState,
    duration,
    error: recorderError,
    startRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
  } = useVoiceRecorder({ onStop: handleRecording });

  const isRecording = voiceState === "recording";

  useEffect(() => {
    if (voiceState === "error" && recorderError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice({
        type: "error",
        text: `${recorderError}. You can type your list instead.`,
      });
    }
  }, [voiceState, recorderError]);

  // Keep the store copy in sync so the list survives leaving the page.
  useEffect(() => {
    setDirectOrderText(text);
  }, [text, setDirectOrderText]);

  const handleMic = () => {
    if (transcribing) return;
    if (isRecording) {
      stopRecording(); // onStop → handleRecording
    } else {
      setNotice(null);
      startRecording();
    }
  };

  const trimmed = text.trim();
  const canContinue = trimmed.length > 0 && !isRecording && !transcribing;

  const handleContinue = () => {
    if (!canContinue) return;
    setDirectOrderText(trimmed);
    navigate("/checkout?mode=direct");
  };

  let micLabel = "Tap to speak your order";
  if (isRecording) micLabel = "Listening… tap to stop";
  else if (transcribing) micLabel = "Turning your voice into text…";

  return (
    <div className="direct-order-page">
      <header className="direct-order-intro">
        <h1 className="direct-order-title">Tell us what you need</h1>
        <p className="direct-order-subtitle">
          Speak in Urdu or English and we'll write it down — or just type your
          list. Our team prices it and confirms before delivery.
        </p>
      </header>

      <div className="direct-order-mic-area">
        <button
          type="button"
          className={`direct-order-mic ${isRecording ? "direct-order-mic--recording" : ""} ${transcribing ? "direct-order-mic--busy" : ""}`}
          onClick={handleMic}
          disabled={transcribing}
          aria-label={micLabel}
        >
          {transcribing ? (
            <span className="direct-order-spinner" aria-hidden="true" />
          ) : isRecording ? (
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <IconMic size={34} />
          )}
        </button>
        <p className="direct-order-mic-label" aria-live="polite">
          {micLabel}
          {isRecording && (
            <span className="direct-order-timer">
              {" "}
              · {formatDuration(duration)}
            </span>
          )}
        </p>
        {isRecording && (
          <button
            type="button"
            className="direct-order-cancel"
            onClick={cancelRecording}
          >
            Cancel
          </button>
        )}
      </div>

      {notice && (
        <p
          className={`direct-order-notice direct-order-notice--${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      )}

      <div className="direct-order-field">
        <div className="direct-order-field-head">
          <label htmlFor="direct-order-text" className="direct-order-label">
            Your order list
          </label>
          {text && !isRecording && !transcribing && (
            <button
              type="button"
              className="direct-order-clear"
              onClick={() => {
                setText("");
                setNotice(null);
              }}
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          id="direct-order-text"
          ref={textareaRef}
          className="direct-order-textarea"
          rows={7}
          maxLength={MAX_CHARS}
          placeholder={`For example:\n${EXAMPLE}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={transcribing}
        />
        <span className="direct-order-count">
          {text.length}/{MAX_CHARS}
        </span>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block direct-order-continue"
        onClick={handleContinue}
        disabled={!canContinue}
      >
        Continue to Checkout
      </button>
    </div>
  );
}
