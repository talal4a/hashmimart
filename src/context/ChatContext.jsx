import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, isStaff } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState({});
  const [connectionState, setConnectionState] = useState("connected");
  const unreadChannelsRef = useRef([]);
  const statusChannelRef = useRef(null);

  // ── Status channel (shared) ──────────────────────────────

  useEffect(() => {
    const channel = supabase.channel("chat-connection").subscribe((status) => {
      if (import.meta.env.DEV)
        console.log("[Realtime] chat-connection status:", status);
      if (status === "SUBSCRIBED") {
        setConnectionState("connected");
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "CLOSED" ||
        status === "TIMED_OUT"
      ) {
        setConnectionState("disconnected");
      }
    });

    statusChannelRef.current = channel;

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // ── Unread subscriptions per conversation type ───────────

  useEffect(() => {
    const channels = [];
    unreadChannelsRef.current = channels;

    if (!user || isStaff) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCounts({});
      return;
    }

    let cancelled = false;

    (async () => {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, conversation_type")
        .eq("user_id", user.id);

      if (cancelled) return;

      for (const conv of convs || []) {
        const type = conv.conversation_type || "support";

        // Fetch initial unread count
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("is_read", false)
          .neq("sender_role", "user");

        if (!cancelled) {
          setUnreadCounts((prev) => ({ ...prev, [type]: count || 0 }));
        }

        // Subscribe to new unread messages
        const channel = supabase
          .channel(`unread:${type}:${conv.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${conv.id}`,
            },
            (payload) => {
              if (payload.new.sender_role !== "user") {
                setUnreadCounts((prev) => ({
                  ...prev,
                  [type]: (prev[type] || 0) + 1,
                }));
              }
            },
          )
          .subscribe();

        channels.push(channel);
      }
    })();

    return () => {
      cancelled = true;
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [user, isStaff]);

  const resetUnreadCount = useCallback((type) => {
    setUnreadCounts((prev) => ({ ...prev, [type]: 0 }));
  }, []);

  const value = {
    connectionState,
    unreadCounts,
    resetUnreadCount,
    unreadCount: unreadCounts.support || 0,
    directOrderUnreadCount: unreadCounts.direct_order || 0,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
