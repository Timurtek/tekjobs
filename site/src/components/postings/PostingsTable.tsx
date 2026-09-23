"use client";
import { Badge, Button, Card, Table } from "@/components/ui";
import type { Posting } from "@/server/postings";

const TONE: Record<Posting["status"], "neutral" | "success" | "warning" | "danger"> = { draft: "neutral", live: "success", closed: "warning", removed: "danger" };
const money = (n: number) => `$${Math.round(n / 1000)}k`;

export function PostingsTable({ postings }: { postings: Posting[] }) {
  return (
    <div className="stack">
      <div className="hero__actions">
        <Button asChild tone="primary" size="sm"><a href="/app/post-a-job/new">New posting</a></Button>
        <Button asChild variant="ghost" size="sm"><a href="/account">Account</a></Button>
      </div>
      <Card padding="none">
        <Table aria-label="Your postings" density="md">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Posting</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Pay</Table.HeadCell>
              <Table.HeadCell>Runs</Table.HeadCell>
              <Table.HeadCell>Edited</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {postings.map((p) => (
              <Table.Row key={p.id} interactive onClick={() => window.location.assign(`/app/post-a-job/${p.id}`)}>
                <Table.Cell>
                  <div className="cell-text">
                    {p.title}
                    <small>{p.company} · {p.location}</small>
                  </div>
                </Table.Cell>
                <Table.Cell><Badge size="sm" tone={TONE[p.status]}>{p.status}</Badge></Table.Cell>
                <Table.Cell><span className="num">{p.salaryMin && p.salaryMax ? `${money(p.salaryMin)}–${money(p.salaryMax)}` : "—"}</span></Table.Cell>
                <Table.Cell><span className="num muted">{p.status === "live" ? `${p.publishedAt.slice(0, 10)} → ${p.expiresAt.slice(0, 10)}` : p.status === "closed" ? `closed ${p.closedAt.slice(0, 10)}` : "not yet"}</span></Table.Cell>
                <Table.Cell><span className="num muted">{p.updatedAt.slice(0, 10)}</span></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>
    </div>
  );
}
