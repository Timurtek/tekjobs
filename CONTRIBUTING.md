# Contributing to TekJobs

Thanks for looking. TekJobs is one person's job-search machine made public; contributions that keep it useful for the next person are welcome. This page is the short version of how the repository works, so a first pull request does not bounce on mechanics.

## The most useful contribution

A board. `src/starter/companies-table.md` is the registry every new profile folder starts with: company, platform, slug, tier, notes. If a company you follow runs Greenhouse, Lever, Ashby, Workday, Rippling, SmartRecruiters, Workable, BambooHR, Breezy, Personio, Teamtailor or Eightfold and is not in the table, add a row. Test it first:

```
node run.mjs --dry --only <slug>
```

A row that answers `ok · N` is good. `ok · 0 jobs (slug?)` usually means the slug is wrong or the board moved; `bad-slug (HTTP 404)` means it is wrong.

The second most useful contribution is a source adapter for a platform the scan does not read yet. Look at `fetchWorkable` in `src/sources-extra.mjs` for the shape: one function, the normalized job object from `job()`, `{ ok, jobs }` or `{ ok: false, error }`. Add it to `fetchExtraCompany` and `EXTRA_ATS`, and a line to the README's source list.

## Three parts, three installs

| Folder | What | Install | Check |
|---|---|---|---|
| `/` | the scan, the CLI, scoring, the profile folder | `npm install` (one dependency) | `npm test` |
| `app/` | the app, its API server and the MCP server (Vite, React, Zengin UI) | `cd app && npm install` | `npm run build && npx zengin check` |
| `site/` | tekjobs.timurtek.com: landing, docs, employer postings (Next.js on Zengin UI) | `cd site && npm install` | `npx zengin tokens && npx tsc --noEmit -p . && npx zengin check` |

CI runs all three on every push and pull request. Run the ones you touched before opening the PR.

One thing a fresh clone trips on: the design tokens (`src/styles/generated/tokens.css` in the app and the site) are generated, not committed. `npm run dev` and `npm run build` in either folder generate them first; calling `vite` or `next` directly on a fresh clone fails until you have run `npx zengin tokens` once.

Nothing personal goes in the repository. Your profile folder (default `~/.tekjobs/profile`) and `~/.tekjobs/config.json` live outside it, and `data/` and every `.env*` file except `.env.example` are ignored. If a test needs a job note or a resume, invent one; see `test/` for the pattern.

## The design system

The app and the site are built on [Zengin UI](https://zengin.timurtek.com), and `npx zengin check` must report zero violations. In practice:

- Colors, spacing and type come from tokens (`var(--color-primary)`, `var(--spacing-4)`), never literals. `brand.css` is the one file allowed raw values.
- Use the components in `src/components/ui`. A raw `<button>` styled like a button is rejected; wrap it with `<Button asChild>`.
- `className` on a component is for layout only (where it sits), not for restyling it.

The pre-commit hook runs the same check on the files you changed and tells you the nearest token when it finds a literal.

## Commits

Conventional Commits, enforced by commitlint on `commit-msg`:

```
feat(app): sources page with board and feed health
fix(site): accept the service account however it was pasted
chore: check out every text file as LF
```

The subject starts lowercase (the hook rejects a capital), `feat` releases a minor version, `fix` and `perf` a patch, and `docs`, `chore`, `refactor`, `test` release nothing. Releases are cut by semantic-release when a commit lands on `main`; you never touch `package.json`'s version or `CHANGELOG.md` by hand. While the project is `0.x`, a breaking change is still a minor.

## Pull requests

Open the PR against `main`. Say what changed and how you checked it; a screenshot for anything visual. One concern per PR is easier to review than one PR per week.

Things that will not be merged, and why:

- Anything that contacts LinkedIn on a user's behalf (scraping profiles, sending messages). The tool reads the alert emails a person saved and a job link a person pasted, and stops there.
- Anything that submits an application or sends a message without the person doing it. Drafts yes; sending no.
- A source that needs an account or a paid key to be on by default. Optional, off by default, documented, is fine (Adzuna and USAJOBS are the pattern).

## Reporting a problem

Use the issue templates. For a board that stopped fetching, the Sources page's health line (state, last success, last error) is most of the report. For a security problem, read `SECURITY.md` instead of opening an issue.
