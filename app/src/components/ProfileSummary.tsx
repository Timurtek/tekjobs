import { Badge, Card, Table } from "@/components/ui";
import type { ProfileSummary as Summary } from "../api";

const TONE = { ok: "success", warn: "warning", missing: "danger", info: "neutral" } as const;

/**
 * The profile as a reader needs it: who this is, what they are aiming at and whether the criteria agree, the
 * constraints, the documents and their freshness, what is stale, and which note feeds which draft. Read from
 * the Markdown; the Markdown stays the record.
 */
export function ProfileSummaryView({ s }: { s: Summary }) {
  return (
    <div className="detail">
      <Card padding="md">
        <div className="panel">
          <div className="panel__head">
            <div>
              <h2>{s.basics.name || "No name yet"}</h2>
              <p>{[s.basics.currentRole, s.basics.location].filter(Boolean).join(" · ") || "The Basics section is empty."}</p>
            </div>
            <div className="chips">
              <Badge size="sm" tone={s.status === "draft" ? "warning" : "success"}>{s.status === "draft" ? "draft" : "reviewed"}</Badge>
              {s.updated && <Badge size="sm" tone="neutral" variant="outline">updated {s.updated}</Badge>}
            </div>
          </div>
          {s.summary ? <p>{s.summary}</p> : <p className="muted">The three-sentence summary is still the template. It leads every cover letter.</p>}
          {(s.basics.email || s.basics.links.length > 0) && (
            <p className="muted mono">{[s.basics.email, ...s.basics.links].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      </Card>

      <Card padding="md">
        <div className="panel">
          <div className="panel__head">
            <div>
              <h2>Needs attention</h2>
              <p>What a reader of these notes would trip on. Each line names the note to fix.</p>
            </div>
            <Badge size="sm" tone={s.attention.length ? "warning" : "success"}>{s.attention.length ? `${s.attention.length} item${s.attention.length === 1 ? "" : "s"}` : "nothing stale"}</Badge>
          </div>
          {s.attention.length > 0 ? (
            <ul className="summary__list">
              {s.attention.map((a) => <li key={a.text}><Badge size="sm" tone={TONE[a.level]} variant="soft">{a.note}</Badge> {a.text}</li>)}
            </ul>
          ) : <p className="muted">Every field is filled, the resume of record is fresh, and the criteria agree with the profile.</p>}
        </div>
      </Card>

      <div className="charts">
        <Card padding="none">
          <div className="panel panel--pad">
            <div className="panel__head">
              <div>
                <h2>Target roles</h2>
                <p>From the profile&apos;s table. &quot;In criteria&quot; means a title term the scan scores on matches the title; a title without one is never found by the scan.</p>
              </div>
            </div>
          </div>
          <Table aria-label="Target roles" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Tier</Table.HeadCell>
                <Table.HeadCell>Title</Table.HeadCell>
                <Table.HeadCell>In criteria</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {s.targets.map((t) => (
                <Table.Row key={`${t.tier}-${t.title}`}>
                  <Table.Cell><Badge size="sm" tone={t.tier === "A" ? "primary" : "neutral"}>{t.tier}</Badge></Table.Cell>
                  <Table.Cell>{t.title}</Table.Cell>
                  <Table.Cell>{t.term ? <span className="muted">yes · <span className="mono">{t.term}</span></span> : <Badge size="sm" tone="warning" variant="soft">no title term</Badge>}</Table.Cell>
                </Table.Row>
              ))}
              {s.targets.length === 0 && <Table.Row><Table.Cell colSpan={3}><span className="muted">The Target roles table is empty.</span></Table.Cell></Table.Row>}
            </Table.Body>
          </Table>
        </Card>

        <Card padding="none">
          <div className="panel panel--pad">
            <div className="panel__head">
              <div>
                <h2>Constraints against the criteria</h2>
                <p>What the profile says beside what the scan enforces.</p>
              </div>
            </div>
          </div>
          <Table aria-label="Constraints against the criteria" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Constraint</Table.HeadCell>
                <Table.HeadCell>Profile</Table.HeadCell>
                <Table.HeadCell>Criteria</Table.HeadCell>
                <Table.HeadCell></Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {s.constraints.map((c) => (
                <Table.Row key={c.label}>
                  <Table.Cell>{c.label}</Table.Cell>
                  <Table.Cell><span className={c.profile ? "" : "muted"}>{c.profile || "not set"}</span></Table.Cell>
                  <Table.Cell><span className={c.criteria ? "num" : "muted"}>{c.criteria || "—"}</span></Table.Cell>
                  <Table.Cell>{c.level !== "info" && <Badge size="sm" tone={TONE[c.level]} variant="soft">{c.level === "ok" ? "agree" : c.level === "warn" ? "differ" : "missing"}</Badge>}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card>
      </div>

      <div className="charts">
        <Card padding="none">
          <div className="panel panel--pad">
            <div className="panel__head">
              <div>
                <h2>Documents</h2>
                <p>The notes and files the drafts are built from, and how fresh each one is.</p>
              </div>
            </div>
          </div>
          <Table aria-label="Documents" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Document</Table.HeadCell>
                <Table.HeadCell>State</Table.HeadCell>
                <Table.HeadCell>Where</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {s.documents.map((d) => (
                <Table.Row key={d.label}>
                  <Table.Cell>{d.label}</Table.Cell>
                  <Table.Cell><Badge size="sm" tone={TONE[d.level]} variant="soft">{d.state}</Badge></Table.Cell>
                  <Table.Cell><span className="muted mono">{d.where}</span></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card>

        <Card padding="none">
          <div className="panel panel--pad">
            <div className="panel__head">
              <div>
                <h2>What feeds what</h2>
                <p>Which note each thing the app writes is built from. Change the note, and everything after it changes.</p>
              </div>
            </div>
          </div>
          <Table aria-label="What feeds what" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Produces</Table.HeadCell>
                <Table.HeadCell>Reads</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {s.feeds.map((f) => (
                <Table.Row key={f.produces}>
                  <Table.Cell>{f.produces}</Table.Cell>
                  <Table.Cell><span className="muted">{f.reads}</span></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card>
      </div>

      {s.proofPoints.length > 0 && (
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2>Proof points</h2>
                <p>{s.proofPoints.length} on file; the ones without a number are flagged above. Cover letters quote from these and nothing else.</p>
              </div>
            </div>
            <ul className="summary__list">
              {s.proofPoints.map((p) => <li key={p.text}>{p.hasNumber ? null : <Badge size="sm" tone="warning" variant="soft">no number</Badge>} {p.text}</li>)}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}
