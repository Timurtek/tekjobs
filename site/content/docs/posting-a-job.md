---
title: Posting a job
order: 11
summary: For employers. What a posting is here, what it costs, what it cannot buy.
---

## Who reads it

Nobody browses TekJobs. Each user runs their own copy, which reads hundreds of boards every morning and scores every posting against criteria they wrote: title terms, keywords, a pay floor, a remote rule. A posting on tekjobs.timurtek.com is one more feed in that scan. The people it fits see it on their Today page with the reasons it scored; the people it does not fit never see it.

That is the whole product. There is no inbox blast, no promoted slot, no list of who looked, and no applicant tracking. Readers apply to you directly through the link or email you give.

## Writing one

Sign in at [Post a job](/post-a-job). With no postings yet, the form is the page. It asks for the job, where it is, what it pays, what the work is, and how to apply.

Pay is required, both ends, as annual base in US dollars. Every reader's criteria carry a pay floor, and a posting with no stated range scores below one with, so leaving it out costs you the readers you most want.

The description takes Markdown and has a preview. Keywords in the text are what the score reads. A paragraph that says what the team builds and which systems it uses beats a list of buzzwords, because the score caps keyword points and a reader's title terms need the real title.

A posting saves as a draft and can be edited until it is paid. You can hold as many drafts as you like.

## Paying

$49, once, for 30 days from the day the posting goes live. Checkout is Stripe's; the card details never reach this site. When Stripe confirms the payment the draft goes live and enters the feed within five minutes, so it is in the next morning's scan for everyone.

A live posting can be edited; the feed serves the new text on its next read. Closing it takes it out of the feed and keeps it as your record. A closed posting does not reopen; a new posting is a new purchase. Refunds follow the [refund policy](/legal/refunds).

## Where it shows

Three places. Every TekJobs user's morning scan, where it is scored against their criteria and, if it clears their bar, filed as a note with the reasons. The public board at [/jobs](/jobs), newest first, for anyone without the software. And its own page, `/jobs/<id>`, with the description, the pay, the apply button and the structured data search engines read, so the posting is indexable from the day it goes live. A closed or expired posting leaves all three; you keep the record.

## What paying does not buy

A place in anyone's ranking. The score is the reader's criteria against your text, and the `tekjobs` source has no weight of its own. Any user can also drop the feed entirely with one line in their criteria.

## The rules

The [Terms of Use](/legal/terms#3-job-postings) carry the posting rules: real jobs at real companies, stated pay, no fees to applicants, no discriminatory requirements, and removal without refund for postings that break them.

## For developers

The feed is public: `GET /api/feed/jobs` returns every live posting in the scan's normalized job shape, cached for five minutes. It is what `fetchTekJobs` in `src/sources-extra.mjs` reads, and anyone is welcome to read it.
