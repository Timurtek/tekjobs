---
title: Your LinkedIn history
order: 7.5
summary: One zip from LinkedIn becomes who you know at each company and the recruiters who wrote. Read in place, written only into your folder.
---

LinkedIn holds years of your search: everyone you are connected to and where they work, every recruiter who ever wrote, every application you sent through it. It will hand all of that to you as a zip, and TekJobs reads the parts a search can use.

## Get the archive

1. Open [linkedin.com/mypreferences/d/download-my-data](https://www.linkedin.com/mypreferences/d/download-my-data) (Settings, Data privacy, Get a copy of your data).
2. Choose the **larger archive**, the one described as everything. The smaller pick-and-choose export leaves out connections and messages, which is most of the value.
3. Request it. LinkedIn emails a first, partial zip in about ten minutes and the complete one within 24 hours; use the complete one. It downloads as `Complete_LinkedInDataExport_<date>.zip`.

Keep the zip where it lands. TekJobs reads it in place and never copies it.

## Run the import

```
tekjobs import linkedin ~/Downloads/Complete_LinkedInDataExport_2026-09-24.zip
```

An unpacked folder works too. `--preview` prints what would be written and writes nothing; `--since 2026-09-01` sets how far back messages count (90 days by default); `--dry` runs everything but the writes. From the app, the same import is a card at the bottom of the People page, with a Preview button. Over MCP it is `import_linkedin`, and afterwards `connections_at` answers "who do I know at X" for any company.

## What it writes, and where

Everything lands in your profile folder. Nothing goes anywhere else, and nothing is sent.

- **Who you know where.** An index in the folder's data directory (`.tekjobs/linkedin.json`) of your connections with a normalised company key. Every job note's People tab, and the Jobs sheet, then shows the connections you have at that company, recruiters first, with a link to each profile. A warm introduction beats a cold apply, and until now the app had no idea you had any.
- **The people who wrote.** The senders of your conversations, and the people behind invitations, since the date. The ones whose title says recruiter or hiring manager become People notes: role, company and title from their connection record, a link to their profile, the thread as dated lines under their Log, and a link to any open job note at their company (the job note gets them under its People). Everyone else is counted and skipped; `--everyone` writes them too.
- **Applications and saved jobs** are indexed with their dates, for the pipeline history and the saved-links flow that come next.

Re-running is safe: people are recognised, not duplicated; log lines already present are not appended again; the index is rebuilt.

## What it never reads

Ads clicked, reactions, shares, comments, search queries, learning history, logins, your saved application answers and screening responses, phone numbers, email addresses of others beyond what the connections file already carries, birth date, addresses. The files are never opened. The export also contains your own profile CSV; the import reads your name from it, to tell your side of a conversation from theirs, and nothing else.

## Privacy, plainly

The archive is about you and about thousands of other people. What the import writes about them (a name, a title, a company, a profile link, what they wrote to you) goes into notes in your folder, which is private to you. Treat the folder that way: it is not something to publish or to put in a shared repository. TekJobs' own repository ships only the code and a fictional test export; your archive is on the ignore list by name and by extension.
