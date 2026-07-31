import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import {
  IconMessage,
  IconCheck,
  IconCheckAll,
  IconMic,
} from "../../components/Icons";
import useVoiceRecorder from "../../hooks/useVoiceRecorder";
import VoiceMessage from "../../components/VoiceMessage";
import { uploadVoice } from "../../lib/uploadVoice";
import { removeOrphanedVoiceMessages } from "../../lib/voiceUtils";

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

function ConversationItem({ conv, isActive, unreadCount, onClick }) {
  const lastMsg = conv.last_message;
  return (
    <button
      type="button"
      className={`admin-chat-conv ${isActive ? "admin-chat-conv--active" : ""}`}
      onClick={onClick}
    >
      <div className="admin-chat-conv-top">
        <span className="admin-chat-conv-name">
          {conv.user_name || "Unknown User"}
        </span>
        {lastMsg && (
          <span className="admin-chat-conv-time">
            {new Date(lastMsg.created_at).toLocaleTimeString("en-PK", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
      <div className="admin-chat-conv-bottom">
        <span className="admin-chat-conv-preview">
          {lastMsg
            ? (lastMsg.message || "").slice(0, 50) || "Voice message"
            : "No messages yet"}
        </span>
        {unreadCount > 0 && <span className="filter-badge">{unreadCount}</span>}
      </div>
      <span className="admin-chat-conv-email">
        {conv.user_phone || "No phone number"}
      </span>
    </button>
  );
}

export default function AdminChatPanel({ conversationType = "support" }) {
  const { user, profile } = useAuth();
  const myRole = profile?.role;
  const { connectionState } = useChat();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [search, setSearch] = useState("");
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const bottomRef = useRef(null);
  const channelRef = useRef(null);
  const convChannelRef = useRef(null);
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

  const selectedConv = conversations.find((c) => c.id === selectedId);

  const unreadCounts = useMemo(() => {
    const map = {};
    conversations.forEach((c) => {
      map[c.id] = c.unread_count || 0;
    });
    return map;
  }, [conversations]);

  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const { data: convs, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("conversation_type", conversationType)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const convWithMeta = await Promise.all(
        (convs || []).map(async (conv) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", conv.user_id)
            .maybeSingle();

          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .eq("is_read", false)
            .eq("sender_role", "user");

          const { data: lastMsg } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1);

          return {
            ...conv,
            user_name: profile?.full_name || "Unknown",
            user_phone: profile?.phone || "",
            unread_count: count || 0,
            last_message: lastMsg?.[0] || null,
          };
        }),
      );

      setConversations(convWithMeta);
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    } finally {
      setLoadingConvs(false);
    }
  }, [conversationType]);

  const fetchMessages = useCallback(async (convId) => {
    if (!convId) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch messages", error);
      return;
    }
    const raw = data || [];
    // Background: remove orphaned voice messages (file deleted from Storage)
    const checked = await removeOrphanedVoiceMessages(raw);
    if (checked.length < raw.length) {
      setMessages(checked);
    } else {
      setMessages(raw);
    }
  }, []);

  const markAsRead = useCallback(async (convId) => {
    if (!convId) return;
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", convId)
      .eq("is_read", false);

    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c)),
    );
  }, []);

  const subscribeToConv = useCallback(
    (convId) => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`admin-chat:${convId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${convId}`,
          },
          async (payload) => {
            if (import.meta.env.DEV)
              console.log(
                "[Realtime] Admin INSERT payload received:",
                payload.new.id,
              );
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              const map = new Map();
              for (const m of prev) map.set(m.id, m);
              map.set(payload.new.id, payload.new);
              return [...map.values()].sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at),
              );
            });
            fetchConversations();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${convId}`,
          },
          (payload) => {
            if (import.meta.env.DEV)
              console.log(
                "[Realtime] Admin UPDATE payload received:",
                payload.new.id,
              );
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.new.id
                  ? { ...m, is_read: payload.new.is_read }
                  : m,
              ),
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${convId}`,
          },
          (payload) => {
            if (import.meta.env.DEV)
              console.log(
                "[Realtime] Admin DELETE payload received:",
                payload.old.id,
              );
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          },
        )
        .subscribe((status) => {
          if (import.meta.env.DEV)
            console.log(`[Realtime] admin-chat:${convId} status:`, status);
        });

      channelRef.current = channel;
    },
    [fetchConversations],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConversations();

    const convChannel = supabase
      .channel(`admin-new-convs-${conversationType}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
          filter: `conversation_type=eq.${conversationType}`,
        },
        () => {
          if (import.meta.env.DEV)
            console.log(
              "[Realtime] New conversation detected, refreshing list",
            );
          fetchConversations();
        },
      )
      .subscribe((status) => {
        if (import.meta.env.DEV)
          console.log(
            `[Realtime] admin-new-convs-${conversationType} status:`,
            status,
          );
      });

    convChannelRef.current = convChannel;

    return () => {
      if (convChannel) {
        supabase.removeChannel(convChannel);
      }
    };
  }, [fetchConversations, conversationType]);

  useEffect(() => {
    if (selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchMessages(selectedId);
      subscribeToConv(selectedId);
      markAsRead(selectedId);
    }
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [selectedId, fetchMessages, subscribeToConv, markAsRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessageInternal = useCallback(
    async (payload) => {
      if (!selectedId || !user) throw new Error("No conversation selected");

      const insertPayload = {
        conversation_id: selectedId,
        sender_id: user.id,
        sender_role: myRole,
        ...payload,
      };

      const { data, error } = await supabase
        .from("messages")
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedId);

      setMessages((prev) => {
        const map = new Map();
        for (const m of prev) map.set(m.id, m);
        map.set(data.id, data);
        return [...map.values()].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at),
        );
      });
      fetchConversations();
      return data;
    },
    [selectedId, user, myRole, fetchConversations],
  );

  const removeMessage = useCallback(
    async (voiceUrlToRemove) => {
      if (!voiceUrlToRemove) return;
      setMessages((prev) => {
        const target = prev.find((m) => m.voice_url === voiceUrlToRemove);
        if (target) {
          supabase
            .from("messages")
            .delete()
            .eq("id", target.id)
            .then(({ error }) => {
              if (error)
                console.warn(
                  "[AdminChatPanel] DB delete failed:",
                  error.message,
                );
            });
        }
        return prev.filter((m) => m.voice_url !== voiceUrlToRemove);
      });
      fetchConversations();
    },
    [fetchConversations],
  );

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !selectedId || !user) return;
    setSending(true);
    try {
      await sendMessageInternal({ message: trimmed.slice(0, MAX_LENGTH) });
      setText("");
    } catch (err) {
      console.error("Failed to send", err);
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
    if (voiceUploading || !voiceBlob || !selectedId) return;
    setVoiceUploading(true);
    try {
      const voiceUrl = await uploadVoice(voiceBlob, conversationType);
      await sendMessageInternal({
        message_type: "voice",
        message: null,
        voice_url: voiceUrl,
        voice_duration: voiceDuration,
      });
      setVoiceBlob(null);
    } catch (err) {
      console.error("Failed to send voice message", err);
    } finally {
      setVoiceUploading(false);
    }
  };

  const filteredConvs = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const name = (c.user_name || "").toLowerCase();
      const phone = (c.user_phone || "").toLowerCase();
      const email = (c.user_email || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [conversations, search]);

  const selectConversation = (id) => {
    setSelectedId(id);
  };

  const goBack = () => setSelectedId(null);

  return (
    <div
      className={`admin-chat-panel ${selectedId ? "admin-chat-panel--chat-open" : ""}`}
    >
      {connectionState === "disconnected" && (
        <div className="chat-connection-banner admin-chat-connection-banner">
          Connection lost. Reconnecting...
        </div>
      )}
      <div className="admin-chat-sidebar">
        <div className="admin-chat-sidebar-header">
          <h3>
            {conversationType === "direct_order"
              ? "Direct Orders"
              : "Conversations"}
          </h3>
        </div>
        <div className="search-box search-box--inset">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-chat-conv-list">
          {loadingConvs ? (
            <div className="empty-page">
              <p className="empty-state">Loading...</p>
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="empty-page">
              <p className="empty-state">
                {search
                  ? "No conversations match your search."
                  : "No conversations yet."}
              </p>
            </div>
          ) : (
            filteredConvs.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === selectedId}
                unreadCount={unreadCounts[conv.id]}
                onClick={() => selectConversation(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="admin-chat-main">
        {!selectedId ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <IconMessage size={40} />
            </div>
            <p className="chat-empty-text">
              Select a conversation to start chatting.
            </p>
          </div>
        ) : (
          <>
            <div className="chat-topbar">
              <div className="chat-topbar-info">
                <button
                  type="button"
                  className="admin-chat-back-btn"
                  onClick={goBack}
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <div>
                  <h2>{selectedConv?.user_name || "Unknown"}</h2>
                  <span className="chat-timestamp">
                    {selectedConv?.user_phone || "No phone number"}
                  </span>
                </div>
              </div>
            </div>

            <div className="chat-messages">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_id === user?.id}
                  onRemoveMessage={removeMessage}
                />
              ))}
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
                    className="chat-input"
                    placeholder="Type your reply..."
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
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
