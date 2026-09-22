/* zengin-owned BarChart, forked from @zenginui/ui@0.1.0, sha dd1fbf1d029d */
import { forwardRef, useState, type HTMLAttributes, type MutableRefObject, type Ref } from "react";
import { defaultFormat, describeSeries, extent, TONES, useWidth, yAt, type ChartTone, type Frame, type Series } from "@/lib/chart";
import { cx } from "@/lib/cx";

export interface BarChartProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** One or more series of equal length; several series draw grouped bars per label. */
  series: Series[];
  /** One label per bar group, shown under the bars. */
  labels?: string[];
  /** Pixel height of the drawing. Width follows the container. */
  height?: number;
  showGrid?: boolean;
  showAxis?: boolean;
  formatValue?: (value: number) => string;
  "aria-label": string;
}

const FRAME_PAD = { top: 12, right: 12, bottom: 28, left: 44 };

/** A bar chart for values by category: signups by plan, revenue by region. Hovering a group shows its values. */
export const BarChart = forwardRef<HTMLDivElement, BarChartProps>(function BarChart(
  { series, labels, height = 220, showGrid = true, showAxis = true, formatValue = defaultFormat, className, ...rest },
  ref,
) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const count = Math.max(0, ...series.map((s) => s.values.length));
  const { min, max, ticks } = extent(series);
  const frame: Frame = { width, height, ...(showAxis ? FRAME_PAD : { top: 4, right: 4, bottom: 4, left: 4 }) };
  const toned = series.map((s, i) => ({ ...s, tone: s.tone ?? TONES[i % TONES.length]! }));
  const inner = width - frame.left - frame.right;
  const groupWidth = count > 0 ? inner / count : 0;
  const gap = Math.min(groupWidth * 0.3, 16);
  const barWidth = toned.length > 0 ? Math.max(2, (groupWidth - gap) / toned.length) : 0;
  const baseline = yAt(frame, Math.max(min, 0), min, max);

  return (
    <div ref={mergeRefs(ref, box)} className={cx("z-chart", className)} data-kind="bar" {...rest}>
      <p className="z-sr-only">{describeSeries(series, formatValue)}</p>
      {width > 0 && (
        <svg className="z-chart__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true" onPointerLeave={() => setHover(null)}>
          {showGrid && ticks.map((t) => <line key={t} className="z-chart__grid" x1={frame.left} x2={width - frame.right} y1={yAt(frame, t, min, max)} y2={yAt(frame, t, min, max)} />)}
          {showAxis &&
            ticks.map((t) => (
              <text key={`y${t}`} className="z-chart__tick" x={frame.left - 8} y={yAt(frame, t, min, max)} textAnchor="end" dominantBaseline="middle">
                {formatValue(t)}
              </text>
            ))}
          {Array.from({ length: count }, (_, i) => {
            const x0 = frame.left + i * groupWidth + gap / 2;
            return (
              <g key={i} className="z-chart__group" data-hover={hover === i || undefined} onPointerEnter={() => setHover(i)}>
                <rect x={frame.left + i * groupWidth} y={frame.top} width={groupWidth} height={height - frame.top - frame.bottom} fill="transparent" />
                {toned.map((s, k) => {
                  const v = s.values[i] ?? 0;
                  const y = yAt(frame, v, min, max);
                  const top = Math.min(y, baseline);
                  const h = Math.abs(baseline - y);
                  return (
                    <g key={s.name} data-tone={s.tone}>
                      <rect className="z-chart__bar" x={x0 + k * barWidth} y={top} width={Math.max(1, barWidth - 2)} height={h} rx={2} />
                    </g>
                  );
                })}
                {showAxis && labels?.[i] && (
                  <text className="z-chart__tick" x={frame.left + i * groupWidth + groupWidth / 2} y={height - 8} textAnchor="middle">
                    {labels[i]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && count > 0 && (
        <div className="z-chart__readout" style={{ left: `${((frame.left + hover * groupWidth + groupWidth / 2) / width) * 100}%` }} data-side={hover >= count / 2 ? "left" : "right"}>
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
