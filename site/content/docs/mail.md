---
title: Mail says
order: 6
summary: Application emails, read once through your own CLI, matched to notes, confirmed by you.
---

Applications come back as email: a confirmation, a rejection, an interview request. The mail check reads those through the same local CLI that writes the letters, using the Gmail connector already attached to it, with the run boxed: only Gmail's three read tools are allowed and every write tool is denied by name, so a run can read and nothing else, whatever the model decides.

The model only extracts: company, role, kind, date, a one-line gist, the sender, the message id. Matching each email to a note and everything that changes a note is ordinary code, and nothing changes until you confirm an item on the Mail page.

## What confirming does

- A confirmation on a note you had not marked applied marks it applied as of the mail's date and fills the packet's Applied on when empty. On a note already applied, it records the mail.
- A rejection marks the note rejected.
- An interview or scheduling email marks it interviewing.
- An email about a role the vault has no note for offers to create one, with the company's other notes as a pick.
- Every confirmed email writes a dated line with the gist and a link to the message into the note.
- When a human wrote the email (not a no-reply address), that person is added to People and put on the note.

Several emails about one application are grouped; the strongest speaks for the group. **Confirm the exact matches** handles the safe set in one click: confirmations whose note matched by exact title.

## When it runs

`run.cmd` reads the mailbox right after the morning scan. Check mail on the Mail page reads again now; `tekjobs mail --days N` does it from a terminal; `mail_check` and `mail_items` over MCP read and start only. Confirming stays yours.
