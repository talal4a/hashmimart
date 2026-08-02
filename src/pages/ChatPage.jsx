import { useEffect, useRef, useState } from "react";
import useChatRoom from "../hooks/useChatRoom";
import useVoiceRecorder from "../hooks/useVoiceRecorder";
import { useChat } from "../context/ChatContext";
import {
  IconMessage,
  IconCheck,
  IconCheckAll,
  IconMic,
} from "../components/Icons";
import VoiceMessage from "../components/VoiceMessage";
import { uploadVoice } from "../lib/uploadVoice";

const MAX_LENGTH = 500;

function ChatBubble({ message, isOwn, onRemoveMessage }) {
  const isRead = message.is_read;
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString("en-PK", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={`chat-bubble ${isOwn ? "chat-bubble--own" : "chat-bubble--other"}`}
    >
      {message.message_type === "voice" ? (
        <VoiceMessage
          voiceUrl={message.voice_url}
          duration={message.voice_duration}
          isOwn={isOwn}
          onRemove={onRemoveMessage}
        />
      ) : (
        <div className="chat-bubble-text">{message.message || ""}</div>
      )}
      <div className="chat-bubble-meta">
        <span className="chat-bubble-time">{time}</span>
        {isOwn && (
          <span className="chat-bubble-status">
            {isRead ? <IconCheckAll size={14} /> : <IconCheck size={14} />}
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonBubble({ isOwn }) {
  return (
    <div
      className={`chat-bubble chat-bubble--skeleton ${isOwn ? "chat-bubble--own" : "chat-bubble--other"}`}
    >
      <div className="skeleton-line skeleton-line--short" />
      <div className="skeleton-line skeleton-line--long" />
      <div className="skeleton-line skeleton-line--time" />
    </div>
  );
}

export default function ChatPage({
  conversationType,
  title,
  subtitle = null,
  placeholder = "Type your message...",
  emptyText = "Start a conversation.",
  emptyHelper = null,
}) {
  const {
    conversation,
    messages,
    getConversation,
    getMessages,
    sendMessage,
    removeMessage,
    markAsRead,
    subscribeToMessages,
    unsubscribe,
  } = useChatRoom(conversationType);

  const { connectionState, resetUnreadCount } = useChat();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState(null);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const {
    state: voiceState,
    duration: voiceDuration,
    error: voiceError,
    startRecording,
    stopRecording,
    cancelRecording,
    getBlob,
    formatDuration,
  } = useVoiceRecorder();

  const getConversationRef = useRef(getConversation);
  const getMessagesRef = useRef(getMessages);

  useEffect(() => {
    getConversationRef.current = getConversation;
    getMessagesRef.current = getMessages;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const conv = await getConversationRef.current();
        if (cancelled || !conv) return;
        await getMessagesRef.current(conv);
      } catch (err) {
        console.error(`Failed to load ${conversationType} chat`, err);
        if (!cancelled) setInitError(err.message || "Failed to load chat");
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationType]);

  useEffect(() => {
    if (conversation) {
      subscribeToMessages();
    }
    return () => unsubscribe();
  }, [conversation, subscribeToMessages, unsubscribe]);

  useEffect(() => {
    if (!initLoading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, initLoading]);

  useEffect(() => {
    if (conversation && messages.length > 0) {
      markAsRead();
      resetUnreadCount(conversationType);
    }
  }, [
    conversation,
    messages.length,
    markAsRead,
    resetUnreadCount,
    conversationType,
  ]);

  useEffect(() => {
    if (!initLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [initLoading]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendMessage(trimmed);
      setText("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartVoice = async () => {
    cancelRecording();
    await startRecording();
  };

  const handleStopVoice = () => {
    stopRecording();
    const blob = getBlob();
    setVoiceBlob(blob);
  };

  const handleCancelVoice = () => {
    cancelRecording();
    setVoiceBlob(null);
  };

  const handleSendVoice = async () => {
    if (voiceUploading || !voiceBlob) return;
    setVoiceUploading(true);
    try {
      const voiceUrl = await uploadVoice(voiceBlob, conversationType);
      await sendMessage({ type: "voice", voiceUrl, duration: voiceDuration });
      setVoiceBlob(null);
    } catch (err) {
      console.error("Failed to send voice message", err);
    } finally {
      setVoiceUploading(false);
    }
  };

  if (initLoading) {
    return (
      <div className="support-chat-page">
        <div className="chat-topbar">
          <div className="chat-topbar-info">
            <h2>{title}</h2>
          </div>
        </div>
        <div className="chat-messages">
          <SkeletonBubble isOwn={false} />
          <SkeletonBubble isOwn={false} />
          <SkeletonBubble isOwn />
          <SkeletonBubble isOwn={false} />
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="support-chat-page">
        <div className="chat-topbar">
          <div className="chat-topbar-info">
            <h2>{title}</h2>
          </div>
        </div>
        <div className="chat-messages">
          <div className="chat-empty">
            <p className="chat-empty-text chat-empty-text--error">
              {initError}
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="support-chat-page">
      {connectionState === "disconnected" && (
        <div className="chat-connection-banner">
          Connection lost. Reconnecting...
        </div>
      )}

      <div className="chat-topbar">
        <div className="chat-topbar-info">
          <h2>{title}</h2>
          {subtitle && <span className="chat-timestamp">{subtitle}</span>}
          <div className="chat-online">
            <span
              className={`chat-online-dot ${connectionState === "disconnected" ? "chat-online-dot--offline" : ""}`}
            />
            <span>
              {connectionState === "disconnected" ? "Offline" : "Online"}
            </span>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <IconMessage size={40} />
            </div>
            <p className="chat-empty-text">{emptyText}</p>
            {emptyHelper}
          </div>
        ) : (
          messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_role === "user"}
              onRemoveMessage={removeMessage}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
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
              onClick={handleCancelVoice}
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
        ) : voiceState === "stopped" && voiceBlob ? (
          <div className="chat-voice-preview">
            <span className="chat-voice-preview-label">
              {formatDuration(voiceDuration)}
            </span>
            <button
              type="button"
              className="chat-voice-btn chat-voice-btn--send"
              disabled={voiceUploading}
              onClick={handleSendVoice}
              aria-label="Send voice message"
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
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {voiceUploading && <span className="chat-voice-spinner" />}
            </button>
            <button
              type="button"
              className="chat-voice-btn chat-voice-btn--cancel"
              disabled={voiceUploading}
              onClick={handleCancelVoice}
              aria-label="Discard voice message"
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
        ) : voiceState === "error" ? (
          <div className="chat-voice-error">
            <span className="chat-voice-error-text">{voiceError}</span>
            <button
              type="button"
              className="chat-voice-btn chat-voice-btn--cancel"
              onClick={cancelRecording}
              aria-label="Dismiss"
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
          <div className="chat-input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MAX_LENGTH}
              rows={1}
            />
            <div className="chat-input-footer">
              <button
                type="button"
                className="chat-voice-btn chat-voice-btn--mic"
                onClick={handleStartVoice}
                aria-label="Record voice message"
              >
                <IconMic size={18} />
              </button>
              <span className="chat-char-count">
                {text.length}/{MAX_LENGTH}
              </span>
              <button
                type="button"
                className="chat-send-btn"
                disabled={!text.trim() || sending}
                onClick={handleSend}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
