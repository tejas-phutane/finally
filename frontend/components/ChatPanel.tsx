"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, TradeAction, WatchlistAction } from "@/lib/types";
import { PanelTitle } from "./Watchlist";

export function ChatPanel({
  messages,
  sending,
  error,
  onSend,
  collapsed,
  onToggle,
}: {
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  onSend: (text: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  if (collapsed) {
    return (
      <aside className="flex h-full flex-col items-center border-l border-border bg-panel py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Open AI chat"
          className="rounded px-1 py-2 text-xs font-semibold uppercase tracking-wider text-accent hover:bg-white/5 [writing-mode:vertical-rl]"
        >
          AI Chat
        </button>
      </aside>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    onSend(text);
  };

  return (
    <aside className="flex h-full flex-col border-l border-border bg-panel">
      <div className="flex items-center justify-between border-r-0">
        <PanelTitle>AI Assistant</PanelTitle>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse AI chat"
          className="px-3 text-muted hover:text-foreground"
        >
          ›
        </button>
      </div>
      <div ref={listRef} className="flex-1 space-y-3 overflow-auto p-3">
        {messages.length === 0 && !sending && (
          <p className="text-sm text-muted">Ask about your portfolio, or say “buy 5 AAPL”.</p>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        {sending && (
          <div data-testid="chat-loading" className="text-sm text-muted">
            <span className="animate-pulse">Thinking…</span>
          </div>
        )}
        {error && <p className="text-xs text-down">{error}</p>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-2">
        <input
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message FinAlly…"
          disabled={sending}
          className="min-w-0 flex-1 rounded border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-secondary"
        />
        <button
          type="submit"
          data-testid="chat-send"
          disabled={sending || !input.trim()}
          className="rounded bg-secondary px-3 py-1 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const trades = message.actions?.trades ?? [];
  const watch = message.actions?.watchlist_changes ?? [];
  return (
    <div data-testid="chat-message" data-role={message.role} className={isUser ? "text-right" : "text-left"}>
      <div
        className={`inline-block max-w-[95%] rounded px-3 py-2 text-left text-sm whitespace-pre-wrap ${
          isUser ? "bg-primary/20" : "bg-bg border border-border"
        }`}
      >
        {message.content}
      </div>
      {trades.map((t, i) => (
        <TradeChip key={`t-${i}`} trade={t} />
      ))}
      {watch.map((w, i) => (
        <WatchChip key={`w-${i}`} change={w} />
      ))}
    </div>
  );
}

function TradeChip({ trade }: { trade: TradeAction }) {
  const ok = trade.status === "executed";
  return (
    <div
      data-testid="chat-trade"
      data-status={trade.status}
      className={`mt-1 inline-block rounded border px-2 py-0.5 font-mono text-xs ${
        ok ? "border-up text-up" : "border-down text-down"
      }`}
    >
      {ok
        ? `${trade.side.toUpperCase()} ${trade.quantity} ${trade.ticker}${trade.price ? ` @ ${trade.price.toFixed(2)}` : ""}`
        : `Failed: ${trade.side.toUpperCase()} ${trade.quantity} ${trade.ticker}${trade.error ? ` — ${trade.error}` : ""}`}
    </div>
  );
}

function WatchChip({ change }: { change: WatchlistAction }) {
  const ok = change.status === "executed";
  return (
    <div
      data-testid="chat-watchlist-change"
      data-status={change.status}
      className={`mt-1 inline-block rounded border px-2 py-0.5 font-mono text-xs ${
        ok ? "border-accent text-accent" : "border-down text-down"
      }`}
    >
      {ok
        ? `${change.action === "add" ? "Added" : "Removed"} ${change.ticker} ${change.action === "add" ? "to" : "from"} watchlist`
        : `Failed: ${change.action} ${change.ticker}${change.error ? ` — ${change.error}` : ""}`}
    </div>
  );
}
