---
title: Scoring and criteria
order: 3
summary: Additive points from rules you own, every point written down as a reason.
---

Everything is in the json block of `Targets/Search Criteria.md`, which the interview writes and the Criteria page edits as fields: title terms (weighted), hard exclusions, description keywords, seniority words, the remote rule, a pay floor with a stretch band beneath it, recency, and which aggregator feeds are on. A posting needs `minScore` to become a note.

## How a score is built

| Component | Rule |
| --- | --- |
| Title | The best-matching term carries its weight; extra hits add a little and then stop. No match is a penalty. |
| Seniority | A boost or a penalty for words in the title (senior, staff, principal, director, intern). |
| Description | Keywords found in the posting text, capped, so vocabulary cannot outrank fit. |
| Location | A boost for remote; a penalty for on-site when remote is required; a boost for your metro terms; a penalty for locations outside your country. |
| Pay | Clearing the floor earns a fixed amount plus more per $10k above it, capped; the stretch band is a small penalty; under it a larger one. |
| Recency | Fresh postings earn more, in tiers: two days, a week, a month, a quarter. |

The Job sheet's **Match reasons** tab shows each row with its signed points and the fit as a share of what the criteria can award.

## Presets

Named criteria sets live under `Targets/Criteria/`. Save the current form as one, load one to edit it, make one the active set, or run a single scan with it without touching the daily scan: `tekjobs scan --criteria "<name>"`, the Score with picker on Runs, or `run_scan` with `criteria` over MCP. Every run logs which set it scored with, and every note carries that set's weights fingerprint.

## Changing the rules after the fact

`tekjobs rescore --full --dry` shows what the existing notes would score under the new rules, rebuilt from each note, with recency judged at the day the note was found and description points kept where the note holds only part of the posting. Without `--dry` it applies: score, pay band, the match reasons, and a status-log line on every note that moved. Notes already at the target weights are skipped, so a second run does nothing.

**Preview impact** on the Criteria page does the same arithmetic for a proposed set before you save it: who rises above the bar, who falls below, the biggest movers.
