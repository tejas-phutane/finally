import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Watchlist } from "@/components/Watchlist";
import type { WatchlistItem } from "@/lib/types";

const item = (ticker: string): WatchlistItem => ({
  ticker,
  price: 100,
  previous_price: 100,
  change_percent: 0,
  direction: "flat",
  session_open: 100,
  day_change_percent: 1.5,
  timestamp: 1,
});

function renderList(overrides: Partial<Parameters<typeof Watchlist>[0]> = {}) {
  const props = {
    items: [item("AAPL"), item("MSFT")],
    prices: {},
    history: {},
    selected: "AAPL",
    error: null,
    onSelect: vi.fn(),
    onAdd: vi.fn().mockResolvedValue(true),
    onRemove: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  render(<Watchlist {...props} />);
  return props;
}

describe("Watchlist", () => {
  it("renders one row per ticker with the data-testid hooks", () => {
    renderList();
    const rows = screen.getAllByTestId("watchlist-row");
    expect(rows.map((r) => r.getAttribute("data-ticker"))).toEqual(["AAPL", "MSFT"]);
    expect(screen.getAllByTestId("price-cell")).toHaveLength(2);
  });

  it("adds an uppercased ticker through onAdd", async () => {
    const user = userEvent.setup();
    const props = renderList();
    await user.type(screen.getByTestId("watchlist-add-input"), "pypl");
    await user.click(screen.getByTestId("watchlist-add-button"));
    expect(props.onAdd).toHaveBeenCalledWith("PYPL");
    await waitFor(() => expect(screen.getByTestId("watchlist-add-input")).toHaveValue(""));
  });

  it("does not call onAdd for an invalid ticker", async () => {
    const user = userEvent.setup();
    const props = renderList();
    await user.type(screen.getByTestId("watchlist-add-input"), "123!");
    await user.click(screen.getByTestId("watchlist-add-button"));
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("removes a ticker without selecting its row", async () => {
    const user = userEvent.setup();
    const props = renderList();
    const removeButtons = screen.getAllByTestId("watchlist-remove-button");
    await user.click(removeButtons[1]);
    expect(props.onRemove).toHaveBeenCalledWith("MSFT");
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("selects a row when clicked", () => {
    const props = renderList();
    fireEvent.click(screen.getAllByTestId("watchlist-row")[1]);
    expect(props.onSelect).toHaveBeenCalledWith("MSFT");
  });
});
