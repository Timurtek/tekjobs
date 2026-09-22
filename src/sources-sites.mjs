// Career sites and boards with no public JSON API: the page is the API.
// Google (server-rendered results page), Apple (search endpoint behind a CSRF token, description from the
// detail page's hydration data), Wellfound (Next.js page data), Built In (server-rendered cards, JSON-LD on
// the detail page). Same normalized job shape as sources.mjs. The pure parsers are exported for tests.
import { htmlToText, decodeEntities, makeTitleFilter } from './sources.mjs';

import { UA } from './config.mjs';
const H = { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.9' };
async function req(url, { method = 'GET', body, headers = {}, timeoutMs = 30000 } = {}) {
  try {
    const r = await fetch(url, { method, headers: { ...H, ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch { /* html */ }
    return { status: r.status, ok: r.ok, data, text, headers: r.headers };
  } catch (e) { return { status: 0, ok: false, data: null, text: '', error: e.name === 'TimeoutError' ? 'timeout' : e.message }; }
}
const bad = (r) => ({ ok: false, jobs: [], error: r.error || `HTTP ${r.status}` });
const isRemoteText = (s = '') => /\bremote\b|\bdistributed\b|\banywhere\b|\bvirtual\b/i.test(s) || /^\s*(united states|usa|u\.s\.|us|north america|americas)\s*$/i.test(s);
const iso = (v) => { if (!v) return null; const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v); return isNaN(d) ? null : d.toISOString(); };
const job = (o) => ({ salary: '', department: '', employmentType: '', descriptionHtml: '', location: '', remote: false, posted: null, ...o });
// Tags become separators, so text that sat in different elements stays apart.
const segments = (html) => decodeEntities(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '|')).split('|').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const paragraphs = (parts) => parts.filter(Boolean).map((p) => `<p>${p}</p>`).join('');

// ---------------- Google ----------------
// https://www.google.com/about/careers/applications/jobs/results/?q=...  Twenty cards a page, rendered on the
// server. Each card carries the title (as the "Learn more" label), the employer (Google, YouTube, Fitbit...),
// locations, level, and the minimum qualifications; "Remote eligible" appears on the card when it applies.
const GOOGLE_BASE = 'https://www.google.com/about/careers/applications/jobs/results/';
const GOOGLE_QUERIES = ['"design engineer"', '"design technologist"', '"ux engineer"', '"design systems"', '"front end engineer"', '"frontend engineer"', 'prototyper'];
const GOOGLE_ICONS = new Set(['corporate_fare', 'place', 'bar_chart', 'info', 'expand_more', 'expand_less', 'share', 'link', 'email', 'bookmark', 'bookmark_border', 'open_in_new', 'Learn more']);
export function parseGoogleCards(html) {
  const cards = html.split(/(?=<li class="lLd3Je")/).filter((s) => /jobs\/results\/\d{12,}-/.test(s));
  return cards.map((c) => {
    const m = c.match(/jobs\/results\/(\d{12,})-([a-z0-9-]+)/);
    const title = decodeEntities((c.match(/aria-label="Learn more about ([^"]+)"/) || [])[1] || '').trim();
    const seg = segments(c);
    const after = (icon, max = 3) => {
      const i = seg.indexOf(icon); if (i < 0) return '';
      const out = [];
      for (const s of seg.slice(i + 1, i + 1 + max)) { if (GOOGLE_ICONS.has(s) || /^Minimum qualifications/i.test(s)) break; out.push(s); }
      return out.join(' ').replace(/\s+;\s*/g, '; ').trim();
    };
    const q = seg.findIndex((s) => /^Minimum qualifications/i.test(s));
    return {
      id: m[1], slug: m[2], title,
      company: after('corporate_fare', 1) || 'Google',
      location: after('place'),
      level: after('bar_chart', 1),
      remote: /Remote eligible/i.test(c),
      qualifications: q < 0 ? [] : seg.slice(q + 1).filter((s) => !GOOGLE_ICONS.has(s)),
    };
  });
}
// The detail page repeats the card and adds "About the job" and "Responsibilities"; the pay range, when
// Google states one, is inside "About the job".
export function parseGoogleDetail(html) {
  const seg = segments(html);
  const start = seg.findIndex((s) => /^Minimum qualifications/i.test(s));
  if (start < 0) return '';
  const end = seg.findIndex((s, i) => i > start && /^(Google is proud to be an equal opportunity|Information collected and processed)/i.test(s));
  const body = seg.slice(start, end < 0 ? start + 80 : end).filter((s) => !GOOGLE_ICONS.has(s) && !/^(Apply|Share .*|Copy link|Email a friend)$/.test(s));
  return paragraphs(body);
}
/** One Google job page (jobs/results/<id>-<slug>) as a job: for a pasted link. */
export function parseGoogleJobPage(html, url = '') {
  const seg = segments(html);
  const after = (icon, max = 3) => {
    const i = seg.indexOf(icon); if (i < 0) return '';
    const out = [];
    for (const s of seg.slice(i + 1, i + 1 + max)) { if (GOOGLE_ICONS.has(s) || /^Minimum qualifications/i.test(s)) break; out.push(s); }
    return out.join(' ').replace(/\s+;\s*/g, '; ').trim();
  };
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]).replace(/\s*[—|-]\s*Google Careers.*$/i, '').replace(/\s+/g, ' ').trim();
  if (!title) return null;
  const id = (url.match(/jobs\/results\/(\d{9,})/) || [])[1] || '';
  const location = after('place');
  return job({ id: `goog:${id || title}`, source: 'google', company: after('corporate_fare', 1) || 'Google', title, url, location, remote: /Remote eligible/i.test(html) || isRemoteText(location), descriptionHtml: parseGoogleDetail(html), department: after('bar_chart', 1) ? `Level: ${after('bar_chart', 1)}` : '' });
}
export async function fetchGoogle(titleFilter = () => true, { pages = 5, maxDetails = 40, location = 'United States' } = {}) {
  const found = new Map();
  for (const q of GOOGLE_QUERIES) {
    for (let page = 1; page <= pages; page++) {
      const r = await req(`${GOOGLE_BASE}?q=${encodeURIComponent(q)}&employment_type=FULL_TIME&location=${encodeURIComponent(location)}${page > 1 ? `&page=${page}` : ''}`);
      if (!r.ok) { if (found.size === 0 && q === GOOGLE_QUERIES[0]) return bad(r); break; }
      const cards = parseGoogleCards(r.text);
      let fresh = 0;
      for (const c of cards) if (!found.has(c.id)) { found.set(c.id, c); fresh++; }
      if (!cards.length || !fresh || cards.length < 20) break;
    }
  }
  const jobs = []; let details = 0;
  for (const c of found.values()) {
    const base = job({ id: `goog:${c.id}`, source: 'google', company: c.company, title: c.title, url: `${GOOGLE_BASE}${c.id}-${c.slug}`, location: c.location, remote: c.remote || isRemoteText(c.location), descriptionHtml: paragraphs(['Minimum qualifications', ...c.qualifications]), department: c.level ? `Level: ${c.level}` : '' });
    if (titleFilter(base.title) && details < maxDetails) {
      details++;
      const d = await req(base.url);
      const html = d.ok ? parseGoogleDetail(d.text) : '';
      if (html) base.descriptionHtml = html;
    }
    jobs.push(base);
  }
  return { ok: true, jobs, scanned: found.size };
}

// ---------------- Apple ----------------
// POST https://jobs.apple.com/api/v1/search with the CSRF token that GET /api/v1/csrfToken hands out.
// Results carry a summary only; the description lives in the detail page's __staticRouterHydrationData.
const APPLE_QUERIES = ['"design engineer"', '"design technologist"', '"ux engineer"', '"design systems"', '"front end engineer"', '"frontend engineer"', '"prototyper"'];
export function parseAppleHydration(html) {
  const m = html.match(/__staticRouterHydrationData\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/);
  if (!m) return null;
  try { return JSON.parse(JSON.parse(m[1])); } catch { return null; }
}
export function appleDescription(hydration) {
  const d = hydration?.loaderData?.jobDetails?.jobsData;
  if (!d) return '';
  const footers = (d.postingFooters || []).flatMap((f) => (f.localizations?.en_US || []).map((x) => x.content)).filter((s) => /base pay|salary/i.test(s || ''));
  return [
    d.jobSummary ? `<p>${d.jobSummary}</p>` : '',
    d.description ? `<h3>Description</h3><p>${d.description}</p>` : '',
    d.responsibilities ? `<h3>Responsibilities</h3><p>${d.responsibilities}</p>` : '',
    d.minimumQualifications ? `<h3>Minimum qualifications</h3><p>${d.minimumQualifications}</p>` : '',
    d.preferredQualifications ? `<h3>Preferred qualifications</h3><p>${d.preferredQualifications}</p>` : '',
    footers.length ? `<h3>Pay</h3>${footers.map((f) => `<p>${f}</p>`).join('')}` : '',
  ].join('');
}
/** One Apple job page (en-us/details/<id>/<slug>) as a job, from its hydration data: for a pasted link. */
export function parseAppleJobPage(html, url = '') {
  const h = parseAppleHydration(html);
  const d = h?.loaderData?.jobDetails?.jobsData;
  if (!d) return null;
  const loc = (d.locations || []).map((l) => l.name).filter(Boolean).join('; ');
  return job({ id: `ap:${d.positionId || d.id || (url.match(/details\/(\d+)/) || [])[1] || ''}`, source: 'apple', company: 'Apple', title: d.postingTitle || '', url, location: loc, remote: !!d.homeOffice || isRemoteText(loc), posted: iso(d.postDateInGMT || d.postingDate), descriptionHtml: appleDescription(h), department: d.team?.teamName || '', employmentType: d.standardWeeklyHours ? `${d.standardWeeklyHours} h/week` : '' });
}
export async function fetchApple(titleFilter = () => true, { pages = 3, maxDetails = 40, country = 'postLocation-USA' } = {}) {
  const t = await req('https://jobs.apple.com/api/v1/csrfToken');
  const token = t.headers?.get('x-apple-csrf-token');
  if (!token) return { ok: false, jobs: [], error: t.error || `no CSRF token (HTTP ${t.status})` };
  const cookie = (t.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  const headers = { 'x-apple-csrf-token': token, cookie, referer: 'https://jobs.apple.com/en-us/search', accept: 'application/json' };
  const found = new Map();
  for (const q of APPLE_QUERIES) {
    for (let page = 1; page <= pages; page++) {
      const r = await req('https://jobs.apple.com/api/v1/search', { method: 'POST', headers, body: { query: q, filters: { postingpostLocation: [country] }, locale: 'en-us', page, sort: 'newest', format: { longDate: 'MMMM D, YYYY', mediumDate: 'MMM D, YYYY' } } });
      const rows = r.data?.res?.searchResults;
      if (!Array.isArray(rows)) { if (found.size === 0 && q === APPLE_QUERIES[0]) return bad(r); break; }
      for (const j of rows) found.set(j.positionId || j.id, j);
      if (rows.length < 20) break;
    }
  }
  const jobs = []; let details = 0;
  for (const j of found.values()) {
    const loc = (j.locations || []).map((l) => l.name).filter(Boolean).join('; ');
    const base = job({ id: `ap:${j.positionId || j.id}`, source: 'apple', company: 'Apple', title: j.postingTitle || '', url: `https://jobs.apple.com/en-us/details/${j.positionId}/${j.transformedPostingTitle || ''}`, location: loc, remote: !!j.homeOffice || isRemoteText(loc), posted: iso(j.postDateInGMT || j.postingDate), descriptionHtml: j.jobSummary ? `<p>${j.jobSummary}</p>` : '', department: j.team?.teamName || '', employmentType: j.standardWeeklyHours ? `${j.standardWeeklyHours} h/week` : '' });
    if (titleFilter(base.title) && details < maxDetails) {
      details++;
      const d = await req(base.url);
      const html = d.ok ? appleDescription(parseAppleHydration(d.text)) : '';
      if (html) base.descriptionHtml = html;
    }
    jobs.push(base);
  }
  return { ok: true, jobs, scanned: found.size };
}

// ---------------- Wellfound ----------------
// https://wellfound.com/role/r/<role>?remote=true is a Next.js page whose __NEXT_DATA__ holds the Apollo cache:
// StartupResult records, each pointing at its JobListingSearchResult rows. Paging does not change the page,
// so one request per role is all there is.
const WF_ROLES = ['design-engineer', 'design-systems-engineer', 'creative-technologist', 'ux-engineer', 'frontend-engineer'];
export function parseWellfoundPage(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let data; try { data = JSON.parse(m[1])?.props?.pageProps?.apolloState?.data || {}; } catch { return []; }
  const out = [];
  for (const v of Object.values(data)) {
    if (v?.__typename !== 'StartupResult') continue;
    for (const ref of v.highlightedJobListings || []) { const j = data[ref.__ref]; if (j) out.push({ startup: v, listing: j }); }
  }
  return out;
}
export async function fetchWellfound() {
  const byId = new Map(); let calls = 0, failed = 0, lastError = '';
  for (const role of WF_ROLES) {
    const r = await req(`https://wellfound.com/role/r/${role}?remote=true`);
    calls++;
    if (!r.ok) { failed++; lastError = r.error || `HTTP ${r.status}`; continue; }
    for (const { startup, listing: j } of parseWellfoundPage(r.text)) {
      const id = `wf:${j.id}`;
      if (byId.has(id)) continue;
      // locationNames is where the company sits; acceptedRemoteLocationNames is where it will hire from
      // ("United States", "India"). Both go in, so the location scoring sees the country a remote role is
      // really open to.
      const loc = [...new Set([...(j.locationNames || []), ...(j.acceptedRemoteLocationNames || [])])].join('; ') || (j.remote ? 'Remote' : '');
      byId.set(id, job({ id, source: 'wellfound', company: startup.name || 'Unknown', title: j.title || '', url: `https://wellfound.com/jobs/${j.id}-${j.slug || ''}`, location: loc, remote: !!j.remote || isRemoteText(loc), posted: iso(j.liveStartAt), descriptionHtml: paragraphs(String(j.description || '').split(/\n{2,}/)), salary: j.compensation || '', department: j.primaryRoleTitle || '', employmentType: j.jobType || '' }));
    }
  }
  if (!byId.size) return { ok: false, jobs: [], error: failed ? `${failed}/${calls} requests failed (${lastError})` : 'no results' };
  return { ok: true, jobs: [...byId.values()] };
}

// ---------------- Built In ----------------
// https://builtin.com/jobs/remote/<category>?search=... renders cards on the server: company, title, posted
// ("6 Days Ago"), work mode, location, pay, level and a snippet. The detail page has a JSON-LD JobPosting with
// the full description, fetched for the titles that pass the filter.
const BI_SEARCHES = [['design-ux', 'design engineer'], ['design-ux', 'design technologist'], ['design-ux', 'ux engineer'], ['dev-engineering', 'design engineer'], ['dev-engineering', 'design systems'], ['dev-engineering', 'frontend engineer']];
export function relativeDate(s, now = new Date()) {
  const t = String(s || '').trim();
  if (/^(just now|today|\d+\s+(minute|hour)s?\s+ago)$/i.test(t)) return now.toISOString();
  const d = new Date(now);
  if (/^yesterday$/i.test(t)) { d.setDate(d.getDate() - 1); return d.toISOString(); }
  const m = t.match(/^(\d+)\s+(day|week|month)s?\s+ago$/i);
  if (!m) return null;
  const n = Number(m[1]); const unit = m[2].toLowerCase();
  if (unit === 'day') d.setDate(d.getDate() - n); else if (unit === 'week') d.setDate(d.getDate() - 7 * n); else d.setMonth(d.getMonth() - n);
  return d.toISOString();
}
export function parseBuiltInCards(html) {
  return html.split(/(?=data-id="job-card")/).slice(1).map((c) => {
    const link = c.match(/href="(\/job\/[a-z0-9-]+\/(\d+))"[^>]*data-id="job-card-title"[^>]*>([^<]+)</);
    if (!link) return null;
    const company = decodeEntities((c.match(/data-id="company-title"[^>]*>\s*<span>([^<]+)</) || [])[1] || '').trim();
    // Short segments are the card's labels (posted, work mode, location, pay, level); icons sit in their own
    // elements, so a label is never glued to one.
    const seg = segments(c);
    const modeAt = seg.findIndex((s) => /^(remote|hybrid|remote or hybrid|in-office)$/i.test(s));
    return {
      id: link[2], path: link[1], title: decodeEntities(link[3]).trim(), company,
      posted: seg.find((s) => /^(\d+ \w+ ago|yesterday|today|just now)$/i.test(s)) || '',
      mode: modeAt < 0 ? '' : seg[modeAt],
      location: modeAt < 0 ? '' : seg[modeAt + 1] || '',
      salary: seg.find((s) => /^[\d.]+K-[\d.]+K annually$/i.test(s)) || '',
      level: seg.find((s) => /^(entry|junior|mid|senior|expert\/leader|principal)( level)?$/i.test(s)) || '',
      snippet: seg.filter((s) => s.length > 120).sort((a, b) => b.length - a.length)[0] || '',
    };
  }).filter(Boolean);
}
// The script type is written "application/ld&#x2B;json" (the plus is entity-encoded) and the posting sits
// inside an "@graph" array.
export function parseBuiltInDetail(html) {
  for (const m of html.matchAll(/<script[^>]*ld(?:\+|&#x2B;|&#43;)json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(m[1]);
      const arr = [].concat(d).flatMap((x) => (x && x['@graph'] ? x['@graph'] : [x]));
      const p = arr.find((x) => x && x['@type'] === 'JobPosting');
      if (p) return p;
    } catch { /* next block */ }
  }
  return null;
}
export async function fetchBuiltIn(criteria = {}, { maxDetails = 40 } = {}) {
  const titleFilter = makeTitleFilter(criteria);
  const byId = new Map(); let calls = 0, failed = 0, lastError = '';
  for (const [cat, q] of BI_SEARCHES) {
    const r = await req(`https://builtin.com/jobs/remote/${cat}?search=${encodeURIComponent(q)}`);
    calls++;
    if (!r.ok) { failed++; lastError = r.error || `HTTP ${r.status}`; continue; }
    for (const c of parseBuiltInCards(r.text)) {
      const id = `bi:${c.id}`;
      if (byId.has(id)) continue;
      const salary = c.salary.replace(/\s*annually/i, '').replace(/(\d+)K/gi, '$$$1k');
      byId.set(id, job({ id, source: 'builtin', company: c.company || 'Unknown', title: c.title, url: `https://builtin.com${c.path}`, location: [c.mode, c.location].filter(Boolean).join(' · '), remote: /remote/i.test(c.mode) || isRemoteText(c.location), posted: relativeDate(c.posted), descriptionHtml: paragraphs([c.snippet]), salary, department: cat, employmentType: c.level }));
    }
  }
  let details = 0;
  for (const j of byId.values()) {
    if (!titleFilter(j.title) || details >= maxDetails) continue;
    details++;
    const d = await req(j.url);
    const p = d.ok ? parseBuiltInDetail(d.text) : null;
    if (!p) continue;
    if (p.description) j.descriptionHtml = p.description;
    if (p.datePosted) j.posted = iso(p.datePosted) || j.posted;
    if (p.jobLocationType === 'TELECOMMUTE') j.remote = true;
    if (p.employmentType && !j.employmentType) j.employmentType = String(p.employmentType);
  }
  if (!byId.size) return { ok: false, jobs: [], error: failed ? `${failed}/${calls} requests failed (${lastError})` : 'no results' };
  return { ok: true, jobs: [...byId.values()] };
}
