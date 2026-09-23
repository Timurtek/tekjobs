# Security

## Reporting

Email **hello@timurtek.com** with "TekJobs security" in the subject, or use GitHub's private vulnerability reporting on this repository. Please do not open a public issue for something exploitable. You will get an acknowledgement within three days and a fix or a plan within fourteen; credit in the release notes if you want it.

## What is in scope

**The hosted site, tekjobs.timurtek.com**, is the part that holds other people's data and takes money: Firebase sign-in, the session cookie, the job-posting records in Firestore, the Stripe Checkout hand-off and its webhook, and the public feed. Anything that lets one account read or change another's postings, publish without paying, forge a webhook, or read a secret is a report I want.

**The scan and the app** run on your own machine against your own files. A bug there is still a bug (open an issue), but it is not a vulnerability unless the software sends something somewhere it should not, or a malicious job posting on a public board can do something to the machine that scans it. That second case is in scope: postings are untrusted input, and the parsers, the Markdown renderer and the note writer should treat them that way.

## What is out of scope

- Your own profile folder, resume and notes: they are yours, on your disk, and the software never uploads them.
- The Claude, Gmail or other MCP connectors you attach: their security is theirs.
- Rate limiting or blocking by a job board. The scan identifies itself honestly in its user agent and reads public endpoints; if a board says no, it says no.

## What the software does not do

So a report is not needed for the absence of it: it does not send email, it does not submit applications, it does not contact LinkedIn, and it stores no secret in a Markdown note. Payment card details never reach the site; Stripe Checkout holds them.

## Supported versions

The latest release on `main`. There are no maintained older lines.
