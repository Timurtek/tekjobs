import { Card, CodeBlock, Table } from "@/components/ui";

const MCP_JSON = `{
  "mcpServers": {
    "tekjobs": {
      "command": "node",
      "args": ["server/mcp.mjs"]
    }
  }
}`;

const TOOLS: [string, string][] = [
  ["search_jobs", "Open matches, filtered by text, status, pay band, title kind, and score."],
  ["get_job", "One note in full: match reasons, status log, notes, application, description."],
  ["set_status", "Move a job through the pipeline; written to the note."],
  ["add_note", "Append a dated line to the note's notes section."],
  ["application_materials", "The job plus your profile, positioning, and resume draft, ready to tailor from."],
  ["save_application_field", "Write a drafted field (resume variant, contact, follow-up) into the note."],
  ["tailored_resume_materials", "The posting, the resume of record, and the rules: reorder, prune, re-summarise; never add a bullet, date or number."],
  ["save_tailored_resume", "Save the tailored resume into the note; returns any bullet, figure, date or job that is not on the resume of record."],
  ["cover_letter_materials", "The posting, your resume as the only source of facts, and the binding rules for a letter."],
  ["save_cover_letter", "Save the letter into the note; returns figures not on your resume, dashes, stock phrases."],
  ["summary", "Pipeline counts, pay bands, last scan, current thresholds."],
  ["run_scan / scan_status", "Start a scan of every board and watch it."],
  ["get_criteria / set_criteria", "Read or replace the scoring JSON, validated before writing."],
  ["list_companies / add_company", "The watchlist, and a new board on it."],
];

export function Agent() {
  return (
    <>
      <div className="page__head">
        <div>
          <p>The app ships its own MCP server, so an agent can run the search without this screen: find matches, move them, draft applications, add boards, start scans. Everything it writes lands in the same markdown notes.</p>
        </div>
      </div>
      <div className="charts">
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2>Connect Claude Code</h2>
                <p>From the app directory. The project already carries this in its .mcp.json, so a session started here picks it up.</p>
              </div>
            </div>
            <CodeBlock code={"claude mcp add tekjobs -- node server/mcp.mjs"} language="bash" />
            <CodeBlock code={MCP_JSON} language="json" />
            <p className="muted">Claude Desktop: add the same block to its MCP settings with an absolute path to server/mcp.mjs. No API key is involved; the LLM is whichever one is running the session.</p>
          </div>
        </Card>
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2>A session that tailors an application</h2>
                <p>What the agent does, in order.</p>
              </div>
            </div>
            <CodeBlock language="text" showCopy={false} wrap code={`1. search_jobs kind=design-eng band=floor
2. application_materials id=<note>
3. draft the resume variant and cover letter from the profile + posting
4. cover_letter_materials id=<note>, write it, then save_cover_letter id=<note> text=<letter>; fix what it flags
5. set_status id=<note> status=applying`} />
          </div>
        </Card>
      </div>
      <Card padding="none">
        <Table aria-label="MCP tools" density="md">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Tool</Table.HeadCell>
              <Table.HeadCell>What it does</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {TOOLS.map(([name, what]) => (
              <Table.Row key={name}>
                <Table.Cell><code className="mono">{name}</code></Table.Cell>
                <Table.Cell>{what}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>
      <p className="muted">Zengin's own MCP server (design-system checks for anyone editing this app) is configured alongside it in the same .mcp.json.</p>
    </>
  );
}
