// The remote guard: loopback answers as before; a proxied request needs an allowed tailnet login; any Host that is not
// loopback or a *.ts.net name is refused first (DNS rebinding). An empty allow list refuses every proxied request.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardSettings, remoteRefusal } from '../app/server/guard.mjs';

const settings = guardSettings({ TEKJOBS_ALLOWED_LOGINS: 'Jordan@Example.com, sam@example.com' });
const req = (headers) => ({ headers });
const TS = 'tekjobs.example-tailnet.ts.net';

test('the allow list comes from the environment, trimmed and lowercased', () => {
  assert.deepEqual([...settings.allowed], ['jordan@example.com', 'sam@example.com']);
});

test('a direct loopback request answers as before', () => {
  for (const host of ['127.0.0.1:8787', 'localhost:5173', '[::1]:8787']) assert.equal(remoteRefusal(req({ host }), settings), null, host);
});

test('a proxied request with no identity is refused', () => {
  assert.match(remoteRefusal(req({ host: TS }), settings), /no Tailscale identity/);
  assert.match(remoteRefusal(req({ host: '127.0.0.1:8787', 'x-forwarded-for': '100.64.0.9' }), settings), /no Tailscale identity/);
});

test('a login that is not on the list is refused; one that is, in any case, gets through', () => {
  assert.match(remoteRefusal(req({ host: TS, 'x-forwarded-for': '100.64.0.9', 'tailscale-user-login': 'someone@example.com' }), settings), /not allowed/);
  assert.equal(remoteRefusal(req({ host: TS, 'x-forwarded-for': '100.64.0.9', 'tailscale-user-login': 'JORDAN@example.com' }), settings), null);
});

test('a Host that is neither loopback nor a tailnet name is refused, whatever the headers say', () => {
  assert.match(remoteRefusal(req({ host: 'evil.example', 'tailscale-user-login': 'jordan@example.com' }), settings), /not answered here/);
  assert.match(remoteRefusal(req({}), settings), /no host/);
});

test('TEKJOBS_TS_HOST pins the one tailnet name', () => {
  const pinned = guardSettings({ TEKJOBS_ALLOWED_LOGINS: 'jordan@example.com', TEKJOBS_TS_HOST: TS });
  const ok = { 'x-forwarded-for': '100.64.0.9', 'tailscale-user-login': 'jordan@example.com' };
  assert.equal(remoteRefusal(req({ host: TS, ...ok }), pinned), null);
  assert.match(remoteRefusal(req({ host: 'other.example-tailnet.ts.net', ...ok }), pinned), /not answered here/);
});

test('with no list configured, every proxied request is refused', () => {
  const none = { allowed: new Set(), tsHost: '' };
  assert.match(remoteRefusal(req({ host: TS, 'x-forwarded-for': '100.64.0.9', 'tailscale-user-login': 'jordan@example.com' }), none), /not allowed/);
  assert.equal(remoteRefusal(req({ host: '127.0.0.1:8787' }), none), null);
});
