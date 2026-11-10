import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TradeBar, buildTradePayload } from "@/components/TradeBar";

describe("buildTradePayload", () => {
  it("normalises the ticker and parses quantity", () => {
    expect(buildTradePayload(" aapl ", "2.5")).toEqual({ ticker: "AAPL", quantity: 2.5 });
  });

  it("rejects bad tickers and non-positive quantities", () => {
    expect(buildTradePayload("", "1")).toBeNull();
    expect(buildTradePayload("AAPL", "0")).toBeNull();
    expect(buildTradePayload("AAPL", "-3")).toBeNull();
    expect(buildTradePayload("AAPL", "abc")).toBeNull();
  });
});

describe("TradeBar", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts a market buy with the correct payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          trade: { id: "1", ticker: "AAPL", side: "buy", quantity: 5, price: 190, executed_at: "t" },
          portfolio: {},
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const onTraded = vi.fn();
    const user = userEvent.setup();
    render(<TradeBar selectedTicker="AAPL" onTraded={onTraded} />);

    const qty = screen.getByTestId("trade-quantity-input");
    await user.clear(qty);
    await user.type(qty, "5");
    await user.click(screen.getByTestId("trade-buy-button"));

    await waitFor(() => expect(onTraded).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/portfolio/trade");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ ticker: "AAPL", quantity: 5, side: "buy" });
  });

  it("shows the backend error detail when a trade is rejected", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Insufficient cash" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const onTraded = vi.fn();
    const user = userEvent.setup();
    render(<TradeBar selectedTicker="TSLA" onTraded={onTraded} />);
    await user.click(screen.getByTestId("trade-sell-button"));
    expect(await screen.findByTestId("trade-error")).toHaveTextContent("Insufficient cash");
    expect(onTraded).not.toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ticker: "TSLA", quantity: 10, side: "sell" });
  });

  it("does not call the API for an invalid quantity", async () => {
    const user = userEvent.setup();
    render(<TradeBar selectedTicker="AAPL" onTraded={vi.fn()} />);
    const qty = screen.getByTestId("trade-quantity-input");
    await user.clear(qty);
    await user.click(screen.getByTestId("trade-buy-button"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("trade-error")).toBeInTheDocument();
  });
});
