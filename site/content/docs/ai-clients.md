---
title: Connect your AI client
order: 1.5
summary: One command, tekjobs mcp, and the exact lines for Claude Code, Codex, Cursor and Claude Desktop. ChatGPT's web app is the one that cannot.
---

TekJobs exposes its tools through a local MCP server, `tekjobs mcp`, speaking JSON-RPC over stdio. Every client below runs that command and talks to it. None of them needs a separate model API key: TekJobs adds no per-call AI billing, and usage follows the client you already have. The server finds your profile folder the same way the CLI does: `TEKJOBS_PROFILE` if set, else `~/.tekjobs/config.json` (which `tekjobs init` wrote), so it does not matter which folder your client is opened in.

Install the command first, and check it answers:

```
npm install -g @timurtekb/tekjobs
tekjobs --version
```

## Claude Code

```
claude mcp add tekjobs -- tekjobs mcp
```

Then, in any Claude Code session:

> Use the tekjobs MCP server. Call `onboarding_status`, then `onboarding_materials`, and follow its script: interview me, write my profile, set the criteria, run a dry scan, and show me the top matches.

From a clone of the repository you do not need the add: `app/.mcp.json` connects the server whenever Claude Code is opened in `app/`.

On Windows, if the server shows as failed to start, the npm shim needs a shell: `claude mcp add tekjobs -- cmd /c tekjobs mcp`.

## Codex

```
codex mcp add tekjobs -- tekjobs mcp
codex mcp list
```

Or by hand, in `~/.codex/config.toml`:

```
[mcp_servers.tekjobs]
command = "tekjobs"
args = ["mcp"]
```

Then open Codex and use the same onboarding prompt as above.

## Cursor and Claude Desktop

Both take a JSON block in their MCP settings: Cursor under Settings, MCP (or `.cursor/mcp.json` in a project); Claude Desktop in `claude_desktop_config.json` (Settings, Developer, Edit config).

```
{
  "mcpServers": {
    "tekjobs": {
      "command": "tekjobs",
      "args": ["mcp"]
    }
  }
}
```

Restart the application after saving. On Windows, use `"command": "cmd", "args": ["/c", "tekjobs", "mcp"]` if the server does not start.

## What about ChatGPT?

ChatGPT's web app does not connect to a local stdio MCP server. Its developer mode reaches remote MCP servers only, on eligible plans, which would mean putting TekJobs behind a tunnel with authentication in front of it. That is not the standard setup and not one we document. For an OpenAI model, use Codex with the local server above; it is the same tools and the same notes.

## What each client can and cannot do

Every client above can run the interview, search and move jobs, draft letters and resumes into the notes, add boards, and start scans: the full tool list is on [the MCP server](/docs/mcp) page. Two things are client-specific:

- **Check mail needs Claude Code**, with its Gmail connector enabled. The run allows three Gmail read tools by name and denies every write and shell tool, which is what makes it safe to run unattended. Another client would need a Gmail MCP with matching tool names. Everything else works without it.
- **The app's own Write cover letter and Tailor resume buttons** run a command-line LLM with the prompt as an argument. The default is Claude Code's `claude -p`; another command goes in Settings. Over MCP, any client drafts the same material through `cover_letter_materials` and `tailored_resume_materials`.

## Troubleshooting

**The client cannot find `tekjobs`.** Confirm the global install answered (`tekjobs --version`), then restart the client; most read their MCP configuration at start. If you installed with `npx` only, the command exists in npx's cache and not on your PATH: run `npm install -g @timurtekb/tekjobs`.

**The server appears, but with no tools.** Run `tekjobs mcp` in a terminal. A healthy server waits silently for JSON on stdin; an error about the profile folder means `tekjobs init` has not run, or `~/.tekjobs/config.json` points somewhere that has moved.

**The interview cannot read my resume.** `tekjobs status` says what the onboarding still needs, and `tekjobs resume <file>` imports or replaces the resume (PDF, DOCX, Markdown, text).

**I want to try it without my own data.** The repository ships a fictional profile folder, `samples/vault`; point `TEKJOBS_PROFILE` at it and the same client sees Jordan Example's search instead of yours. See [A look before you commit](/docs/getting-started).
