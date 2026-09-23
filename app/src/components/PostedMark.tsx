import { Badge } from "@/components/ui";
import { brand } from "@/brand";

/** True for a posting that came through TekJobs itself (an employer paid to post it), as opposed to one the scan found on a board. */
export const isPosted = (source: string | undefined) => source === "tekjobs";

/**
 * The mark on a TekJobs posting: the lime glyph and the name, solid, so it reads as ours before the eye reaches
 * the source column. Rows carry `data-posted` too, which draws the lime rule down their left edge.
 */
export function PostedMark({ label = "TekJobs" }: { label?: string }) {
  return (
    <Badge tone="primary" variant="solid" size="sm" title="Posted on TekJobs by the employer">
      <img className="posted__glyph" src={brand.logo} alt="" width={12} height={12} />
      {label}
    </Badge>
  );
}
