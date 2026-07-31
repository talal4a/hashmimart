import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { removeOrphanedVoiceMessages } from "../lib/voiceUtils";

export default function useChatRoom(conversationType) {
  const { user, profile, isStaff } = useAuth();
  // Staff post under their real role; everyone else posts as 'user'. The
  // messages RLS policy requires sender_role to match the sender's profile.
  const senderRole = isStaff ? profile?.role : "user";
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef(null);

  const getConversation = useCallback(async () => {
    if (!user) throw new Error("Not authenticated");
    setLoading(true);
    try {
      let { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .eq("conversation_type", conversationType)
        .maybeSingle();

      if (!data) {
        const { data: newConv, error } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, conversation_type: conversationType })
          .select()
          .single();

        if (error) throw error;
        data = newConv;
      }

      setConversation(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, [user, conversationType]);

  const getMessages = useCallback(
    async (conv) => {
      const c = conv || conversation;
      if (!c) return [];
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        const raw = data || [];

        // Background: check voice messages for deleted storage files
        const checked = await removeOrphanedVoiceMessages(raw);
        if (checked.length < raw.length) {
          setMessages(checked);
        } else {
          setMessages(raw);
        }
        return checked;
      } finally {
        setLoading(false);
      }
    },
    [conversation],
  );

  const sendMessage = useCallback(
    async (textOrVoice) => {
      if (!conversation) throw new Error("No conversation");
      if (!user) throw new Error("Not authenticated");

      let payload;
      if (typeof textOrVoice === "object" && textOrVoice.type === "voice") {
        if (!textOrVoice.voiceUrl) throw new Error("Voice URL is required");
        payload = {
          conversation_id: conversation.id,
          sender_id: user.id,
          sender_role: senderRole,
          message_type: "voice",
          message: null,
          voice_url: textOrVoice.voiceUrl,
          voice_duration: textOrVoice.duration || 0,
        };
      } else {
        const text = String(textOrVoice || "").trim();
        if (!text) throw new Error("Message cannot be empty");
        payload = {
          conversation_id: conversation.id,
          sender_id: user.id,
          sender_role: senderRole,
          message: text.slice(0, 500),
        };
      }

      const { data, error } = await supabase
        .from("messages")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversation.id);

      setConversation((prev) =>
        prev ? { ...prev, updated_at: new Date().toISOString() } : prev,
      );
      setMessages((prev) => {
        const map = new Map();
        for (const m of prev) map.set(m.id, m);
        map.set(data.id, data);
        return [...map.values()].sort(
          (a, b) => new Date(a?.created_at || 0) - new Date(b?.created_at || 0),
        );
      });
      return data;
    },
    [conversation, user, senderRole],
  );

  const removeMessage = useCallback(async (voiceUrlToRemove) => {
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
              console.warn("[useChatRoom] DB delete failed:", error.message);
          });
      }
      return prev.filter((m) => m.voice_url !== voiceUrlToRemove);
    });
  }, []);

  const markAsRead = useCallback(async () => {
    if (!conversation) return;
    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversation.id)
      .eq("is_read", false);

    if (error) {
      console.error("markAsRead failed", error);
      return;
    }

    setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
  }, [conversation]);

  const subscribeToMessages = useCallback(() => {
    if (!conversation || channelRef.current) return;

    const channel = supabase
      .channel(`${conversationType}:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          if (import.meta.env.DEV)
            console.log("[Realtime] INSERT payload received:", payload.new.id);
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            const map = new Map();
            for (const m of prev) map.set(m.id, m);
            map.set(payload.new.id, payload.new);
            return [...map.values()].sort(
              (a, b) =>
                new Date(a?.created_at || 0) - new Date(b?.created_at || 0),
            );
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          if (import.meta.env.DEV)
            console.log("[Realtime] UPDATE payload received:", payload.new.id);
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
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          if (import.meta.env.DEV)
            console.log("[Realtime] DELETE payload received:", payload.old.id);
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        },
      )
      .subscribe((status) => {
        if (import.meta.env.DEV)
          console.log(
            `[Realtime] ${conversationType}:${conversation.id} status:`,
            status,
          );
      });

    channelRef.current = channel;
  }, [conversation, conversationType]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  return {
    conversation,
    messages,
    loading,
    getConversation,
    getMessages,
    sendMessage,
    removeMessage,
    markAsRead,
    subscribeToMessages,
    unsubscribe,
  };
}
