import { useEffect, useRef, useState, type RefObject } from "react";

/** Tones a series can take. Each maps to a color token in the stylesheet. */
export type ChartTone = "primary" | "success" | "warning" | "danger" | "neutral";

export interface Series {
  name: string;
  values: number[];
  tone?: ChartTone;
}

export const TONES: ChartTone[] = ["primary", "success", "warning", "danger", "neutral"];

/** The rendered width of an element, kept current as it resizes, so charts draw at real pixels. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Lowest and highest values across series, padded to include zero and rounded to a tidy step. */
export function extent(series: Series[]): { min: number; max: number; ticks: number[] } {
  const all = series.flatMap((s) => s.values);
  let min = Math.min(0, ...all);
  let max = Math.max(0, ...all);
  if (min === max) max = min + 1;
  const span = max - min;
  const step = niceStep(span / 4);
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { min, max, ticks };
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

export interface Frame {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function xAt(frame: Frame, i: number, count: number): number {
  if (count <= 1) return frame.left;
  return frame.left + ((frame.width - frame.left - frame.right) * i) / (count - 1);
}

export function yAt(frame: Frame, v: number, min: number, max: number): number {
  const inner = frame.height - frame.top - frame.bottom;
  return frame.top + inner - ((v - min) / (max - min)) * inner;
}

/** A polyline through the points, or a smooth curve through them (Catmull-Rom to Bézier). */
export function linePath(points: [number, number][], smooth: boolean): string {
  if (points.length === 0) return "";
  if (points.length === 1 || !smooth) return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  let d = `M${points[0]![0].toFixed(1)} ${points[0]![1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** The line path closed down to the baseline, for an area fill. */
export function areaPath(points: [number, number][], baseline: number, smooth: boolean): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points, smooth)} L${last[0].toFixed(1)} ${baseline.toFixed(1)} L${first[0].toFixed(1)} ${baseline.toFixed(1)} Z`;
}

export function defaultFormat(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** A sentence for assistive tech: the series, their ranges, their last values. */
export function describeSeries(series: Series[], format: (n: number) => string): string {
  return series
    .map((s) => {
      if (s.values.length === 0) return `${s.name}: no data`;
      const last = s.values[s.values.length - 1]!;
      return `${s.name}: ${s.values.length} points from ${format(Math.min(...s.values))} to ${format(Math.max(...s.values))}, latest ${format(last)}`;
    })
    .join(". ");
}
