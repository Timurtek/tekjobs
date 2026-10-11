# TekJobs on your tailnet

Reach your TekJobs app from your phone, or any device on your Tailscale network, at `https://tekjobs.<your-tailnet>.ts.net`. Tailnet only: nothing here is on the public internet.

TekJobs keeps running natively on your machine. A small Tailscale container joins your tailnet under the name `tekjobs` and forwards to the server on `127.0.0.1:8787`. TekJobs does not run inside Docker because cover letters, tailored resumes and the mail and calendar checks use the CLI you signed in to on the machine, the profile folder is a folder on the machine, and the scan runs the machine's Node.

It works while the machine is on. The morning scan and your phone read the same notes.

## Who gets in

The server answers loopback exactly as before. A request that arrives through the proxy must carry a Tailscale login that is on the allow list, otherwise it gets a 403. The list is empty by default, so nothing gets through until you set it:

- `TEKJOBS_ALLOWED_LOGINS=you@example.com` in the server's environment (comma-separated for more than one), or
- `"allowedLogins": ["you@example.com"]` in `~/.tekjobs/config.json`.

The server also refuses any Host that is not loopback or a `*.ts.net` name, which stops a web page from pointing its own domain at your machine. `TEKJOBS_TS_HOST=tekjobs.<your-tailnet>.ts.net` pins the one name it answers to. Restart the server after changing either setting.

Never turn on Funnel for this node. `serve.json` sets `AllowFunnel` to false.

## Set it up

1. Allow your login (above) and restart TekJobs.
2. Keep the server up. `tekjobs up` starts it detached. On Windows, `start-tekjobs.vbs` runs it hidden and restarts it 60 seconds after any exit; put a shortcut to it in `shell:startup` to start it at login, and stop it with `stop-tekjobs.cmd`. Its log is `~/.tekjobs/run/api-forever.log`.
3. In the Tailscale admin console, Settings, Keys, generate an auth key (reusable off, ephemeral off). Copy `.env.example` to `.env` here and put the key in it. `.env` is gitignored; never commit it.
4. `docker compose up -d` in this folder.
5. Open `https://tekjobs.<your-tailnet>.ts.net`. The first load takes a few seconds while the certificate is issued.

The key is used once, for the first login. The node's state lives in a named volume, and `restart: always` brings the container back with Docker.

## Without Docker

If Tailscale runs on the machine itself, one command does the same job under the machine's own name: `tailscale serve --bg 8787`, then open `https://<machine>.<your-tailnet>.ts.net`. The allow list applies the same way.
