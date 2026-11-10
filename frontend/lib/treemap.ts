// Squarified treemap layout (Bruls, Huizing, van Wijk). Pure function, no DOM.

export interface TreemapInput {
  id: string;
  value: number; // must be > 0; zero/negative items are skipped
}

export interface TreemapRect extends TreemapInput {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function squarify(items: TreemapInput[], width: number, height: number): TreemapRect[] {
  const valid = items
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = valid.reduce((s, i) => s + i.value, 0);
  if (valid.length === 0 || total <= 0 || width <= 0 || height <= 0) return [];

  // Scale values so their sum equals the rectangle area.
  const scale = (width * height) / total;
  const scaled = valid.map((i) => ({ item: i, area: i.value * scale }));
  const out: TreemapRect[] = [];
  layout(scaled, { x: 0, y: 0, w: width, h: height }, out);
  return out;
}

function worst(row: number[], side: number): number {
  const sum = row.reduce((s, a) => s + a, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

function layout(
  items: { item: TreemapInput; area: number }[],
  box: Box,
  out: TreemapRect[],
): void {
  let rest = items.slice();
  let current = box;

  while (rest.length > 0) {
    const side = Math.min(current.w, current.h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst(rest.slice(0, i + 1).map((r) => r.area), side) <= worst(row.map((r) => r.area), side)) {
      row.push(rest[i]);
      i++;
    }
    current = placeRow(row, current, out);
    rest = rest.slice(row.length);
  }
}

/** Lay out one row along the shorter side; returns the remaining box. */
function placeRow(
  row: { item: TreemapInput; area: number }[],
  box: Box,
  out: TreemapRect[],
): Box {
  const sum = row.reduce((s, r) => s + r.area, 0);
  if (box.w >= box.h) {
    // Row is a vertical strip on the left.
    const stripW = sum / box.h;
    let y = box.y;
    for (const r of row) {
      const h = r.area / stripW;
      out.push({ ...r.item, x: box.x, y, w: stripW, h });
      y += h;
    }
    return { x: box.x + stripW, y: box.y, w: box.w - stripW, h: box.h };
  }
  // Row is a horizontal strip on the top.
  const stripH = sum / box.w;
  let x = box.x;
  for (const r of row) {
    const w = r.area / stripH;
    out.push({ ...r.item, x, y: box.y, w, h: stripH });
    x += w;
  }
  return { x: box.x, y: box.y + stripH, w: box.w, h: box.h - stripH };
}
