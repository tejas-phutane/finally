"use client";

import { useEffect, useRef, useState } from "react";

export const FLASH_MS = 500;

/**
 * Returns "up" or "down" for FLASH_MS after `value` changes, then null.
 * The first render never flashes.
 */
export function useFlash(value: number | null | undefined): "up" | "down" | null {
  const prev = useRef<number | null | undefined>(undefined);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const last = prev.current;
    prev.current = value;
    if (last === undefined || value == null || last == null || value === last) return;
    setFlash(value > last ? "up" : "down");
    const timer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [value]);

  return flash;
}

/** Price text that briefly highlights green (uptick) or red (downtick). */
export function FlashPrice({
  value,
  text,
  testId = "price-cell",
}: {
  value: number | null | undefined;
  text: string;
  testId?: string;
}) {
  const flash = useFlash(value);
  const bg =
    flash === "up" ? "bg-up/30" : flash === "down" ? "bg-down/30" : "bg-transparent";
  return (
    <span
      data-testid={testId}
      data-flash={flash ?? "none"}
      className={`inline-block rounded px-1 font-mono tabular-nums transition-colors duration-500 ${bg}`}
    >
      {text}
    </span>
  );
}
