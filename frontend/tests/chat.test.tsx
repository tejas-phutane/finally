import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatPanel } from "@/components/ChatPanel";
import { messagesFromResponse } from "@/hooks/useChat";
import type { ChatMessage } from "@/lib/types";

const base = {
  messages: [] as ChatMessage[],
  sending: false,
  error: null,
  collapsed: false,
  onToggle: vi.fn(),
};

describe("ChatPanel", () => {
  it("sends trimmed input and clears the box", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatPanel {...base} onSend={onSend} />);
    await user.type(screen.getByTestId("chat-input"), "  buy 5 AAPL  ");
    await user.click(screen.getByTestId("chat-send"));
    expect(onSend).toHaveBeenCalledWith("buy 5 AAPL");
    expect(screen.getByTestId("chat-input")).toHaveValue("");
  });

  it("shows the loading indicator and disables input while sending", () => {
    render(<ChatPanel {...base} sending onSend={vi.fn()} />);
    expect(screen.getByTestId("chat-loading")).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toBeDisabled();
  });

  it("renders messages with roles and inline trade and watchlist confirmations", () => {
    const messages = messagesFromResponse(
      "buy 5 AAPL and add PYPL",
      {
        message: "Done.",
        trades: [{ ticker: "AAPL", side: "buy", quantity: 5, status: "executed", price: 190.5 }],
        watchlist_changes: [{ ticker: "PYPL", action: "add", status: "executed" }],
      },
      "t1",
    );
    render(<ChatPanel {...base} messages={messages} onSend={vi.fn()} />);
    const bubbles = screen.getAllByTestId("chat-message");
    expect(bubbles.map((b) => b.getAttribute("data-role"))).toEqual(["user", "assistant"]);
    expect(screen.getByTestId("chat-trade")).toHaveTextContent("BUY 5 AAPL @ 190.50");
    expect(screen.getByTestId("chat-watchlist-change")).toHaveTextContent("Added PYPL to watchlist");
  });

  it("shows failed trades in the chat", () => {
    const messages: ChatMessage[] = [
      {
        id: "x",
        role: "assistant",
        content: "Could not buy.",
        actions: { trades: [{ ticker: "TSLA", side: "buy", quantity: 999, status: "failed", error: "Insufficient cash" }] },
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    render(<ChatPanel {...base} messages={messages} onSend={vi.fn()} />);
    expect(screen.getByTestId("chat-trade")).toHaveAttribute("data-status", "failed");
    expect(screen.getByTestId("chat-trade")).toHaveTextContent("Insufficient cash");
  });
});
