# TekJobs in Docker

TekJobs on a machine that stays on (a NAS, a home server, a small VPS), reachable at `https://tekjobs.<your-tailnet>.ts.net` from your own devices and nowhere else.

- `docker-compose.yml`: two containers. `tailscale` joins your tailnet; `tekjobs` shares its network, so the server keeps answering only on 127.0.0.1 and `tailscale serve` is the one way in. No port is published, and Funnel is off.
- `serve.json`: the Tailscale proxy to the server on loopback.
- `.env.example`: copy to `.env` (gitignored) and fill in.
- `start.mjs`: the container's process. It runs the server and the daily run at `TEKJOBS_SCAN_TIME`.

```bash
cp .env.example .env    # then fill it in
docker compose up -d
docker compose exec tekjobs tekjobs init
```

The image is `ghcr.io/timurtek/tekjobs`, built from the [Dockerfile](../../Dockerfile) at the root and published for amd64 and arm64 with every release. The full guide covers the AI features, syncing your notes, updates and backups: [tekjobs.timurtek.com/docs/docker](https://tekjobs.timurtek.com/docs/docker).

On the laptop or desktop you work on, use [`deploy/tailscale`](../tailscale) instead. TekJobs runs natively there and uses your own signed-in CLI and folders.
