// Who may ask the server: loopback as before; through a proxy, only a named tailnet user.
//
// The server binds 127.0.0.1 and has no accounts. Reaching it from a phone goes through `tailscale serve` (see
// deploy/tailscale), which adds X-Forwarded-For and the caller's Tailscale-User-Login. A proxied request must carry a
// login on the allow list; tagged nodes and Funnel traffic carry none, so they fail closed, and so does an empty list,
// which is the default. The list is TEKJOBS_ALLOWED_LOGINS (comma-separated) or "allowedLogins" in
// ~/.tekjobs/config.json. A request for any Host other than loopback or a *.ts.net name is refused before that: it
// closes DNS rebinding, where a web page points its own domain at 127.0.0.1 and could forge the identity header. Pin the
// one tailnet name with TEKJOBS_TS_HOST.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const hostname = (h) => String(h || '').toLowerCase().replace(/:\d+$/, '');

function configLogins() {
  try { return [].concat(JSON.parse(fs.readFileSync(path.join(os.homedir(), '.tekjobs', 'config.json'), 'utf8')).allowedLogins || []); } catch { return []; }
}

/** The allow list and the pinned tailnet name, from the environment, else the config file. */
export function guardSettings(env = process.env) {
  const logins = env.TEKJOBS_ALLOWED_LOGINS ? env.TEKJOBS_ALLOWED_LOGINS.split(',') : configLogins();
  return {
    allowed: new Set(logins.map((s) => String(s).trim().toLowerCase()).filter(Boolean)),
    tsHost: String(env.TEKJOBS_TS_HOST || '').trim().toLowerCase(),
  };
}

/** Why this request is refused, or null when it may go on. */
export function remoteRefusal(req, { allowed, tsHost }) {
  const host = hostname(req.headers.host);
  const known = LOOPBACK.has(host) || (tsHost ? host === tsHost : /^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/.test(host));
  if (!known) return `requests for ${host || 'no host'} are not answered here`;
  const proxied = req.headers['x-forwarded-for'] || !LOOPBACK.has(host);
  if (!proxied) return null;
  const login = String(req.headers['tailscale-user-login'] || '').toLowerCase();
  if (login && allowed.has(login)) return null;
  return login ? `tailnet user ${login} is not allowed` : 'no Tailscale identity on a proxied request';
}
