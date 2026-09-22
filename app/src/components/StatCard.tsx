import { Badge, Card, Sparkline } from "@/components/ui";

interface StatCardProps {
  label: string;
  value: string;
  /** A short qualifier under the number, such as "of 355 open". */
  hint?: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  /** Optional trend; omitted when there is no time series worth drawing. */
  series?: number[];
  onClick?: () => void;
}

/** A metric with its qualifier and, when there is one, its trend. */
export function StatCard({ label, value, hint, tone = "neutral", series, onClick }: StatCardProps) {
  return (
    <Card padding="md" interactive={!!onClick} onClick={onClick}>
      <div className="stat">
        <span className="stat__label">{label}</span>
        <div className="stat__row">
          <span className="stat__value">{value}</span>
          {series && series.length > 1 && (
            <div className="stat__spark">
              <Sparkline values={series} tone={tone === "neutral" ? "primary" : tone} aria-label={`${label}, per scan`} />
            </div>
          )}
        </div>
        {hint && (
          <div className="stat__delta">
            <Badge tone={tone} size="sm">
              {hint}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}
