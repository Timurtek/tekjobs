---
title: The profile folder
order: 2
summary: One folder of markdown is the database, the config and the record. Everything reads and writes it.
---

The folder is resolved from `TEKJOBS_PROFILE`, then `~/.tekjobs/config.json`, then `~/.tekjobs/profile`. Point Obsidian at it; the app and the MCP server read and write the same files.

| Path | What |
| --- | --- |
| `Profile/Profile.md` | Who you are: location, availability, links, the facts every application reads. The interview writes it; you keep it current. |
| `Profile/Positioning.md` | How the story is told: which half leads for which posting, the evidence rule, what must never be claimed. |
| `Profile/Voice.md` | How you write. The cover-letter writer treats this note as binding. |
| `Profile/Resume.md` | The resume of record, synced from your resume file. Every tailored resume and letter starts from it. |
| `Profile/Snippets.md` | The copy panel's lines: a json block of label, group, value. |
| `Targets/Search Criteria.md` | The scoring JSON the scan reads. |
| `Targets/Criteria/` | Named criteria presets, one note each. |
| `Targets/Companies.md` | The board watchlist: company, platform, slug, tier, last fetch. |
| `Targets/Job Views.md` | Saved filter views for the Jobs page. |
| `Jobs/` | One note per match: frontmatter, why it matched, status log, notes, application packet, people, the posting. |
| `People/` | One note per person: role, company, email, threads, a dated log. |
| `Templates/Resume/` | Resume variants, any of which can become the resume of record. |
| `Inbox/` | Job-alert emails you save here are read by the scan. |
| `Logs/` | One note per scan. |
| `.tekjobs/` | Scan state and mail state. Not notes. |

## What is never rewritten

A job note is written once. After that the scan only flips `listing: open` to `listing: closed <date>` when the posting disappears. Everything the app writes later is an append: a status-log line, a note, a packet field, a mail line, a person. The two exceptions are things you ask for on one note: Attach posting, which replaces the posting's facts, and `rescore --full`, which rewrites the score and reasons under new criteria and says so in the log.

Your `status:` edits are the record. `applied`, `interviewing` and `offer` can only be set by a person, in the app or by hand, because only a person knows.
