// Public, no-auth job sources. Every fetcher returns { ok, jobs, error? } with jobs normalized to:
// { id, source, company, title, url, location, remote, posted, descriptionHtml, salary, department, employmentType }

import { UA } from './config.mjs';

async function getJSON(url, { timeoutMs = 25000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'application/json' },
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, data, text };
  } catch (e) {
    return { status: 0, data: null, text: '', error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(t);
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/', '#47': '/', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', bull: '•' };
export function decodeEntities(s = '') {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e in ENTITIES) return ENTITIES[e];
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return m;
  });
}

export function htmlToText(html = '') {
  let s = decodeEntities(html);
  if (/&(lt|gt|amp);/.test(s)) s = decodeEntities(s); // greenhouse double-encodes
  s = s
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|ul|ol|tr|table|section|blockquote)\s*>/gi, '\n\n')
    .replace(/<\s*(h[1-6])[^>]*>/gi, '\n\n## ')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\s*(strong|b)\s*>/gi, '**').replace(/<\s*\/\s*(strong|b)\s*>/gi, '**')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, txt) => {
      const t = txt.replace(/<[^>]+>/g, '').trim();
      return t && t !== href ? `${t} (${href})` : href;
    })
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\*\*\s*\*\*/g, '')
    .trim();
  return s;
}

// "United States" or "North America" as the entire location is a remote posting in practice.
const isRemoteText = (s = '') => /\bremote\b|\bdistributed\b|\banywhere\b/i.test(s) || /^\s*(united states|usa|u\.s\.|us|north america|americas)\s*$/i.test(s);

// ---------- Greenhouse ----------
export async function fetchGreenhouse(company, slug) {
  const r = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`);
  if (!r.data || !Array.isArray(r.data.jobs)) return { ok: false, jobs: [], error: r.error || `HTTP ${r.status}` };
  const jobs = r.data.jobs.map((j) => {
    const location = j.location?.name || (j.offices || []).map((o) => o.name).join('; ') || '';
    return {
      id: `gh:${slug}:${j.id}`,
      source: 'greenhouse',
      company,
      title: j.title || '',
      url: j.absolute_url,
      location,
      remote: isRemoteText(location) || isRemoteText(j.title),
      posted: j.first_published || j.updated_at || null,
      descriptionHtml: j.content || '',
      salary: '',
      department: (j.departments || []).map((d) => d.name).filter(Boolean).join(', '),
      employmentType: '',
    };
  });
  return { ok: true, jobs };
}

// ---------- Lever ----------
export async function fetchLever(company, slug) {
  const r = await getJSON(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
  if (!Array.isArray(r.data)) return { ok: false, jobs: [], error: r.error || (r.data?.error ?? `HTTP ${r.status}`) };
  const jobs = r.data.map((j) => {
    const location = [j.categories?.location, j.categories?.allLocations?.join('; ')].filter(Boolean).join('; ');
    const lists = (j.lists || []).map((l) => `<h3>${l.text}</h3>${l.content}`).join('');
    const sr = j.salaryRange;
    const salary = sr && sr.min ? `${sr.currency || ''} ${sr.min}–${sr.max} / ${sr.interval || ''}`.trim() : '';
    return {
      id: `lv:${slug}:${j.id}`,
      source: 'lever',
      company,
      title: j.text || '',
      url: j.hostedUrl,
      location,
      remote: j.workplaceType === 'remote' || isRemoteText(location),
      posted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      descriptionHtml: `${j.description || ''}${lists}${j.additional || ''}`,
      salary,
      department: [j.categories?.team, j.categories?.department].filter(Boolean).join(' / '),
      employmentType: j.categories?.commitment || '',
    };
  });
  return { ok: true, jobs };
}

// ---------- Ashby ----------
export async function fetchAshby(company, slug) {
  const r = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`);
  if (!r.data || !Array.isArray(r.data.jobs)) return { ok: false, jobs: [], error: r.error || `HTTP ${r.status}` };
  const jobs = r.data.jobs.filter((j) => j.isListed !== false).map((j) => {
    const location = [j.location, ...(j.secondaryLocations || []).map((l) => l.location)].filter(Boolean).join('; ');
    return {
      id: `ab:${slug}:${j.id}`,
      source: 'ashby',
      company,
      title: j.title || '',
      url: j.jobUrl || j.applyUrl,
      location,
      // Ashby's isRemote is true on Hybrid postings too; only workplaceType and the location text are trustworthy.
      remote: j.workplaceType === 'Remote' || isRemoteText(location),
      workplaceType: j.workplaceType || '',
      posted: j.publishedAt || null,
      descriptionHtml: j.descriptionHtml || j.descriptionPlain || '',
      salary: j.compensation?.compensationTierSummary || '',
      department: [j.department, j.team].filter(Boolean).join(' / '),
      employmentType: j.employmentType || '',
    };
  });
  // Ashby returns {jobs: []} for unknown boards too; flag as suspicious when empty.
  return { ok: true, jobs, emptyBoard: jobs.length === 0 };
}

// ---------- RemoteOK ----------
export async function fetchRemoteOK() {
  const r = await getJSON('https://remoteok.com/api');
  if (!Array.isArray(r.data)) return { ok: false, jobs: [], error: r.error || `HTTP ${r.status}` };
  const jobs = r.data.filter((j) => j && j.id && j.position).map((j) => ({
    id: `rok:${j.id}`,
    source: 'remoteok',
    company: j.company || 'Unknown',
    title: j.position,
    url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
    location: j.location || 'Remote',
    remote: true,
    posted: j.date || null,
    descriptionHtml: `${j.description || ''}\n\nTags: ${(j.tags || []).join(', ')}`,
    salary: j.salary_min ? `$${j.salary_min}–$${j.salary_max}` : '',
    department: '',
    employmentType: '',
  }));
  return { ok: true, jobs };
}

// ---------- Hacker News: Who is hiring ----------
export async function fetchHNWhoIsHiring() {
  const s = await getJSON('https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=10');
  const hit = (s.data?.hits || []).find((h) => /who is hiring\?/i.test(h.title || ''));
  if (!hit) return { ok: false, jobs: [], error: 'no Who is hiring thread found' };
  const t = await getJSON(`https://hn.algolia.com/api/v1/items/${hit.objectID}`);
  if (!t.data?.children) return { ok: false, jobs: [], error: t.error || `HTTP ${t.status}` };
  const jobs = [];
  for (const c of t.data.children) {
    if (!c.text) continue;
    const text = htmlToText(c.text);
    let firstLine = text.split('\n').find((l) => l.trim()) || '';
    // HN posts often run the header and body together; cut the header at the first sentence end.
    firstLine = firstLine.split(/(?<=[a-z\)])\.\s+(?=[A-Z])/)[0];
    const segs = firstLine.split('|').map((x) => x.trim()).filter(Boolean).map((x) => x.slice(0, 60));
    const company = (segs[0] || 'HN post').slice(0, 60);
    const header = segs.slice(0, 7).join(' | ').slice(0, 140);
    jobs.push({
      id: `hn:${c.id}`,
      source: 'hn',
      company,
      title: header,
      url: `https://news.ycombinator.com/item?id=${c.id}`,
      location: segs.slice(1).filter((x) => /remote|onsite|on-site|hybrid|,\s*[A-Z]{2}\b|san francisco|new york|nyc|sf\b/i.test(x)).join('; ').slice(0, 120),
      remote: /remote/i.test(firstLine),
      posted: c.created_at || null,
      descriptionHtml: c.text,
      salary: (firstLine.match(/\$\s?\d{2,3}\s?k[^|]*/i) || [''])[0].trim(),
      department: '',
      employmentType: '',
      thread: hit.title,
    });
  }
  return { ok: true, jobs, thread: hit.title, threadUrl: `https://news.ycombinator.com/item?id=${hit.objectID}` };
}

// ---------- Workday (CXS API) ----------
// slug format: host/tenant/site  e.g. adobe.wd5.myworkdayjobs.com/adobe/external_experienced
// Workday boards are huge, so we search a handful of queries, keep only titles that pass titleFilter,
// then fetch details (description, remote type, url) for those only.
const WD_QUERIES = ['design engineer', 'design technologist', 'design systems', 'ux engineer', 'frontend engineer', 'front end engineer', 'prototyping engineer', 'design system engineer'];
export async function fetchWorkday(company, slug, titleFilter = () => true, { maxPages = 5, maxDetails = 80 } = {}) {
  const [host, tenant, site] = slug.split('/');
  if (!host || !tenant || !site) return { ok: false, jobs: [], error: 'slug must be host/tenant/site' };
  const base = `https://${host}/wday/cxs/${tenant}/${site}`;
  const H = { 'content-type': 'application/json', accept: 'application/json', 'user-agent': UA };
  const found = new Map();
  for (const q of WD_QUERIES) {
    for (let page = 0; page < maxPages; page++) {
      let d;
      try {
        const r = await fetch(`${base}/jobs`, { method: 'POST', headers: H, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: page * 20, searchText: q }), signal: AbortSignal.timeout(25000) });
        if (r.status >= 400) return { ok: false, jobs: [], error: `HTTP ${r.status}` };
        d = await r.json();
      } catch (e) { return { ok: false, jobs: [], error: e.name === 'TimeoutError' ? 'timeout' : e.message }; }
      const posts = d?.jobPostings || [];
      for (const p of posts) if (p.externalPath && !found.has(p.externalPath)) found.set(p.externalPath, p);
      if (posts.length < 20 || (page + 1) * 20 >= (d.total || 0)) break;
    }
  }
  const candidates = [...found.values()].filter((p) => titleFilter(p.title || '')).slice(0, maxDetails);
  const jobs = [];
  for (const p of candidates) {
    let info = null;
    try {
      const r = await fetch(`${base}${p.externalPath}`, { headers: H, signal: AbortSignal.timeout(25000) });
      info = (await r.json())?.jobPostingInfo || null;
    } catch { /* skip detail */ }
    const location = [info?.location, ...(info?.additionalLocations || [])].filter(Boolean).join('; ') || p.locationsText || '';
    const remoteType = info?.remoteType || '';
    jobs.push({
      id: `wd:${tenant}:${(info?.jobReqId || p.bulletFields?.[0] || p.externalPath).toString().replace(/[^\w-]/g, '')}`,
      source: 'workday',
      company,
      title: info?.title || p.title || '',
      url: info?.externalUrl || `https://${host}/${site}${p.externalPath}`,
      location,
      remote: /remote/i.test(remoteType) || isRemoteText(location) || isRemoteText(p.title || ''),
      posted: info?.startDate || null,
      descriptionHtml: info?.jobDescription || '',
      salary: '',
      department: '',
      employmentType: info?.timeType || '',
      workplaceType: remoteType,
    });
  }
  return { ok: true, jobs, scanned: found.size };
}

export function makeTitleFilter(criteria) {
  const terms = Object.keys(criteria?.titleTerms || {}).map((t) => t.toLowerCase());
  const excl = (criteria?.titleExclude || []).map((t) => t.toLowerCase());
  return (title) => { const t = (title || '').toLowerCase(); return terms.some((k) => t.includes(k)) && !excl.some((k) => t.includes(k)); };
}

export async function fetchCompany(c, criteria) {
  if (c.ats === 'greenhouse') return fetchGreenhouse(c.name, c.slug);
  if (c.ats === 'lever') return fetchLever(c.name, c.slug);
  if (c.ats === 'ashby') return fetchAshby(c.name, c.slug);
  if (c.ats === 'workday') return fetchWorkday(c.name, c.slug, makeTitleFilter(criteria));
  const extra = await import('./sources-extra.mjs');
  if (extra.EXTRA_ATS.includes(c.ats)) return extra.fetchExtraCompany(c, makeTitleFilter(criteria));
  return { ok: false, jobs: [], error: `unknown ats ${c.ats}` };
}
