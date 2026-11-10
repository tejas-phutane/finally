"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ChatMessage, ChatResponse } from "@/lib/types";

/** Build the local message pair shown after a successful /api/chat round trip. */
export function messagesFromResponse(text: string, res: ChatResponse, idBase: string): ChatMessage[] {
  const now = new Date().toISOString();
  return [
    { id: `${idBase}-user`, role: "user", content: text, actions: null, created_at: now },
    {
      id: `${idBase}-assistant`,
      role: "assistant",
      content: res.message,
      actions: { trades: res.trades, watchlist_changes: res.watchlist_changes },
      created_at: now,
    },
  ];
}

export function useChat(onActions: () => void): {
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getChatHistory()
      .then(setMessages)
      .catch(() => setError("Chat history unavailable"));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setSending(true);
      setError(null);
      try {
        const res = await api.sendChat(trimmed);
        setMessages((prev) => [...prev, ...messagesFromResponse(trimmed, res, `local-${Date.now()}`)]);
        onActions();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chat request failed");
      } finally {
        setSending(false);
      }
    },
    [sending, onActions],
  );

  return { messages, sending, error, send };
}
