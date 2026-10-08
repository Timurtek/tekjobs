---
title: Letters, resumes and the copy panel
order: 8
summary: Drafted from your resume of record, checked against it, saved into the note. You send.
---

## The application packet

Each job note has an Application section: narrative, resume variant, tailored summary, tailored bullets, portfolio, cover letter, questions, risks, outreach message, contact or referral, deadline, applied on, follow-up due. The sheet edits them as fields; an agent fills the same fields over MCP with `save_application_field`. When every required field has something in it, the packet is ready for approval, which says the boxes are full, not that the application is good.

## Cover letters

"Write cover letter" runs your local CLI with one prompt: the posting, your resume as the only source of facts, your profile, positioning, what the packet already decided, and binding rules: no invented figures, name the company in the first two sentences, no dashes, no placeholders. How it sounds comes from `Profile/Voice.md`: your voice rules, the shape of a letter you would send, and samples of your own prose; edit that note to change every letter after it. The result is saved under `## Cover letter` in the note and checked: figures not on your resume, stock phrases, a letter that never names the company, and the tells of a generated letter.

## Tailored resumes

"Tailor my resume to this posting" produces a version of your resume of record with the summary rewritten for the posting and the bullets, capabilities and products reordered and pruned. It may not add anything: the check traces every bullet back to a line of your real resume and flags any bullet, figure, date range or job header that is not there. The print view is where the PDF you upload comes from.

## Resume variants

A folder of resume files (`Templates/Resume` in the profile folder, or any folder set in Settings) is listed on the Profile page. Any one becomes the resume of record with a click; the packet's Resume variant field offers the names.

## The copy panel

The clipboard icon in the top bar opens one-click snippets: name, email, phone, location, links, availability, the salary answer, and anything you add. Type a few letters and Enter copies the first match. Customize edits labels, groups, values and order; the list is `Profile/Snippets.md`. Over MCP, `list_snippets` gives an agent the same answers verbatim.

## Adding a job you found yourself

Paste the link: Add by link on Jobs, `tekjobs add <url>`, or `add_job` over MCP. A Greenhouse, Lever or Ashby link is read through the board's API; a Google or Apple job page through the scan's own parsers; a LinkedIn job link is opened once as a signed-out visitor and its company apply link followed when it names one; any other page through its JSON-LD or its best title and text. A note that has no posting takes one later through the sheet's Attach posting: Attach reads it and replaces the facts, Link only records just the link.

## The calendar

Interviews, follow-ups and deadlines have [a page of their own](/docs/calendar). In short: the Calendar page reads the dated lines the notes carry: interviews from the packet's **Interview on** field, follow-ups from **Follow-up due**, deadlines from **Deadline**, and the applied dates as the trail behind. You fill Interview on yourself (a date and time in your own time zone, like `2026-10-14 15:00`), or a confirmed scheduling email fills it when it names a time. Nothing comes from a calendar service.

The other direction is a check, like mail: "Check Google Calendar" on the Calendar page reads your Google Calendar through the local CLI's connector with its read tools only (list, search, get; create, update, delete and respond are denied by name), finds interviews, screens, recruiter calls and deadlines about jobs on your board, and shows each one matched to a note for you to confirm. Confirming puts the event's time into the note's Interview on field, moves a note that is not yet interviewing, and records the event on the note. It needs Claude Code with the Google Calendar connector enabled, and it never writes to the calendar. `tekjobs calendar check` does the same from a terminal, and `calendar_check` and `calendar_items` over MCP.

The same dates are served as an `.ics` feed at `/api/calendar.ics` on the TekJobs server. Apple Calendar and Outlook on this machine can subscribe to that address and refresh it on their own; Google Calendar cannot reach your machine, so download the file from the page and import it. TekJobs never writes to your calendar.
