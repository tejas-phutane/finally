export type PnlSign = "gain" | "loss" | "flat";

export function pnlSign(value: number): PnlSign {
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "flat";
}

/**
 * Heatmap tile background. Brightness scales with |pct| up to 5%,
 * so small moves stay muted and large moves stand out.
 */
export function heatmapColor(pct: number): string {
  const sign = pnlSign(pct);
  if (sign === "flat") return "#30363d";
  const intensity = Math.min(Math.abs(pct) / 5, 1);
  const alpha = (0.35 + 0.55 * intensity).toFixed(2);
  return sign === "gain" ? `rgba(63, 185, 80, ${alpha})` : `rgba(248, 81, 73, ${alpha})`;
}
