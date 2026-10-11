---
title: Reach it from your phone
order: 10.5
summary: Your own machine, on your own Tailscale network, at https://tekjobs.your-tailnet.ts.net. Nothing on the public internet, and only the logins you name get in.
---

TekJobs runs on your machine and answers only on `127.0.0.1`. With [Tailscale](https://tailscale.com), the private network that joins your own devices, you can open the same app from your phone: read Today on the bus, move a job to interviewing right after the call, pull an answer from the copy panel while you fill in a form. The notes never leave your machine. Your phone reaches the server on it.

It works while the machine is on. Leave it running, and the 07:30 scan and your phone read the same notes.

## What stays private

- **Tailnet only.** The address is reachable from devices signed in to your Tailscale network and from nowhere else. Never turn on Tailscale Funnel for it: that would put your job search, your contacts and your LinkedIn export on the public internet.
- **Only the logins you name.** A request that comes through Tailscale carries the Tailscale login of the person sending it. TekJobs refuses it with a 403 unless that login is on your allow list. The list starts empty, so nothing gets through until you add yourself.
- **Only its own names.** The server also refuses any request addressed to a name that is not `127.0.0.1`, `localhost` or a `*.ts.net` address. That stops a web page you happen to have open from pointing its own domain at your machine and talking to TekJobs.
- **Nothing changes on the machine itself.** The app at `http://127.0.0.1:8787` works exactly as before.

## 1. Name who may come in

Add your Tailscale login, the email you sign in to Tailscale with, to `~/.tekjobs/config.json`:

```json
{
  "profile": "…",
  "allowedLogins": ["you@example.com"]
}
```

Or set `TEKJOBS_ALLOWED_LOGINS=you@example.com` in the server's environment (comma-separated for more than one). Then restart the server: `tekjobs down`, then `tekjobs up`.

Add the login your phone uses, if it is different from the one on the machine.

## 2. Keep the server up

`tekjobs up` starts the app detached: it keeps running when you close the terminal, until `tekjobs down` or a restart. To have it come back on its own:

- **Windows.** `deploy/tailscale/start-tekjobs.vbs` in the repository runs the server with no window and restarts it a minute after any exit. Put a shortcut to it in `shell:startup` (press Win+R and type `shell:startup`) to start it when you log in. `deploy/tailscale/stop-tekjobs.cmd` stops it; `tekjobs down` does not, because it is not the server `tekjobs up` started. Its log is `~/.tekjobs/run/api-forever.log`.
- **macOS and Linux.** Run `tekjobs up` at login: a Login Item, a launchd agent, or an `@reboot` line in your crontab with the full path (`which tekjobs` prints it), since cron runs without your usual PATH.

## 3. Put it on your tailnet

Two ways. Both give you an HTTPS address with a real certificate.

### The short way: Tailscale on the machine

If the Tailscale app runs on the machine, one command shares the server with your tailnet under the machine's own name:

```
tailscale serve --bg 8787
```

Open `https://<machine>.<your-tailnet>.ts.net`. `tailscale serve status` shows what is shared; `tailscale serve --https=443 off` stops it. This is the way to go on Linux.

### The Docker way: its own name, started with Docker

This is how the author runs it. A small Tailscale container joins your tailnet as its own device, named `tekjobs`, and forwards to the server on your machine. It starts whenever Docker starts, and it gets an address of its own: `https://tekjobs.<your-tailnet>.ts.net`. You need Docker Desktop, on Windows or macOS.

TekJobs itself stays outside the container on purpose. Cover letters, tailored resumes and the mail and calendar checks use the AI command line you signed in to on the machine, and the scan and your profile folder live there too. Run inside a container, they would stop working.

The files are in [`deploy/tailscale`](https://github.com/Timurtek/tekjobs/tree/main/deploy/tailscale) in the repository:

1. In the Tailscale admin console, open **Settings → Keys** and generate an auth key, with reusable and ephemeral both off. It is used once, to sign the container in.
2. In `deploy/tailscale`, copy `.env.example` to `.env` and put the key in it as `TS_AUTHKEY=`. `.env` is ignored by git. Never commit it, and never paste it into the example file.
3. Run `docker compose up -d` in that folder.
4. Open `https://tekjobs.<your-tailnet>.ts.net`. The first load takes a few seconds while the certificate is issued.

After the first sign-in the key is spent and the container keeps its login in a Docker volume, so it comes back on its own whenever Docker does. `serve.json` sets Funnel off for this device.

On Linux the container cannot reach a server that listens only on `127.0.0.1`. Use the short way there.

## Check it

From any device on your tailnet, with Tailscale connected:

```
curl -s -o /dev/null -w "%{http_code}\n" https://tekjobs.<your-tailnet>.ts.net/api/summary
```

`200` means you are in. A `403` says why in its body:

| The 403 says | What to do |
|---|---|
| `no Tailscale identity on a proxied request` | The request did not come from a signed-in tailnet user (a tagged device, or Funnel). Use a device signed in with your own login. |
| `tailnet user … is not allowed` | Add that login to `allowedLogins` and restart the server. |
| `requests for … are not answered here` | The address is not a tailnet name. Open the `*.ts.net` address, not an IP or another domain. |

## What it does not do

- **It needs the machine on.** It is your machine on your network, not a hosted service.
- **It is the app, not your AI client.** Claude's phone app and other hosted clients cannot reach TekJobs' tools this way: their connectors need a public address, and this one is deliberately private. On your phone you use the TekJobs app itself, in the browser. Today is laid out for a phone screen.
