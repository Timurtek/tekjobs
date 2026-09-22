// One posting, from a link the person pasted. The scan watches boards; this is for the job seen somewhere
// else: a LinkedIn feed, a newsletter, a friend's message. The link is read once, turned into the same job
// shape the scan produces, scored with the same criteria, and written as a note unless a note for it exists.
//
// Where the link points at a board the scan understands (Greenhouse, Lever, Ashby) the board's API is used,
// so the note is as full as a scanned one. A LinkedIn link is fetched once as a signed-out visitor, the way a
// browser would open it; if the posting names the company's own apply page on one of those boards, that
// page is imported instead and the LinkedIn link is kept as where it was seen. Nothing here searches or
// crawls anything: one link in, one request or two out.
import { htmlToText, decodeEntities } from './sources.mjs';
import { scoreJob, parseSalary } from './score.mjs';
import { loadSeen, saveSeen, writeJobNote, allJobNotes, jobNotePath } from './vault.mjs';
import { loadCriteria, loadCompanies, UA } from './config.mjs';

async function get(url, { accept = 'text/html,application/json;q=0.9,*/*;q=0.8', timeoutMs = 25000 } = {}) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept, 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch { /* html */ }
    return { status: r.status, ok: r.ok, data, text, url: r.url };
  } catch (e) { return { status: 0, ok: false, data: null, text: '', error: e.name === 'TimeoutError' ? 'timeout' : e.message }; }
}
const isRemoteText = (s = '') => /\bremote\b|\bdistributed\b|\banywhere\b|\bwork from home\b/i.test(s) || /^\s*(united states|usa|u\.s\.|us|north america|americas)\s*$/i.test(s);
const iso = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };
const job = (o) => ({ salary: '', department: '', employmentType: '', descriptionHtml: '', location: '', remote: false, posted: null, ...o });
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

/** Tracking parameters make every copy of a link unique; strip them so the same posting is one posting. */
export function cleanUrl(href) {
  const u = new URL(String(href).trim());
  if (!/^https?:$/.test(u.protocol)) throw Object.assign(new Error('Only http(s) links.'), { status: 400 });
  for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k) || /^(trk|tracking|trackingId|refId|midToken|mid|eid|lipi|licu|from|source|ref|src|gh_src|lever-source|position|pageNum|refresh|original_referer)$/i.test(k)) u.searchParams.delete(k);
  u.hash = '';
  return u.toString();
}

/** Which reader a link gets. Exported so the choice can be tested without a network. */
export function classify(url) {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  let m;
  if ((m = u.href.match(/greenhouse\.io\/(?:embed\/job_app\?.*?for=)?([^/?#]+)\/jobs\/(\d+)/))) return { kind: 'greenhouse', slug: m[1], id: m[2] };
  if ((m = u.href.match(/greenhouse\.io\/embed\/job_app\?(?:.*&)?for=([^&]+).*?(?:&|\?)token=(\d+)/))) return { kind: 'greenhouse', slug: m[1], id: m[2] };
  if (u.searchParams.get('gh_jid')) return { kind: 'greenhouse', slug: '', id: u.searchParams.get('gh_jid') };
  if ((m = u.href.match(/jobs\.lever\.co\/([^/?#]+)\/([0-9a-f-]{36})/i))) return { kind: 'lever', slug: m[1], id: m[2] };
  if ((m = u.href.match(/jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})/i))) return { kind: 'ashby', slug: m[1], id: m[2] };
  // A company careers page embedding Ashby: ?ashby_jid=<uuid>. The board name is read off the page.
  if (/^[0-9a-f-]{36}$/i.test(u.searchParams.get('ashby_jid') || '')) return { kind: 'ashby', slug: '', id: u.searchParams.get('ashby_jid') };
  if (/(^|\.)linkedin\.com$/.test(host)) {
    const id = (u.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d+)/) || [])[1] || u.searchParams.get('currentJobId');
    if (id) return { kind: 'linkedin', id };
    return { kind: 'unsupported', why: 'a LinkedIn link without a job id (open the posting itself and copy that link)' };
  }
  if (/(^|\.)indeed\.com$/.test(host)) return { kind: 'unsupported', why: 'Indeed blocks signed-out reads; open the posting and paste the company\'s own apply link instead' };
  // Two career sites the scan already reads from their pages; a pasted job page goes through the same parser.
  if ((m = u.href.match(/google\.com\/about\/careers\/applications\/jobs\/results\/(\d{9,})/))) return { kind: 'google', id: m[1] };
  if ((m = u.href.match(/jobs\.apple\.com\/[^/]+\/details\/(\d+)/))) return { kind: 'apple', id: m[1] };
  return { kind: 'page' };
}

const companyNameFor = (slug, fallback) => {
  const c = loadCompanies().find((x) => x.slug.toLowerCase() === String(slug).toLowerCase());
  return c ? c.name : fallback;
};
const titleCase = (s) => String(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

async function fromGreenhouse({ slug, id }, url) {
  if (!slug) {
    // A company page with ?gh_jid=… usually embeds the Greenhouse board script, which names the board. When
    // it renders the posting itself (AKQA does), the board token is almost always the company's domain name,
    // so that is tried against the API; failing that, the page's own JSON-LD posting is the record.
    const page = await get(url);
    slug = (page.text.match(/greenhouse\.io\/embed\/job_board\/js\?for=([^"&']+)/) || page.text.match(/boards\.greenhouse\.io\/([^/"']+)/) || [])[1] || '';
    if (!slug) {
      const labels = new URL(url).hostname.replace(/^www\./, '').split('.');
      const guess = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
      const probe = await get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(guess)}/jobs/${id}?questions=false`, { accept: 'application/json' });
      if (probe.data?.title) slug = guess;
      else {
        const p = jobPostingFromJsonLd(page.text);
        if (!p) return fail('the page has a Greenhouse job id but never names its board, and carries no posting data of its own');
        const j = jobFromJsonLd(p, url, { source: 'page', idPrefix: 'gh:page' });
        j.id = `gh:page:${id}`;
        return { ok: true, job: j };
      }
    }
  }
  const r = await get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs/${id}?questions=false`, { accept: 'application/json' });
  const j = r.data;
  if (!j || !j.title) return fail(r.error || `Greenhouse says ${r.status} for ${slug}/${id}`);
  const location = j.location?.name || (j.offices || []).map((o) => o.name).join('; ') || '';
  return { ok: true, job: job({ id: `gh:${slug}:${j.id}`, source: 'greenhouse', company: companyNameFor(slug, j.company_name || titleCase(slug)), title: j.title, url: j.absolute_url || url, location, remote: isRemoteText(location) || isRemoteText(j.title), posted: iso(j.first_published || j.updated_at), descriptionHtml: j.content || '', department: (j.departments || []).map((d) => d.name).filter(Boolean).join(', ') }) };
}

async function fromLever({ slug, id }, url) {
  const r = await get(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}/${id}`, { accept: 'application/json' });
  const j = r.data;
  if (!j || !j.text) return fail(r.error || `Lever says ${r.status} for ${slug}/${id}`);
  const location = [j.categories?.location, j.categories?.allLocations?.join('; ')].filter(Boolean).join('; ');
  const lists = (j.lists || []).map((l) => `<h3>${l.text}</h3>${l.content}`).join('');
  const sr = j.salaryRange;
  return { ok: true, job: job({ id: `lv:${slug}:${j.id}`, source: 'lever', company: companyNameFor(slug, titleCase(slug)), title: j.text, url: j.hostedUrl || url, location, remote: j.workplaceType === 'remote' || isRemoteText(location), posted: iso(j.createdAt), descriptionHtml: `${j.description || ''}${lists}${j.additional || ''}`, salary: sr && sr.min ? `${sr.currency || ''} ${sr.min}–${sr.max} / ${sr.interval || ''}`.trim() : '', department: [j.categories?.team, j.categories?.department].filter(Boolean).join(' / '), employmentType: j.categories?.commitment || '' }) };
}

async function fromAshby({ slug, id }, url) {
  if (!slug) {
    // The page's embed script or job links name the board; failing that, the domain label is the usual token.
    const page = await get(url);
    slug = (page.text.match(/jobs\.ashbyhq\.com\/([^/"'?#\s]+)/) || [])[1] || '';
    if (!slug) {
      const labels = new URL(url).hostname.replace(/^www\./, '').split('.');
      const base = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
      for (const guess of [base, `${base}-${labels[labels.length - 1]}`]) {
        const probe = await get(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(guess)}`, { accept: 'application/json' });
        if (probe.data?.jobs?.some((x) => x.id === id)) { slug = guess; break; }
      }
    }
    if (!slug) return fail('the page has an Ashby job id but never names its board');
  }
  const r = await get(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`, { accept: 'application/json' });
  const j = (r.data?.jobs || []).find((x) => x.id === id);
  if (!j) return fail(r.data ? `that posting is not on the ${slug} board any more (closed, or unlisted)` : r.error || `Ashby says ${r.status} for ${slug}`);
  const location = [j.location, ...(j.secondaryLocations || []).map((l) => l.location)].filter(Boolean).join('; ');
  return { ok: true, job: job({ id: `ab:${slug}:${j.id}`, source: 'ashby', company: companyNameFor(slug, titleCase(slug)), title: j.title, url: j.jobUrl || url, location, remote: j.workplaceType === 'Remote' || isRemoteText(location), workplaceType: j.workplaceType || '', posted: iso(j.publishedAt), descriptionHtml: j.descriptionHtml || j.descriptionPlain || '', salary: j.compensation?.compensationTierSummary || '', department: [j.department, j.team].filter(Boolean).join(' / '), employmentType: j.employmentType || '' }) };
}

/** The JobPosting from a page's JSON-LD, if it has one. Most career pages and LinkedIn's signed-out view do. */
export function jobPostingFromJsonLd(html) {
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld(?:\+|&#x2B;|&#43;)json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(decodeEntities(m[1]).replace(new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']', 'g'), ''));
      const arr = [].concat(d).flatMap((x) => (x && x['@graph'] ? x['@graph'] : [x]));
      const p = arr.find((x) => x && (x['@type'] === 'JobPosting' || (Array.isArray(x['@type']) && x['@type'].includes('JobPosting'))));
      if (p) return p;
    } catch { /* next block */ }
  }
  return null;
}
export function jobFromJsonLd(p, url, { source = 'page', idPrefix = 'link' } = {}) {
  const locs = [].concat(p.jobLocation || []).map((l) => {
    const a = l?.address || l; if (!a || typeof a !== 'object') return typeof l === 'string' ? l : '';
    return [a.addressLocality, a.addressRegion, a.addressCountry?.name || a.addressCountry].filter(Boolean).join(', ');
  }).filter(Boolean);
  const location = [...new Set(locs)].join('; ') || (p.jobLocationType === 'TELECOMMUTE' ? 'Remote' : '');
  const sal = p.baseSalary?.value || p.baseSalary;
  const num = (v) => (v == null ? null : Number(String(v).replace(/[^\d.]/g, '')) || null);
  const min = num(sal?.minValue ?? sal?.value), max = num(sal?.maxValue ?? sal?.value);
  const unit = String(sal?.unitText || '').toUpperCase();
  const salary = min && max && (!unit || unit === 'YEAR') ? `$${Math.round(min / 1000)}k–$${Math.round(max / 1000)}k` : '';
  const org = p.hiringOrganization?.name || (typeof p.hiringOrganization === 'string' ? p.hiringOrganization : '');
  const id = p.identifier?.value || p.identifier?.name || url;
  return job({ id: `${idPrefix}:${String(id).slice(-80)}`, source, company: decodeEntities(String(org || '')).trim(), title: decodeEntities(String(p.title || '')).trim(), url, location, remote: p.jobLocationType === 'TELECOMMUTE' || isRemoteText(location) || isRemoteText(String(p.title || '')), posted: iso(p.datePosted), descriptionHtml: String(p.description || ''), salary, employmentType: [].concat(p.employmentType || []).join(', ') });
}

/** LinkedIn's signed-out job page hides the company's own apply link in a comment inside <code id="applyUrl">. */
export function linkedInApplyUrl(html) {
  const m = html.match(/id="applyUrl"[^>]*>\s*<!--\s*"?([^"<]+?)"?\s*-->/);
  if (!m) return '';
  try {
    const u = new URL(decodeEntities(m[1]));
    // LinkedIn wraps the destination in its own redirect; the real link is the url parameter.
    if (/linkedin\.com$/.test(u.hostname.replace(/^www\./, '')) && u.searchParams.get('url')) return u.searchParams.get('url');
    return u.toString();
  } catch { return ''; }
}

async function fromLinkedIn({ id }, seenAt) {
  const url = `https://www.linkedin.com/jobs/view/${id}/`;
  const r = await get(url);
  if (r.status === 999 || /authwall|\/login|checkpoint/.test(r.url || '')) return fail('LinkedIn would not show that posting to a signed-out visitor. Open it, click Apply, and paste the company\'s own link.');
  if (!r.ok) return fail(r.error || `LinkedIn says ${r.status} for job ${id}`);
  const apply = linkedInApplyUrl(r.text);
  if (apply) {
    const via = classify(apply);
    if (['greenhouse', 'lever', 'ashby'].includes(via.kind)) {
      const inner = await READERS[via.kind](via, apply);
      if (inner.ok) { inner.job.seenAt = seenAt; return inner; }
    }
  }
  const p = jobPostingFromJsonLd(r.text);
  if (!p) return fail('LinkedIn returned a page without the posting in it (it does that when it wants a sign-in). Open it, click Apply, and paste the company\'s own link.');
  const j = jobFromJsonLd(p, apply || url, { source: 'linkedin', idPrefix: 'li' });
  j.id = `li:${id}`;
  j.seenAt = seenAt;
  if (!j.company) j.company = decodeEntities((r.text.match(/<a[^>]*class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/) || [, ''])[1].replace(/<[^>]+>/g, '')).trim() || 'Unknown';
  return { ok: true, job: j };
}

const meta = (html, name) => decodeEntities((html.match(new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]+content="([^"]*)"`, 'i')) || html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${name}"`, 'i')) || [, ''])[1]).trim();
const GENERIC_HEADING = /^(job details?|job description|job opening|careers?|jobs?|open positions?|apply(?: now)?|position details?|overview)$/i;

/**
 * The best title a plain page offers: the h1 unless it is a label like "Job details", then og:title, then the
 * <title>, each cut at the site suffix (" | Acme Careers", " — Google Careers").
 */
export function pageTitle(html) {
  const h1 = decodeEntities((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [, ''])[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  const candidates = [h1, meta(html, 'og:title'), decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]).replace(/\s+/g, ' ').trim()];
  const pick = candidates.find((t) => t && !GENERIC_HEADING.test(t)) || '';
  return pick.split(/\s+[|–—-]\s+/)[0].trim();
}
/** The employer a plain page belongs to: og:site_name, else the domain's own name ("careers.example.com" is Example). */
export function siteName(html, url) {
  const og = meta(html, 'og:site_name').replace(/\s*(careers?|jobs)\s*$/i, '').trim();
  if (og) return og;
  const host = new URL(url).hostname.replace(/^www\./, '').split('.');
  // The registrable label: skip a country's second level ("co.uk", "com.au") the way a reader would.
  const second = host.length >= 3 && /^(co|com|org|net|ac|gov|edu)$/.test(host[host.length - 2]) ? 3 : 2;
  const label = host.length >= second ? host[host.length - second] : host[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

async function fromPage(_, url) {
  const r = await get(url);
  if (!r.ok) return fail(r.error || `the page says ${r.status}`);
  const p = jobPostingFromJsonLd(r.text);
  if (p) return { ok: true, job: jobFromJsonLd(p, url) };
  // No structured data: the best title on the page and its text. Enough to score on the title and read later.
  const title = pageTitle(r.text);
  if (!title) return fail('the page has no job posting data and no title');
  const body = r.text.replace(/<(header|nav|footer|aside)[\s\S]*?<\/\1>/gi, '');
  return { ok: true, job: job({ id: `link:${url.slice(-80)}`, source: 'page', company: siteName(r.text, url), title, url, location: '', remote: isRemoteText(title), descriptionHtml: `<p>${htmlToText(body).slice(0, 8000).replace(/\n\n/g, '</p><p>')}</p>` }) };
}

async function fromGoogle(_, url) {
  const r = await get(url);
  if (!r.ok) return fail(r.error || `Google says ${r.status}`);
  const { parseGoogleJobPage } = await import('./sources-sites.mjs');
  const j = parseGoogleJobPage(r.text, url);
  return j ? { ok: true, job: j } : fail('Google returned a page without the job on it');
}
async function fromApple(_, url) {
  const r = await get(url);
  if (!r.ok) return fail(r.error || `Apple says ${r.status}`);
  const { parseAppleJobPage } = await import('./sources-sites.mjs');
  const j = parseAppleJobPage(r.text, url);
  return j ? { ok: true, job: j } : fail('Apple returned a page without the job data in it');
}

const READERS = { greenhouse: fromGreenhouse, lever: fromLever, ashby: fromAshby, linkedin: fromLinkedIn, google: fromGoogle, apple: fromApple, page: fromPage };

const norm = (s) => (s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Read and score one link without writing anything. Returns { ok, url, job, scored } or { ok: false, error }. */
export async function readLink(href, { criteria = loadCriteria() } = {}) {
  let url;
  try { url = cleanUrl(href); } catch (e) { return fail(e.message, { url: href }); }
  const kind = classify(url);
  if (kind.kind === 'unsupported') return fail(kind.why, { url });
  const read = await READERS[kind.kind](kind, url);
  if (!read.ok) return { ...read, url };
  const j = read.job;
  j.descriptionText = htmlToText(j.descriptionHtml || '');
  const range = parseSalary(`${j.salary || ''}\n${j.descriptionText}`);
  if (range) { j.salaryMin = range.min; j.salaryMax = range.max; if (!j.salary) j.salary = `$${Math.round(range.min / 1000)}k–$${Math.round(range.max / 1000)}k`; }
  if (j.seenAt) j.descriptionHtml = `<p>Seen on LinkedIn: ${j.seenAt}</p>${j.descriptionHtml}`;
  j.foundVia = `added from a link${j.seenAt ? ' seen on LinkedIn' : ''}`;
  return { ok: true, url, job: j, scored: scoreJob(j, criteria) };
}

/** Import one link. Returns { ok, added, note, job, score, existing?, error? }. */
export async function importLink(href, { criteria = loadCriteria(), dry = false } = {}) {
  const read = await readLink(href, { criteria });
  if (!read.ok) return read;
  const { url, job: j, scored } = read;

  // Unique means: the scan has not seen this id, no note carries this URL, and no open note has the same
  // company and title (the same posting reached through a different door).
  const seen = loadSeen();
  const notes = allJobNotes();
  const dupe = seen[j.id] ? { why: 'the scan already has it', path: seen[j.id].path }
    : (() => { const n = notes.find((f) => f.url === j.url); return n ? { why: 'a note already points at this link', path: n._file } : null; })()
    || (() => { const n = notes.find((f) => norm(f.company) === norm(j.company) && norm(f.title) === norm(j.title)); return n ? { why: `a note already exists for ${j.company} / ${j.title}`, path: n._file } : null; })();
  if (dupe) return { ok: true, added: false, url, job: j, score: scored.score, existing: dupe.path, reason: dupe.why };
  if (dry) return { ok: true, added: false, dry: true, url, job: j, score: scored.score, note: jobNotePath(j) };

  const file = writeJobNote(j, scored, criteria);
  seen[j.id] = { path: file, firstSeen: new Date().toISOString(), company: j.company, title: j.title, companyKey: `link:${j.source}`, score: scored.score };
  saveSeen(seen);
  return { ok: true, added: true, url, job: j, score: scored.score, payBand: scored.payBand, reasons: scored.reasons, note: file, belowMin: scored.score < (criteria.minScore ?? 0), excluded: !!scored.excluded };
}
