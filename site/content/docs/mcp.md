---
title: The MCP server
order: 9
summary: 42 tools over stdio, so an agent can run the whole search against the same notes.
---

`tekjobs mcp` (from a clone, `node app/server/mcp.mjs`) speaks JSON-RPC over stdio, no SDK. Claude Code, Codex, Cursor and Claude Desktop all run that one command; [Connect your AI client](/docs/ai-clients) has the exact line for each. ChatGPT's web app cannot reach a local stdio server; for an OpenAI model, use Codex.

| Area | Tools |
| --- | --- |
| Onboarding | `onboarding_status`, `onboarding_materials`, `save_profile`, `fetch_link`, `import_resume` |
| Finding | `search_jobs` (every Jobs filter), `get_job`, `today`, `summary`, `outcomes` |
| Moving | `set_status` (as far as `ready`), `add_note`, `save_application_field`, `application_packet`, `application_materials` |
| Writing | `cover_letter_materials`, `save_cover_letter`, `tailored_resume_materials`, `save_tailored_resume`, `list_snippets` |
| Adding | `add_job`, `attach_posting`, `add_company`, `list_companies`, `list_feeds` |
| Mail | `mail_check`, `mail_items` (read and start only) |
| People | `list_people`, `get_person`, `add_person`, `attach_person`, `log_contact` |
| Criteria | `get_criteria`, `set_criteria`, `preview_criteria`, `list_criteria_presets`, `save_criteria_preset`, `activate_criteria_preset` |
| Scans | `run_scan`, `scan_status`, `scan_preview` |

## The boundary, enforced

`set_status` refuses `applied`, `interviewing` and `offer` from an agent: those record something that happened outside the machine, and only the person it happened to can say so. An agent drafts a packet, moves the job to `ready`, and asks. Confirming a mail item is not a tool at all.

## The agent skill

The repository ships a Claude Code skill, `tekjobs-onboard`, which runs the interview: call `onboarding_status`, follow `onboarding_materials`' script literally, never scrape a LinkedIn profile, never invent a number for the profile.
