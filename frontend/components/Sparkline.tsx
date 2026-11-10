export function Sparkline({ values, width = 56, height = 22 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`)
    .join(" ");
  const color = values[values.length - 1] >= values[0] ? "#3fb950" : "#f85149";
  return (
    <svg width={width} height={height} aria-hidden="true" data-testid="sparkline">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
