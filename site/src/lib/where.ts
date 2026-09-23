/**
 * One line that says where a job is, and never says a geography twice. Remote: the regions it is open to, then
 * a time-zone note if there is one (an old posting that typed a region into the location field loses the repeat).
 * Hybrid: the office, marked hybrid. On-site: the office.
 */
export function whereOf(p: { workplace: string; regions: string[]; location: string }, { remoteWord = "Remote" }: { remoteWord?: string } = {}): string {
  const loc = p.location.trim();
  if (p.workplace === "remote") {
    const regions = p.regions.length ? p.regions : ["Worldwide"];
    const repeat = regions.some((r) => r.toLowerCase() === loc.toLowerCase()) || /^(remote|anywhere)$/i.test(loc);
    return [`${remoteWord} · ${regions.join(", ")}`, repeat ? "" : loc].filter(Boolean).join(" · ");
  }
  return p.workplace === "hybrid" ? `Hybrid · ${loc}` : loc;
}
