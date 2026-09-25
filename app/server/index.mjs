// TekJobs local server: JSON API over the vault + static hosting of the built app. No dependencies.
// Dev: `npm run server` here and `npm run dev` for Vite (proxies /api). Prod: `npm start` serves dist/ and the API on one port.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './store.mjs';
import * as letter from './cover-letter.mjs';
import * as tailored from './tailored-resume.mjs';
import * as mail from './mail-check.mjs';
import * as people from './people.mjs';
import * as linkedin from './linkedin-import.mjs';

const PORT = Number(process.env.PORT || 8787);
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve, reject) => { let s = ''; req.on('data', (d) => { s += d; if (s.length > 5e6) reject(new Error('body too large')); }); req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(Object.assign(new Error('invalid JSON body'), { status: 400 })); } }); });

const routes = [
  ['GET', /^\/api\/summary$/, () => store.summary()],
  ['GET', /^\/api\/today$/, (_, q) => store.today({ cap: Number(q.get('cap') || 7), waitingDays: Number(q.get('waitingDays') || 14) })],
  ['GET', /^\/api\/jobs$/, (_, q) => store.searchJobs({ ...store.filtersFromParams(q), sort: q.get('sort') || 'score', dir: q.get('dir') || 'desc', limit: Number(q.get('limit') || 500), offset: Number(q.get('offset') || 0) })],
  ['GET', /^\/api\/jobs\/facets$/, (_, q) => store.jobFacets(store.filtersFromParams(q))],
  ['GET', /^\/api\/jobs\/([^/]+)\/packet$/, (m) => store.applicationPacket(decodeURIComponent(m[1]))],
  // Cover letter: GET is the saved letter plus the draft run's state; POST starts a draft with the local CLI; PUT saves an edit.
  ['GET', /^\/api\/jobs\/([^/]+)\/cover-letter$/, (m) => letter.state(decodeURIComponent(m[1]))],
  ['POST', /^\/api\/jobs\/([^/]+)\/cover-letter$/, async (m, _, req) => letter.start(decodeURIComponent(m[1]), await readBody(req))],
  // Tailored resume: same shape. The print view is served as HTML below, outside the JSON routes.
  ['GET', /^\/api\/jobs\/([^/]+)\/resume$/, (m) => tailored.state(decodeURIComponent(m[1]))],
  ['POST', /^\/api\/jobs\/([^/]+)\/resume$/, async (m, _, req) => tailored.start(decodeURIComponent(m[1]), await readBody(req))],
  ['PUT', /^\/api\/jobs\/([^/]+)\/resume$/, async (m, _, req) => { const b = await readBody(req); tailored.save(decodeURIComponent(m[1]), b.text, 'app · edited by hand'); return tailored.state(decodeURIComponent(m[1])); }],
  ['PUT', /^\/api\/jobs\/([^/]+)\/cover-letter$/, async (m, _, req) => { const b = await readBody(req); letter.save(decodeURIComponent(m[1]), b.text, 'app · edited by hand'); return letter.state(decodeURIComponent(m[1])); }],
  ['GET', /^\/api\/jobs\/([^/]+)\/people$/, (m) => people.peopleOf(decodeURIComponent(m[1]))],
  ['GET', /^\/api\/jobs\/([^/]+)$/, (m) => store.getJob(decodeURIComponent(m[1]))],
  // People: one note per person under People/, linked from the job notes they are on.
  ['GET', /^\/api\/jobs\/([^/]+)\/connections$/, (m) => linkedin.connectionsAt(store.getJob(decodeURIComponent(m[1])).company)],
  ['GET', /^\/api\/linkedin$/, () => linkedin.status()],
  ['POST', /^\/api\/linkedin\/preview$/, async (_, __, req) => { const b = await readBody(req); return linkedin.preview(b.source, { since: b.since || undefined, everyone: !!b.everyone }); }],
  ['POST', /^\/api\/linkedin\/import$/, async (_, __, req) => { const b = await readBody(req); return linkedin.runImport(b.source, { since: b.since || undefined, everyone: !!b.everyone, writePeople: b.writePeople !== false, writeSnippets: b.writeSnippets !== false, dry: !!b.dry }); }],
  ['GET', /^\/api\/people$/, () => people.listPeople()],
  ['POST', /^\/api\/people$/, async (_, __, req) => { const b = await readBody(req); const p = people.createPerson(b); if (b.jobId) people.attachPerson(b.jobId, p.id, { role: b.role, context: b.context }); return people.getPerson(p.id); }],
  ['GET', /^\/api\/people\/([^/]+)$/, (m) => people.getPerson(decodeURIComponent(m[1]))],
  ['POST', /^\/api\/people\/([^/]+)\/attach$/, async (m, _, req) => { const b = await readBody(req); return people.attachPerson(b.jobId, decodeURIComponent(m[1]), { role: b.role, context: b.context }); }],
  ['POST', /^\/api\/people\/([^/]+)\/log$/, async (m, _, req) => { const b = await readBody(req); return people.logContact(decodeURIComponent(m[1]), { date: b.date, via: 'app', text: b.text }); }],
  ['PATCH', /^\/api\/jobs\/([^/]+)$/, async (m, _, req) => { const b = await readBody(req); let job; if (b.status) job = store.setStatus(decodeURIComponent(m[1]), b.status, 'app', b.reason || ''); if (b.note) job = store.addNote(decodeURIComponent(m[1]), b.note, 'app'); if (b.application) job = store.saveApplicationDraft(decodeURIComponent(m[1]), b.application); return job || store.getJob(decodeURIComponent(m[1])); }],
  ['GET', /^\/api\/runs$/, () => store.runs()],
  ['GET', /^\/api\/scan$/, () => store.scanStatus()],
  ['POST', /^\/api\/scan$/, async (_, __, req) => { const b = await readBody(req); return store.runScan(b.dry ? ['--dry'] : [], { criteria: b.criteria || '', retryFailed: !!b.retryFailed, via: 'app' }); }],
  ['GET', /^\/api\/outcomes$/, () => store.outcomes()],
  ['GET', /^\/api\/views$/, () => store.getViews()],
  ['GET', /^\/api\/views\/defaults$/, () => store.defaultViews()],
  ['PUT', /^\/api\/views$/, async (_, __, req) => { const b = await readBody(req); return store.saveViews(b.views); }],
  ['GET', /^\/api\/mail$/, () => mail.items()],
  ['POST', /^\/api\/mail\/check$/, async (_, __, req) => mail.start(await readBody(req))],
  ['POST', /^\/api\/mail\/confirm-safe$/, () => mail.confirmSafe()],
  ['POST', /^\/api\/mail\/([^/]+)\/confirm$/, async (m, _, req) => mail.confirm(decodeURIComponent(m[1]), await readBody(req))],
  ['POST', /^\/api\/mail\/([^/]+)\/dismiss$/, (m) => mail.dismiss(decodeURIComponent(m[1]))],
  ['POST', /^\/api\/criteria\/preview$/, async (_, __, req) => { const b = await readBody(req); return store.previewCriteria(b.raw); }],
  ['POST', /^\/api\/rescore$/, async (_, __, req) => { const b = await readBody(req); return store.rescoreNotes({ dry: !!b.dry }); }],
  ['GET', /^\/api\/criteria\/presets$/, () => store.criteriaPresets()],
  ['GET', /^\/api\/criteria\/presets\/([^/]+)$/, (m) => store.getCriteriaPreset(decodeURIComponent(m[1]))],
  ['PUT', /^\/api\/criteria\/presets\/([^/]+)$/, async (m, _, req) => { const b = await readBody(req); return store.saveCriteriaPreset(decodeURIComponent(m[1]), b.raw); }],
  ['DELETE', /^\/api\/criteria\/presets\/([^/]+)$/, (m) => store.deleteCriteriaPreset(decodeURIComponent(m[1]))],
  ['POST', /^\/api\/criteria\/presets\/([^/]+)\/activate$/, (m) => store.activateCriteriaPreset(decodeURIComponent(m[1]))],
  ['GET', /^\/api\/criteria$/, () => store.getCriteria()],
  ['PUT', /^\/api\/criteria$/, async (_, __, req) => { const b = await readBody(req); return store.setCriteria(b.raw); }],
  ['GET', /^\/api\/profile\/summary$/, () => store.profileSummary()],
  ['GET', /^\/api\/companies$/, () => store.companies()],
  ['GET', /^\/api\/feeds$/, () => store.feeds()],
  ['POST', /^\/api\/companies$/, async (_, __, req) => store.addCompany(await readBody(req))],
  ['POST', /^\/api\/jobs\/import$/, async (_, __, req) => { const b = await readBody(req); return store.importLinks(b.urls ?? b.url); }],
  ['POST', /^\/api\/jobs\/([^/]+)\/reveal$/, (m) => store.revealJob(decodeURIComponent(m[1]))],
  ['POST', /^\/api\/jobs\/([^/]+)\/attach$/, async (m, _, req) => { const b = await readBody(req); return store.attachPosting(decodeURIComponent(m[1]), b.url, { linkOnly: !!b.linkOnly }); }],
  // Settings (~/.tekjobs/config.json) and the folder of resume variants.
  ['GET', /^\/api\/settings$/, () => store.settings()],
  ['PUT', /^\/api\/settings$/, async (_, __, req) => store.saveSettings(await readBody(req))],
  ['GET', /^\/api\/resumes$/, () => store.listResumes()],
  ['POST', /^\/api\/resumes\/use$/, async (_, __, req) => { const b = await readBody(req); return store.useResume(b.name); }],
  ['POST', /^\/api\/resumes\/open$/, async (_, __, req) => { const b = await readBody(req); return store.openResume(b.name); }],
  ['GET', /^\/api\/snippets$/, () => store.getSnippets()],
  ['PUT', /^\/api\/snippets$/, async (_, __, req) => { const b = await readBody(req); return store.saveSnippets(b.items); }],
  ['GET', /^\/api\/profile$/, () => store.profile()],
  ['PUT', /^\/api\/profile$/, async (_, __, req) => { const b = await readBody(req); return store.saveProfileNote(b.note || 'profile', b.markdown); }],
  ['GET', /^\/api\/onboarding$/, () => store.onboardingStatus()],
  ['POST', /^\/api\/onboarding\/init$/, () => store.initProfile()],
  ['POST', /^\/api\/onboarding\/resume$/, async (_, __, req) => { const b = await readBody(req); return store.importResume(b.path); }],
  ['GET', /^\/api\/statuses$/, () => store.STATUSES],
  ['GET', /^\/api\/pass-reasons$/, () => store.PASS_REASONS],
  ['GET', /^\/api\/application-fields$/, () => store.APPLICATION_FIELDS],
];

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(DIST)) { res.writeHead(503, { 'content-type': 'text/plain' }); return res.end('No build yet. Run `npm run build`, or use `npm run dev` for the Vite dev server.'); }
  let file = path.join(DIST, decodeURIComponent(pathname));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    const printView = url.pathname.match(/^\/api\/jobs\/([^/]+)\/resume\.html$/);
    if (printView && req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(tailored.html(decodeURIComponent(printView[1]))); }
    for (const [method, re, handler] of routes) {
      const m = url.pathname.match(re);
      if (m && req.method === method) return json(res, 200, await handler(m, url.searchParams, req));
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: `no route ${req.method} ${url.pathname}` });
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    return json(res, e.status || 500, { error: e.message });
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`TekJobs server  http://127.0.0.1:${PORT}  vault: ${store.VAULT}`));
