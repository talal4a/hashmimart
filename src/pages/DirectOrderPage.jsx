import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useVoiceRecorder from "../hooks/useVoiceRecorder";
import { useStore } from "../context/StoreContext";
import { IconMic } from "../components/Icons";

export default function DirectOrderPage() {
  const navigate = useNavigate();
  const { setVoiceOrderAudio, setVoiceOrderAddress } = useStore();
  const bottomRef = useRef(null);

  const {
    state: voiceState,
    duration: voiceDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    getBlob,
    formatDuration,
  } = useVoiceRecorder();

  // step 0: waiting for audio
  // step 1: audio recorded, waiting for address
  // step 2: address entered, ready to checkout
  const [step, setStep] = useState(0);
  
  const [addressInput, setAddressInput] = useState(() => {
    try {
      const stored = localStorage.getItem("hashmi_saved_addresses");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) return parsed[0].address;
      }
    } catch (err) {
      console.error(err);
    }
    return "";
  });

  const [savedAddresses] = useState(() => {
    try {
      const stored = localStorage.getItem("hashmi_saved_addresses");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  });
  
  const [showAddressPreview, setShowAddressPreview] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: "bot-1",
      sender: "bot",
      type: "text",
      content:
        "Welcome to Direct Order! Please tap the microphone to record a voice note of the items you need.",
      time: new Date(),
    },
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, voiceState]);

  const handleStartVoice = async () => {
    cancelRecording();
    await startRecording();
  };

  const handleStopVoice = () => {
    stopRecording();
    const blob = getBlob();
    if (blob) {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-audio-${Date.now()}`,
          sender: "user",
          type: "audio",
          blob: blob,
          time: new Date(),
        },
      ]);
      setStep(1);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-2-${Date.now()}`,
            sender: "bot",
            type: "text",
            content:
              "Got it! Now, please type your full delivery address below.",
            time: new Date(),
          },
        ]);
      }, 500);
    }
  };

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    const trimmed = addressInput.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `user-text-${Date.now()}`,
        sender: "user",
        type: "text",
        content: trimmed,
        time: new Date(),
      },
    ]);
    setAddressInput("");
    setStep(2);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-3-${Date.now()}`,
          sender: "bot",
          type: "text",
          content:
            "Perfect! Click the button below to proceed to checkout and finalize your order.",
          time: new Date(),
        },
      ]);
    }, 500);
  };

  const handleProceed = () => {
    const blob = getBlob();
    const address = messages
      .slice()
      .reverse()
      .find((m) => m.sender === "user" && m.type === "text")?.content;

    if (blob) {
      setVoiceOrderAudio(blob);
      setVoiceOrderAddress(address || "");
      navigate("/checkout");
    }
  };

  return (
    <div className="support-chat-page">
      <div className="chat-topbar">
        <div className="chat-topbar-info">
          <h2>Direct Order</h2>
          <span className="chat-timestamp">Voice Ordering Assistant</span>
          <div className="chat-online">
            <span className="chat-online-dot" />
            <span>Online</span>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble ${msg.sender === "user" ? "chat-bubble--own" : "chat-bubble--other"}`}
          >
            {msg.type === "text" ? (
              <div className="chat-bubble-text">{msg.content}</div>
            ) : msg.type === "audio" ? (
              <audio
                controls
                src={URL.createObjectURL(msg.blob)}
                style={{ width: "200px", height: "40px" }}
              />
            ) : null}
            <div className="chat-bubble-meta">
              <span className="chat-bubble-time">
                {msg.time.toLocaleTimeString("en-PK", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}
        {step === 2 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "1rem",
            }}
          >
            <button
              type="button"
              className="btn btn--primary"
              style={{
                padding: "0.75rem 2rem",
                borderRadius: "999px",
                fontSize: "1rem",
                background: "#22c55e",
              }}
              onClick={handleProceed}
            >
              Proceed to Checkout
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        {step === 0 && (
          <>
            {voiceState === "recording" ? (
              <div className="chat-voice-recording">
                <span className="chat-voice-recording-indicator" />
                <span className="chat-voice-recording-label">
                  {formatDuration(voiceDuration)}
                </span>
                <button
                  type="button"
                  className="chat-voice-btn chat-voice-btn--stop"
                  onClick={handleStopVoice}
                  aria-label="Stop recording"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="chat-voice-btn chat-voice-btn--cancel"
                  onClick={cancelRecording}
                  aria-label="Cancel recording"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                className="chat-input-wrapper"
                style={{ justifyContent: "center" }}
              >
                <button
                  type="button"
                  className="btn btn--primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    borderRadius: "999px",
                    padding: "0.75rem 1.5rem",
                  }}
                  onClick={handleStartVoice}
                >
                  <IconMic size={20} />
                  Start Recording Order
                </button>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <form className="chat-input-wrapper" style={{ position: "relative" }} onSubmit={handleAddressSubmit}>
            <input
              type="text"
              className="chat-input"
              style={{ flex: 1, padding: "0.75rem" }}
              placeholder="Enter your delivery address..."
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onFocus={() => setShowAddressPreview(true)}
              onBlur={() => setTimeout(() => setShowAddressPreview(false), 200)}
              autoFocus
            />

            {/* Address Preview Dropdown */}
            {showAddressPreview && savedAddresses.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%", // Open upwards since it's at the bottom
                  left: 0,
                  right: 0,
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  boxShadow: "0 -4px 6px -1px rgba(0,0,0,0.1)",
                  zIndex: 10,
                  maxHeight: "200px",
                  overflowY: "auto",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    padding: "0.5rem 0.75rem",
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    fontSize: "0.8rem",
                    fontWeight: "bold",
                    color: "#64748b",
                  }}
                >
                  Recently Used Addresses
                </div>
                {savedAddresses.map((addr, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "0.75rem",
                      cursor: "pointer",
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background-color 0.2s",
                      textAlign: "left",
                    }}
                    onMouseDown={() => {
                      setAddressInput(addr.address);
                      setShowAddressPreview(false);
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#f1f5f9")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: "500",
                        color: "#334155",
                      }}
                    >
                      {addr.address}
                    </div>
                    {addr.society && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          marginTop: "0.2rem",
                        }}
                      >
                        Society: {addr.society}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              className="chat-send-btn"
              disabled={!addressInput.trim()}
            >
              Send
            </button>
          </form>
        )}

        {step === 2 && (
          <div
            className="chat-input-wrapper"
            style={{
              justifyContent: "center",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Order details collected. Please proceed to checkout.
          </div>
        )}
      </div>
    </div>
  );
}
