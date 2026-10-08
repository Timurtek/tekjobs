import { Card, CodeBlock, Skeleton, Table, TextField } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type McpTool } from "../api";

const MCP_JSON = `{
  "mcpServers": {
    "tekjobs": {
      "command": "tekjobs",
      "args": ["mcp"]
    }
  }
}`;

/**
 * Agent access: the MCP server the app ships, how each client connects to it, and the tools it offers, read
 * from the server itself so the list is never out of date.
 */
export function Agent() {
  const [tools, setTools] = useState<McpTool[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { api.tools().then(setTools).catch(() => setTools([])); }, []);
  // The catalogue is long; a filter and a closed disclosure keep it from being the page.
  const needle = q.trim().toLowerCase();
  const shown = (tools ?? []).filter((t) => !needle || t.name.includes(needle) || t.description.toLowerCase().includes(needle));
  return (
    <>
      <div className="page__head">
        <div>
          <p>The app ships its own MCP server, so an agent can run the search without this screen: find matches, move them, draft applications, add boards, start scans, read the mailbox. Everything it writes lands in the same markdown notes. No API key is involved; the model is whichever one is running the session.</p>
        </div>
      </div>
      <div className="charts">
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2>Connect your client</h2>
                <p>The server is <code className="mono">tekjobs mcp</code> on stdio. Claude Code is one line; Codex, Cursor and Claude Desktop take the same command in their MCP settings.</p>
              </div>
            </div>
            <CodeBlock code={"claude mcp add tekjobs -- tekjobs mcp"} language="bash" />
            <CodeBlock code={MCP_JSON} language="json" />
            <p className="muted">On Windows, if the server shows as failed to start, give the npm shim a shell: <code className="mono">claude mcp add tekjobs -- cmd /c tekjobs mcp</code>. From a clone of the repository, <code className="mono">app/.mcp.json</code> connects the server whenever Claude Code is opened in <code className="mono">app/</code>; the command there is <code className="mono">node server/mcp.mjs</code>.</p>
            <p className="muted">Then say: <em>Use the tekjobs MCP server. Call onboarding_status, then onboarding_materials, and follow its script.</em></p>
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
      <details className="agent__all" open={!!needle || undefined}>
        <summary>{tools ? `Browse all ${tools.length} tools` : "Browse the tools"}</summary>
        <div className="agent__filter">
          <TextField size="sm" label="Filter" placeholder="mail, criteria, person…" value={q} onChange={(e) => setQ(e.target.value)} description={needle ? `${shown.length} of ${tools?.length ?? 0}` : "By name or by what it does."} />
        </div>
      <Card padding="none">
        {tools === null ? (
          <div className="loading"><Skeleton lines={6} /></div>
        ) : (
          <Table aria-label="MCP tools" density="md" stickyHeader>
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Tool</Table.HeadCell>
                <Table.HeadCell>What it does</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {shown.map((t) => (
                <Table.Row key={t.name}>
                  <Table.Cell><code className="mono">{t.name}</code></Table.Cell>
                  <Table.Cell><span className="muted">{t.description}</span></Table.Cell>
                </Table.Row>
              ))}
              {tools.length === 0 && (
                <Table.Row><Table.Cell colSpan={2}><span className="muted">The server did not answer; start it with <code className="mono">tekjobs up</code>.</span></Table.Cell></Table.Row>
              )}
              {tools.length > 0 && shown.length === 0 && (
                <Table.Row><Table.Cell colSpan={2}><span className="muted">Nothing matches "{q}".</span></Table.Cell></Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </Card>
      </details>
      <p className="muted">{tools ? `${tools.length} tools, read from the running server.` : ""} Confirming mail items and setting applied, interviewing or offer stay yours: an agent can read and draft, and moves a job only as far as ready.</p>
    </>
  );
}
