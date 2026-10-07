---
title: Settings and releases
order: 10
summary: The few things outside the folder, and how versions happen.
---

## Settings

The Settings page edits two files. `~/.tekjobs/config.json` is about this computer and is the only file kept outside the profile folder, because it says where the folder is: the profile folder itself (a change takes effect on the next server start; `tekjobs init <dir>` starts a new one with the starter notes), the writing CLI's command and arguments, and an optional contact added to the user agent on scan requests so a site can reach the person running it. `.tekjobs/settings.json` inside the profile is about this search: the resume of record and the resume variants folder. They live with the profile so a second profile on the same machine, such as the sample or a test persona, never sees another person's resumes. An install before 0.37.1 kept them in the machine file; they are moved into the profile they were saved for the first time it is read, and never applied to any other.

`TEKJOBS_PROFILE` in the environment wins over the file, and the page says when it does.

## Releases

Versions come from the commit messages, by semantic-release on every push to `main`: tests, the app's type check and `zengin check` run first; then `feat:` commits make a minor release and `fix:` and `perf:` a patch. The project is at 0.x on purpose, so a breaking change also bumps the minor until 1.0 is earned. Each release bumps `package.json`, writes `CHANGELOG.md`, tags `vX.Y.Z` and publishes the notes on GitHub. The app's sidebar footer shows the running version.

## The design system

The app and this site are built on [Zengin](https://zengin.timurtek.com): the components are copied into the project and owned there, tokens are declared once, and an engine checks every edit against them, whether a person or an agent made it. The TekJobs brand is one file, `src/theme/brand.css`: forest green surfaces, one lime accent, three typefaces, hairlines, no shadows, every number in mono.
