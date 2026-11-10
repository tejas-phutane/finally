import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlashPrice, FLASH_MS } from "@/components/Flash";

describe("FlashPrice", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not flash on first render", () => {
    render(<FlashPrice value={100} text="100.00" />);
    expect(screen.getByTestId("price-cell")).toHaveAttribute("data-flash", "none");
  });

  it("flashes green on uptick and red on downtick, then fades back", () => {
    const { rerender } = render(<FlashPrice value={100} text="100.00" />);

    rerender(<FlashPrice value={101} text="101.00" />);
    const cell = screen.getByTestId("price-cell");
    expect(cell).toHaveAttribute("data-flash", "up");
    expect(cell).toHaveClass("bg-up/30");

    act(() => {
      vi.advanceTimersByTime(FLASH_MS);
    });
    expect(cell).toHaveAttribute("data-flash", "none");

    rerender(<FlashPrice value={99} text="99.00" />);
    expect(cell).toHaveAttribute("data-flash", "down");
    expect(cell).toHaveClass("bg-down/30");
  });

  it("does not flash when the price is unchanged", () => {
    const { rerender } = render(<FlashPrice value={100} text="100.00" />);
    rerender(<FlashPrice value={100} text="100.00" />);
    expect(screen.getByTestId("price-cell")).toHaveAttribute("data-flash", "none");
  });
});
