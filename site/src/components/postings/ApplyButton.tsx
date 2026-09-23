"use client";
import { Button } from "@/components/ui";

/** The one action on a public job page: the employer's own link, or their email. Readers apply to them, not to us. */
export function ApplyButton({ applyUrl, applyEmail, title, company }: { applyUrl: string; applyEmail: string; title: string; company: string }) {
  const href = applyUrl || `mailto:${applyEmail}?subject=${encodeURIComponent(`${title} at ${company}`)}`;
  return (
    <Button asChild tone="primary" size="lg">
      <a href={href} target={applyUrl ? "_blank" : undefined} rel={applyUrl ? "noreferrer" : undefined}>{applyUrl ? "Apply on the company's site" : "Apply by email"}</a>
    </Button>
  );
}
