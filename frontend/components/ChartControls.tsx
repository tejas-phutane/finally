"use client";

import { CHART_STYLES, RANGE_KEYS, type ChartStyle, type RangeKey } from "@/lib/ranges";

const STYLE_LABEL: Record<ChartStyle, string> = {
  candle: "Candles",
  bar: "Bars",
  line: "Line",
  area: "Area",
};

/** Segmented button group. Active option is highlighted. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  testId,
  attr,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  testId: string;
  attr: "data-range" | "data-style";
  render: (v: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded border border-border">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            data-testid={testId}
            {...{ [attr]: opt }}
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={`px-2 py-0.5 font-mono text-xs ${
              active ? "bg-accent text-bg" : "bg-panel text-muted hover:text-foreground"
            }`}
          >
            {render(opt)}
          </button>
        );
      })}
    </div>
  );
}

export function RangeSelector({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
  return (
    <Segmented
      options={RANGE_KEYS}
      value={value}
      onChange={onChange}
      label="Time range"
      testId="range-button"
      attr="data-range"
      render={(v) => v}
    />
  );
}

export function StyleSelector({
  value,
  onChange,
}: {
  value: ChartStyle;
  onChange: (v: ChartStyle) => void;
}) {
  return (
    <Segmented
      options={CHART_STYLES}
      value={value}
      onChange={onChange}
      label="Chart style"
      testId="style-button"
      attr="data-style"
      render={(v) => STYLE_LABEL[v]}
    />
  );
}
