---
title: Run it in Docker
order: 10.6
summary: TekJobs on a machine that stays on, a NAS, a home server or a small VPS, in two containers, reachable only from your own Tailscale network.
---

[Reach it from your phone](/docs/remote-access) keeps TekJobs on the computer you work on and puts only Tailscale in a container. That is the right setup for most people, but it stops answering when the laptop sleeps. If you have a machine that stays on, TekJobs can live there instead: the daily scan runs whether or not your laptop is open, and your phone always finds it.

## What you get

- **Two containers.** `tailscale` joins your tailnet as `tekjobs`. `tekjobs` runs the app and the daily scan, and shares the Tailscale container's network.
- **The same privacy rules.** The server still answers only on `127.0.0.1` inside its container. `tailscale serve` is the one way in, no port is opened on the host, and Funnel is off, so nothing is on the public internet. A request through Tailscale gets in only with a login on your allow list.
- **Your notes stay files.** The profile folder is a folder on the host, mounted into the container. Open it in Obsidian, back it up and sync it as you like.
- **The image** is `ghcr.io/timurtek/tekjobs`, for amd64 and arm64 (most NAS boxes and the Raspberry Pi), published with every release.

## What works, and what needs more

Scanning, scoring, the pipeline, people, the copy panel and the app on your phone all work as soon as the containers are up.

Cover letters, tailored resumes and the mail and calendar checks run the Claude command line. It is in the image, but it needs signing in, through one of these in `.env`:

- `CLAUDE_CODE_OAUTH_TOKEN`: run `claude setup-token` on a computer where you are signed in to Claude. It prints a long-lived token for your subscription.
- `ANTHROPIC_API_KEY`: an API key, billed by use.

Without either, those features say the CLI is not signed in, and everything else carries on. The mail and calendar checks read through your Claude account's Gmail and Google Calendar connectors. Check that they answer on the machine before you add them to the daily run.

## 1. Fill in .env

On the machine that stays on, get the files in [`deploy/docker`](https://github.com/Timurtek/tekjobs/tree/main/deploy/docker): `docker-compose.yml`, `serve.json` and `.env.example`. Copy `.env.example` to `.env` and fill it in:

| Setting | What it is |
| --- | --- |
| `TS_AUTHKEY` | Tailscale admin console → Settings → Keys → Generate auth key (reusable off, ephemeral off). Only the first start uses it. |
| `TEKJOBS_ALLOWED_LOGINS` | Your Tailscale login, the email you sign in to Tailscale with. Comma-separated for more than one. |
| `TEKJOBS_PROFILE_DIR` | The folder on this machine that holds your profile. |
| `PUID`, `PGID` | The owner of that folder (`id -u`, `id -g`), so the notes TekJobs writes stay yours. |
| `TZ` | Your time zone, for example `America/Los_Angeles`. The daily run and every date in a note use it. |
| `TEKJOBS_SCAN_TIME` | When the daily run starts, `HH:MM`, or `off`. |
| `TEKJOBS_DAILY` | What it does: `scan`, and `mail` and `calendar` once the CLI is signed in. |

`.env` holds keys: keep it out of git and off shared drives.

## 2. Start it

```bash
docker compose up -d
```

The first time, start your search inside the container. It writes into your profile folder:

```bash
docker compose exec tekjobs tekjobs init
```

Or, to look around with a fictional search first:

```bash
docker compose exec tekjobs tekjobs init --sample /vault
```

Then open `https://tekjobs.<your-tailnet>.ts.net` from any device on your tailnet. The first load takes a few seconds while Tailscale gets the certificate.

## 3. Your notes, on the laptop too

The container writes notes into `TEKJOBS_PROFILE_DIR`. To read them in Obsidian on another computer, keep that folder in step with a sync tool: Obsidian Sync, Syncthing, or a git repository you push and pull. Every sync tool can conflict when the same note changes in two places at once. TekJobs writes job notes when it scans and when you act in the app, so make your changes in the app, or let a sync finish before you edit the same note in Obsidian.

## Every day

- `docker compose logs -f tekjobs` shows the server and the daily run: when the next one is, and what it found.
- `docker compose exec tekjobs tekjobs status` shows where the profile stands.
- Any `tekjobs` command runs the same way, with `docker compose exec tekjobs` in front.

## Updates and backups

```bash
docker compose pull && docker compose up -d
```

Set `TEKJOBS_VERSION` in `.env` to a release number to stay on it instead of following the newest. Your search is the profile folder: back that folder up and you have everything. The volumes keep the Tailscale node, `~/.tekjobs` and the Claude CLI's sign-in, all of which can be made again.

## What it does not do

- It does not open a port on the host or on the internet. To reach it from the machine itself, use the tailnet address there too.
- It does not read your LinkedIn export from your laptop's Downloads. Mount the folder that holds the zip with one more line under `volumes`, read-only (`/path/to/downloads:/imports:ro`), and import from `/imports`. Or import on your laptop into the synced folder. Keep the zip out of the profile folder itself, or every sync copies it.
- It does not replace [the native setup](/docs/remote-access) on the computer you work on. There, TekJobs uses your own signed-in CLI and your own folders directly, and that stays the simpler path.
