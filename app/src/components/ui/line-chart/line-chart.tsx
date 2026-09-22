/* zengin-owned LineChart, forked from @zenginui/ui@0.1.0, sha e888e4279fa9 */
import { forwardRef, useState, type HTMLAttributes, type MutableRefObject, type PointerEvent, type Ref } from "react";
import { areaPath, defaultFormat, describeSeries, extent, linePath, TONES, useWidth, xAt, yAt, type ChartTone, type Frame, type Series } from "@/lib/chart";
import { cx } from "@/lib/cx";

export type LineChartCurve = "linear" | "smooth";

export interface LineChartProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** One or more series of equal length. Tones cycle through primary, success, warning, danger, neutral when unset. */
  series: Series[];
  /** One label per point, shown on the x axis (first, last, and a few between) and in the hover readout. */
  labels?: string[];
  /** Pixel height of the drawing. Width follows the container. */
  height?: number;
  /** Fill under each line. */
  area?: boolean;
  curve?: LineChartCurve;
  showGrid?: boolean;
  showAxis?: boolean;
  /** Formats values on the axis and in the readout. Default abbreviates thousands. */
  formatValue?: (value: number) => string;
  /** What the chart shows, for assistive tech. Required. */
  "aria-label": string;
}

const FRAME_PAD = { top: 12, right: 12, bottom: 28, left: 44 };

/**
 * A line chart for values over an ordered axis: revenue by day, signups by week. Series share one y axis.
 * Hovering shows every series' value at the nearest point. Colors come from the tone tokens.
 */
export const LineChart = forwardRef<HTMLDivElement, LineChartProps>(function LineChart(
  { series, labels, height = 220, area = false, curve = "smooth", showGrid = true, showAxis = true, formatValue = defaultFormat, className, ...rest },
  ref,
) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const count = Math.max(0, ...series.map((s) => s.values.length));
  const { min, max, ticks } = extent(series);
  const frame: Frame = { width, height, ...(showAxis ? FRAME_PAD : { top: 4, right: 4, bottom: 4, left: 4 }) };
  const toned = series.map((s, i) => ({ ...s, tone: s.tone ?? TONES[i % TONES.length]! }));
  const baseline = yAt(frame, Math.max(min, 0), min, max);

  const onMove = (e: PointerEvent<SVGSVGElement>): void => {
    if (count < 2 || width === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const inner = width - frame.left - frame.right;
    const i = Math.round(((x - frame.left) / inner) * (count - 1));
    setHover(Math.min(count - 1, Math.max(0, i)));
  };

  const labelIndexes = axisLabelIndexes(count, Math.floor((width - frame.left - frame.right) / 72));

  return (
    <div ref={mergeRefs(ref, box)} className={cx("z-chart", className)} data-kind="line" {...rest}>
      <p className="z-sr-only">{describeSeries(series, formatValue)}</p>
      {width > 0 && (
        <svg className="z-chart__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {showGrid &&
            ticks.map((t) => (
              <line key={t} className="z-chart__grid" x1={frame.left} x2={width - frame.right} y1={yAt(frame, t, min, max)} y2={yAt(frame, t, min, max)} />
            ))}
          {showAxis &&
            ticks.map((t) => (
              <text key={`y${t}`} className="z-chart__tick" x={frame.left - 8} y={yAt(frame, t, min, max)} textAnchor="end" dominantBaseline="middle">
                {formatValue(t)}
              </text>
            ))}
          {showAxis &&
            labels &&
            labelIndexes.map((i) => (
              <text key={`x${i}`} className="z-chart__tick" x={xAt(frame, i, count)} y={height - 8} textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}>
                {labels[i]}
              </text>
            ))}
          {toned.map((s) => {
            const points = s.values.map((v, i) => [xAt(frame, i, count), yAt(frame, v, min, max)] as [number, number]);
            return (
              <g key={s.name} data-tone={s.tone}>
                {area && <path className="z-chart__area" d={areaPath(points, baseline, curve === "smooth")} />}
                <path className="z-chart__line" d={linePath(points, curve === "smooth")} />
              </g>
            );
          })}
          {hover !== null && count > 0 && (
            <g className="z-chart__cursor">
              <line x1={xAt(frame, hover, count)} x2={xAt(frame, hover, count)} y1={frame.top} y2={height - frame.bottom} />
              {toned.map((s) => s.values[hover] !== undefined && <circle key={s.name} data-tone={s.tone} cx={xAt(frame, hover, count)} cy={yAt(frame, s.values[hover]!, min, max)} r={4} />)}
            </g>
          )}
        </svg>
      )}
      {hover !== null && count > 0 && (
        <div className="z-chart__readout" style={{ left: `${(xAt(frame, hover, count) / width) * 100}%` }} data-side={hover > count / 2 ? "left" : "right"}>
          {labels?.[hover] && <span className="z-chart__readout-label">{labels[hover]}</span>}
          {toned.map((s) => (
            <span key={s.name} className="z-chart__readout-row" data-tone={s.tone}>
              <span className="z-chart__swatch" />
              {s.name}
              <strong>{s.values[hover] === undefined ? "" : formatValue(s.values[hover]!)}</strong>
            </span>
          ))}
        </div>
      )}
      {toned.length > 1 && (
        <ul className="z-chart__legend">
          {toned.map((s) => (
            <li key={s.name} data-tone={s.tone}>
              <span className="z-chart__swatch" />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

/** Which x labels fit: always the first and last, then evenly spaced ones up to what the width allows. */
export function axisLabelIndexes(count: number, slots: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [0];
  const n = Math.max(2, Math.min(count, slots));
  const out = new Set<number>();
  for (let k = 0; k < n; k++) out.add(Math.round(((count - 1) * k) / (n - 1)));
  return [...out].sort((a, b) => a - b);
}

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): (el: T | null) => void {
  return (el) => {
    for (const r of refs) {
      if (!r) continue;
      if (typeof r === "function") r(el);
      else (r as MutableRefObject<T | null>).current = el;
    }
  };
}

export type { ChartTone, Series };
