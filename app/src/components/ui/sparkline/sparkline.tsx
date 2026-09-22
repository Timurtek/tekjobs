/* zengin-owned Sparkline, forked from @zenginui/ui@0.1.0, sha 64542605edde */
import { forwardRef, type HTMLAttributes, type MutableRefObject, type Ref } from "react";
import { areaPath, defaultFormat, linePath, useWidth, xAt, yAt, type ChartTone, type Frame } from "@/lib/chart";
import { cx } from "@/lib/cx";

export interface SparklineProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  values: number[];
  tone?: ChartTone;
  /** Pixel height. Width follows the container. */
  height?: number;
  /** Fill under the line. Default true. */
  area?: boolean;
  /** What the line shows, for assistive tech, e.g. "Revenue, last 30 days". Required. */
  "aria-label": string;
}

/** A word-sized trend line beside a number: the last thirty days of a metric, no axes. */
export const Sparkline = forwardRef<HTMLSpanElement, SparklineProps>(function Sparkline({ values, tone = "primary", height = 32, area = true, className, ...rest }, ref) {
  const [box, width] = useWidth<HTMLSpanElement>();
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const frame: Frame = { width, height, top: 2, right: 1, bottom: 2, left: 1 };
  const points = values.map((v, i) => [xAt(frame, i, values.length), yAt(frame, v, min, max === min ? min + 1 : max)] as [number, number]);
  const last = values[values.length - 1];
  const first = values[0];
  const trend = last === undefined || first === undefined ? "flat" : last > first ? "up" : last < first ? "down" : "flat";

  return (
    <span ref={mergeRefs(ref, box)} className={cx("z-sparkline", className)} data-tone={tone} data-trend={trend} {...rest}>
      <span className="z-sr-only">{values.length ? `${values.length} points, from ${defaultFormat(first!)} to ${defaultFormat(last!)}` : "no data"}</span>
      {width > 0 && values.length > 0 && (
        <svg className="z-sparkline__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <g data-tone={tone}>
            {area && <path className="z-chart__area" d={areaPath(points, height - frame.bottom, true)} />}
            <path className="z-chart__line z-sparkline__line" d={linePath(points, true)} />
          </g>
        </svg>
      )}
    </span>
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
