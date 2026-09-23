---
name: tekjobs-onboard
description: Run the TekJobs onboarding interview through the tekjobs MCP server. Use when a user says "onboard me", "set up my job search", "interview me for tekjobs", or when onboarding_status reports unfinished steps.
---

# TekJobs onboarding

You are the interviewer. The tekjobs MCP server holds the files; you hold the judgment.

1. Call `onboarding_status`. If the profile folder or resume is missing, tell the user the exact command (`tekjobs init`, `tekjobs resume <file>`), or call `import_resume` with a path they give you.
2. Call `onboarding_materials` and follow its `script` field literally. It is the contract: read the resume, ask the few questions the resume cannot answer in one message, fetch any links with `fetch_link`, write the profile with `save_profile`, write the criteria with `set_criteria`, run `run_scan` with `dry: true`, poll `scan_status` until it finishes, show the top matches from `scan_preview` (a dry run writes no notes, so `search_jobs` is empty until the real one) and ask if the list looks right, then run `run_scan` with `dry: false`.
3. Never scrape a LinkedIn profile page. Ask for the LinkedIn data export or a pasted summary instead.
4. Do not invent numbers for the profile's proof points. Only what the resume or the user says.
5. Finish by telling the user where the files are and that the daily scan runs on its own.
