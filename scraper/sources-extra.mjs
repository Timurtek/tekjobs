// Additional sources beyond Greenhouse/Lever/Ashby/Workday. Same normalized job shape as sources.mjs.
// Company-slug platforms: rippling, smartrecruiters, workable, bamboohr, breezy, personio, teamtailor, eightfold.
// Singletons (slug "-"): atlassian, github, spotify, amazon, and google + apple from sources-sites.mjs.
// Aggregators (toggled by criteria.openSources): email (a local folder), adzuna and usajobs (need keys),
// themuse, remotive, himalayas, jobicy,
// workingnomads, arbeitnow, wwr, and wellfound + builtin from sources-sites.mjs.
import { htmlToText, decodeEntities } from './sources.mjs';
import { fetchGoogle, fetchApple, fetchWellfound, fetchBuiltIn } from './sources-sites.mjs';

import { UA } from './config.mjs';
const H = { accept: 'application/json', 'user-agent': UA };
async function req(url, { method = 'GET', body, headers = {}, timeoutMs = 25000 } = {}) {
  try {
    const r = await fetch(url, { method, headers: { ...H, ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, ok: r.ok, data, text };
  } catch (e) { return { status: 0, ok: false, data: null, text: '', error: e.name === 'TimeoutError' ? 'timeout' : e.message }; }
}
const bad = (r) => ({ ok: false, jobs: [], error: r.error || `HTTP ${r.status}` });
const isRemoteText = (s = '') => /\bremote\b|\bdistributed\b|\banywhere\b|\bvirtual\b/i.test(s) || /^\s*(united states|usa|u\.s\.|us|north america|americas)\s*$/i.test(s);
const iso = (v) => { if (!v) return null; const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v); return isNaN(d) ? null : d.toISOString(); };
const job = (o) => ({ salary: '', department: '', employmentType: '', descriptionHtml: '', location: '', remote: false, posted: null, ...o });

// ---------------- company-slug platforms ----------------

// Rippling ATS: https://ats.rippling.com/<slug>/jobs
export async function fetchRippling(company, slug, titleFilter = () => true) {
  const r = await req(`https://api.rippling.com/platform/api/ats/v1/board/${encodeURIComponent(slug)}/jobs`);
  if (!Array.isArray(r.data)) return bad(r);
  const jobs = [];
  for (const j of r.data) {
    const loc = j.workLocation?.label || '';
    const base = job({ id: `rp:${slug}:${j.uuid}`, source: 'rippling', company, title: j.name || '', url: j.url || `https://ats.rippling.com/${slug}/jobs/${j.uuid}`, location: loc, remote: isRemoteText(loc) || isRemoteText(j.name || ''), department: j.department?.label || '' });
    if (titleFilter(base.title)) {
      const d = await req(`https://api.rippling.com/platform/api/ats/v1/board/${encodeURIComponent(slug)}/jobs/${j.uuid}`);
      if (d.data) {
        const desc = d.data.description;
        base.descriptionHtml = typeof desc === 'string' ? desc : Object.values(desc || {}).filter((v) => typeof v === 'string').join('\n');
        base.posted = iso(d.data.createdOn || d.data.createdAt || d.data.publishedAt);
        base.employmentType = d.data.employmentType?.id || d.data.employmentType?.label || '';
        if (Array.isArray(d.data.workLocations) && d.data.workLocations.length) { base.location = d.data.workLocations.join('; '); base.remote = isRemoteText(base.location) || isRemoteText(base.title); }
      }
    }
    jobs.push(base);
  }
  return { ok: true, jobs };
}

// SmartRecruiters: https://jobs.smartrecruiters.com/<Company>
export async function fetchSmartRecruiters(company, slug, titleFilter = () => true, { maxDetails = 60 } = {}) {
  const all = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const r = await req(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100&offset=${offset}`);
    if (!r.data || !Array.isArray(r.data.content)) { if (offset === 0) return bad(r); break; }
    all.push(...r.data.content);
    if (all.length >= (r.data.totalFound || 0) || r.data.content.length < 100) break;
  }
  const jobs = []; let details = 0;
  for (const p of all) {
    const L = p.location || {};
    const loc = L.fullLocation || [L.city, L.region, L.country].filter(Boolean).join(', ');
    const base = job({ id: `sr:${slug}:${p.id}`, source: 'smartrecruiters', company, title: p.name || '', url: `https://jobs.smartrecruiters.com/${slug}/${p.id}`, location: loc, remote: !!L.remote || isRemoteText(loc), posted: iso(p.releasedDate), department: p.department?.label || '', employmentType: p.typeOfEmployment?.label || '' });
    if (titleFilter(base.title) && details < maxDetails) {
      details++;
      const d = await req(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${p.id}`);
      const secs = d.data?.jobAd?.sections || {};
      base.descriptionHtml = Object.values(secs).map((s) => `<h3>${s.title || ''}</h3>${s.text || ''}`).join('');
      if (d.data?.applyUrl) base.url = d.data.applyUrl.replace(/\?.*$/, '') || base.url;
    }
    jobs.push(base);
  }
  return { ok: true, jobs };
}

// Workable: https://apply.workable.com/<account>/
export async function fetchWorkable(company, slug) {
  const r = await req(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`);
  if (!r.data || !Array.isArray(r.data.jobs)) return bad(r);
  const jobs = r.data.jobs.map((j) => {
    const loc = [j.city, j.state, j.country].filter(Boolean).join(', ') || (j.locations || []).map((l) => [l.city, l.region, l.country].filter(Boolean).join(', ')).join('; ');
    return job({ id: `wk:${slug}:${j.shortcode}`, source: 'workable', company, title: j.title || '', url: j.url || j.shortlink, location: loc, remote: !!j.telecommuting || isRemoteText(loc), posted: iso(j.published_on), descriptionHtml: `${j.description || ''}${j.requirements || ''}${j.benefits || ''}`, department: j.department || '', employmentType: j.employment_type || '' });
  });
  return { ok: true, jobs };
}

// BambooHR: https://<sub>.bamboohr.com/careers
export async function fetchBambooHR(company, slug, titleFilter = () => true) {
  const r = await req(`https://${slug}.bamboohr.com/careers/list`);
  if (!r.data || !Array.isArray(r.data.result)) return bad(r);
  const jobs = [];
  for (const j of r.data.result) {
    const loc = [j.location?.city, j.location?.state, j.atsLocation?.country].filter(Boolean).join(', ');
    const base = job({ id: `bh:${slug}:${j.id}`, source: 'bamboohr', company, title: j.jobOpeningName || '', url: `https://${slug}.bamboohr.com/careers/${j.id}`, location: loc || (j.isRemote ? 'Remote' : ''), remote: !!j.isRemote || isRemoteText(loc), department: j.departmentLabel || '', employmentType: j.employmentStatusLabel || '' });
    if (titleFilter(base.title)) {
      const d = await req(`https://${slug}.bamboohr.com/careers/${j.id}/detail`);
      const info = d.data?.result?.jobOpening;
      if (info) { base.descriptionHtml = info.description || ''; base.posted = iso(info.datePosted); }
    }
    jobs.push(base);
  }
  return { ok: true, jobs };
}

// Breezy: https://<co>.breezy.hr
export async function fetchBreezy(company, slug) {
  const r = await req(`https://${slug}.breezy.hr/json`);
  if (!Array.isArray(r.data)) return bad(r);
  const jobs = r.data.map((j) => job({ id: `bz:${slug}:${j.id}`, source: 'breezy', company, title: j.name || '', url: j.url, location: j.location?.name || '', remote: !!j.location?.is_remote || isRemoteText(j.location?.name || ''), posted: iso(j.published_date), salary: j.salary || '', department: j.department || '', employmentType: j.type?.name || '' }));
  return { ok: true, jobs };
}

// Personio: https://<co>.jobs.personio.de  (XML feed)
export async function fetchPersonio(company, slug) {
  const r = await req(`https://${slug}.jobs.personio.de/xml`);
  if (!r.text.includes('<position')) return bad(r);
  const jobs = [];
  for (const m of r.text.matchAll(/<position>([\s\S]*?)<\/position>/g)) {
    const x = m[1]; const tag = (t) => decodeEntities((x.match(new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`)) || [, ''])[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim());
    const id = tag('id'); const loc = tag('office');
    const desc = [...x.matchAll(/<jobDescription>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<value>([\s\S]*?)<\/value>/g)].map((d) => `<h3>${d[1]}</h3>${d[2]}`).join('').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    jobs.push(job({ id: `pe:${slug}:${id}`, source: 'personio', company, title: tag('name'), url: `https://${slug}.jobs.personio.de/job/${id}`, location: loc, remote: isRemoteText(loc) || tag('schedule').toLowerCase().includes('remote'), posted: iso(tag('createdAt')), descriptionHtml: desc, department: tag('department'), employmentType: tag('employmentType') || tag('schedule') }));
  }
  return { ok: true, jobs };
}

// Teamtailor: https://<co>.teamtailor.com  (JSON Feed at /jobs.json)
export async function fetchTeamtailor(company, slug) {
  const r = await req(`https://${slug}.teamtailor.com/jobs.json`);
  if (!r.data || !Array.isArray(r.data.items)) return bad(r);
  const jobs = r.data.items.map((i) => {
    const loc = (i.tags || []).filter((t) => !/full|part|remote|hybrid/i.test(t)).join('; ') || i._location || '';
    return job({ id: `tt:${slug}:${i.id}`, source: 'teamtailor', company, title: i.title || '', url: i.url, location: loc, remote: isRemoteText([loc, ...(i.tags || [])].join(' ')), posted: iso(i.date_published), descriptionHtml: i.content_html || i.content_text || '' });
  });
  return { ok: true, jobs };
}

// Eightfold: slug = host/domain  e.g. explore.jobs.netflix.net/netflix.com
const EF_QUERIES = ['design engineer', 'design systems', 'design technologist', 'ux engineer', 'frontend engineer', 'front end engineer', 'product designer', 'prototyping'];
export async function fetchEightfold(company, slug, titleFilter = () => true, { maxDetails = 60 } = {}) {
  const [host, domain] = slug.split('/');
  if (!host || !domain) return { ok: false, jobs: [], error: 'slug must be host/domain' };
  const found = new Map();
  for (const q of EF_QUERIES) {
    for (let start = 0; start < 100; start += 50) {
      const r = await req(`https://${host}/api/apply/v2/jobs?domain=${encodeURIComponent(domain)}&start=${start}&num=50&query=${encodeURIComponent(q)}`);
      if (!r.data || !Array.isArray(r.data.positions)) { if (found.size === 0 && start === 0 && q === EF_QUERIES[0]) return bad(r); break; }
      for (const p of r.data.positions) found.set(p.id, p);
      if (r.data.positions.length < 50) break;
    }
  }
  const jobs = []; let details = 0;
  for (const p of found.values()) {
    const loc = (p.locations || [p.location]).filter(Boolean).join('; ');
    const base = job({ id: `ef:${domain}:${p.id}`, source: 'eightfold', company, title: p.name || p.posting_name || '', url: p.canonicalPositionUrl || `https://${host}/careers?pid=${p.id}&domain=${domain}`, location: loc, remote: isRemoteText(loc), posted: iso(p.t_create || p.t_update), department: [p.business_unit, p.department].filter(Boolean).join(' / ') });
    if (titleFilter(base.title) && details < maxDetails) {
      details++;
      const d = await req(`https://${host}/api/apply/v2/jobs/${p.id}?domain=${encodeURIComponent(domain)}`);
      if (d.data) { base.descriptionHtml = d.data.job_description || d.data.description || ''; if (d.data.canonicalPositionUrl) base.url = d.data.canonicalPositionUrl; }
    }
    jobs.push(base);
  }
  return { ok: true, jobs, scanned: found.size };
}

// ---------------- singletons ----------------

export async function fetchAtlassian() {
  const r = await req('https://www.atlassian.com/endpoint/careers/listings');
  if (!Array.isArray(r.data)) return bad(r);
  const jobs = r.data.map((j) => {
    const loc = (j.locations || []).join('; ');
    return job({ id: `atl:${j.id}`, source: 'atlassian', company: 'Atlassian', title: j.title || '', url: j.applyUrl?.replace(/\?mode=apply$/, '') || j.portalJobPost?.portalUrl, location: loc, remote: isRemoteText(loc), posted: iso(j.portalJobPost?.updatedDate), descriptionHtml: `${j.overview || ''}${j.responsibilities || ''}${j.qualifications || ''}${j.compensation || ''}`, department: j.category || '' });
  });
  return { ok: true, jobs };
}

export async function fetchGitHub() {
  const jobs = [];
  for (let page = 1; page <= 40; page++) {
    const r = await req(`https://www.github.careers/api/jobs?page=${page}`);
    if (!r.data || !Array.isArray(r.data.jobs)) { if (page === 1) return bad(r); break; }
    for (const w of r.data.jobs) {
      const d = w.data || w;
      const tags = [...(d.tags6 || []), ...(d.tags2 || [])].join(' ');
      const loc = [d.location_name, ...(d.tags6 || [])].filter(Boolean).join('; ');
      jobs.push(job({ id: `gh-careers:${d.req_id || d.slug}`, source: 'github', company: 'GitHub', title: d.title || '', url: `https://www.github.careers/careers-home/jobs/${d.req_id || d.slug}`, location: loc, remote: /remote/i.test(tags) || d.location_type === 'ANY', posted: iso(d.posted_date), descriptionHtml: `${d.description || ''}<h3>Responsibilities</h3>${d.responsibilities || ''}<h3>Qualifications</h3>${d.qualifications || ''}`, department: (d.categories || []).map((c) => c.name).join(', '), employmentType: (d.tags4 || []).join(', ') }));
    }
    if (r.data.jobs.length === 0 || jobs.length >= (r.data.totalCount || Infinity)) break;
  }
  return { ok: true, jobs };
}

export async function fetchSpotify() {
  const seen = new Map();
  for (const q of ['design', 'frontend', 'front-end', 'web engineer', 'prototyp', 'ux']) {
    const r = await req(`https://api-dot-new-spotifyjobs-com.nw.r.appspot.com/wp-json/animal/v1/job/search?q=${encodeURIComponent(q)}`);
    if (!r.data || !Array.isArray(r.data.result)) { if (seen.size === 0 && q === 'design') return bad(r); continue; }
    for (const j of r.data.result) seen.set(j.id, j);
  }
  const jobs = [...seen.values()].map((j) => {
    const loc = (j.locations || []).map((l) => l.location).join('; ');
    return job({ id: `sp:${j.id}`, source: 'spotify', company: 'Spotify', title: j.text || '', url: `https://www.lifeatspotify.com/jobs/${j.id}`, location: loc, remote: isRemoteText(loc) || /remote|anywhere/i.test(j.job_type?.name || ''), descriptionHtml: `<p>${j.main_category?.name || ''} · ${j.sub_category?.name || ''}</p>`, department: [j.main_category?.name, j.sub_category?.name].filter(Boolean).join(' / '), employmentType: j.job_type?.name || '' });
  });
  return { ok: true, jobs };
}

const AMZ_QUERIES = ['design engineer', 'design technologist', 'design systems', 'ux engineer', 'front end engineer', 'frontend engineer', 'prototyper'];
export async function fetchAmazon(titleFilter = () => true) {
  const found = new Map();
  for (const q of AMZ_QUERIES) {
    const r = await req(`https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(q)}&result_limit=100&offset=0&country=USA`);
    if (!r.data || !Array.isArray(r.data.jobs)) { if (found.size === 0 && q === AMZ_QUERIES[0]) return bad(r); continue; }
    for (const j of r.data.jobs) found.set(j.id, j);
  }
  const jobs = [...found.values()].filter((j) => titleFilter(j.title || '')).map((j) => job({ id: `amz:${j.id_icims || j.id}`, source: 'amazon', company: j.company_name || 'Amazon', title: j.title || '', url: `https://www.amazon.jobs${j.job_path}`, location: j.normalized_location || j.location || '', remote: isRemoteText(j.normalized_location || j.location || '') || /virtual/i.test(j.location || ''), posted: iso(j.posted_date), descriptionHtml: `${j.description || ''}<h3>Basic qualifications</h3>${j.basic_qualifications || ''}<h3>Preferred qualifications</h3>${j.preferred_qualifications || ''}`, department: j.job_category || '', employmentType: j.job_schedule_type || '' }));
  return { ok: true, jobs, scanned: found.size };
}

// ---------------- aggregators ----------------

export async function fetchTheMuse({ pages = 12 } = {}) {
  const jobs = []; const seen = new Set();
  for (const cat of ['Design and UX', 'Software Engineering', 'UX']) {
    for (let page = 1; page <= pages; page++) {
      const r = await req(`https://www.themuse.com/api/public/jobs?category=${encodeURIComponent(cat)}&location=${encodeURIComponent('Flexible / Remote')}&page=${page}`);
      if (!r.data || !Array.isArray(r.data.results)) { if (jobs.length === 0 && page === 1 && cat === 'Design and UX') return bad(r); break; }
      for (const j of r.data.results) {
        if (seen.has(j.id)) continue; seen.add(j.id);
        const loc = (j.locations || []).map((l) => l.name).join('; ');
        jobs.push(job({ id: `muse:${j.id}`, source: 'themuse', company: j.company?.name || 'Unknown', title: j.name || '', url: j.refs?.landing_page, location: loc, remote: isRemoteText(loc) || /flexible/i.test(loc), posted: iso(j.publication_date), descriptionHtml: j.contents || '', department: (j.categories || []).map((c) => c.name).join(', '), employmentType: (j.levels || []).map((l) => l.name).join(', ') }));
      }
      if (page >= (r.data.page_count || 0)) break;
    }
  }
  return { ok: true, jobs };
}

// TekJobs' own postings: the feed the site serves from what employers paid to post. On by default, because
// it is the one source that exists for these readers; `openSources.tekjobs: false` turns it off.
const TEKJOBS_FEED = process.env.TEKJOBS_FEED || 'https://tekjobs.timurtek.com/api/feed/jobs';
export async function fetchTekJobs() {
  const r = await req(TEKJOBS_FEED);
  if (!r.ok || !Array.isArray(r.data?.jobs)) return bad(r);
  const jobs = r.data.jobs.map((j) => job({
    id: `tj:${j.id}`, source: 'tekjobs', company: j.company || 'Unknown', title: j.title || '', url: j.url, location: j.location || '', remote: !!j.remote,
    posted: iso(j.posted), descriptionHtml: `<p>${String(j.description || '').replace(/\n\n/g, '</p><p>')}</p>${(j.tags || []).length ? `<p>Keywords: ${j.tags.join(', ')}</p>` : ''}${j.applyUrl ? `<p>Apply: ${j.applyUrl}</p>` : ''}${j.applyEmail ? `<p>Apply by email: ${j.applyEmail}</p>` : ''}`,
    salary: j.salary || '', salaryMin: j.salaryMin || 0, salaryMax: j.salaryMax || 0, department: j.department || '', employmentType: j.employmentType || '',
  }));
  return { ok: true, jobs, scanned: jobs.length };
}

export async function fetchRemotive() {
  const jobs = []; const seen = new Set();
  for (const cat of ['software-dev', 'design', 'product']) {
    const r = await req(`https://remotive.com/api/remote-jobs?category=${cat}&limit=300`);
    if (!r.data || !Array.isArray(r.data.jobs)) { if (jobs.length === 0 && cat === 'software-dev') return bad(r); continue; }
    for (const j of r.data.jobs) {
      if (seen.has(j.id)) continue; seen.add(j.id);
      const loc = j.candidate_required_location || 'Worldwide';
      jobs.push(job({ id: `rmv:${j.id}`, source: 'remotive', company: j.company_name || 'Unknown', title: j.title || '', url: j.url, location: `Remote · ${loc}`, remote: true, posted: iso(j.publication_date), descriptionHtml: `${j.description || ''}<p>Tags: ${(j.tags || []).join(', ')}</p>`, salary: j.salary || '', department: j.category || '', employmentType: j.job_type || '' }));
    }
  }
  return { ok: true, jobs };
}

export async function fetchHimalayas({ max = 400 } = {}) {
  const jobs = [];
  for (let offset = 0; offset < max; offset += 20) {   // API caps limit at 20
    const r = await req(`https://himalayas.app/jobs/api?limit=20&offset=${offset}`);
    if (!r.data || !Array.isArray(r.data.jobs)) { if (offset === 0) return bad(r); break; }
    for (const j of r.data.jobs) {
      const restr = (j.locationRestrictions || []).join('; ');
      const usOk = !restr || /united states|usa|north america|americas|worldwide|anywhere/i.test(restr);
      const sal = j.minSalary && j.salaryPeriod === 'yearly' ? `$${Math.round(j.minSalary / 1000)}k–$${Math.round((j.maxSalary || j.minSalary) / 1000)}k` : '';
      jobs.push(job({ id: `him:${j.guid || j.applicationLink || j.title + j.companyName}`, source: 'himalayas', company: j.companyName || 'Unknown', title: j.title || '', url: j.applicationLink || j.guid, location: `Remote · ${restr || 'Worldwide'}`, remote: usOk, posted: iso(j.pubDate), descriptionHtml: j.description || j.excerpt || '', salary: sal, employmentType: j.employmentType || '', department: (j.categories || []).join(', ') }));
    }
    if (r.data.jobs.length < 20) break;
  }
  return { ok: true, jobs };
}

export async function fetchJobicy() {
  const jobs = []; const seen = new Set();
  for (const tag of ['design', 'frontend', 'react', 'ux', 'ai']) {
    const r = await req(`https://jobicy.com/api/v2/remote-jobs?count=100&tag=${tag}&geo=usa`);
    if (!r.data || !Array.isArray(r.data.jobs)) continue;
    for (const j of r.data.jobs) {
      if (seen.has(j.id)) continue; seen.add(j.id);
      const sal = j.salaryMin && j.salaryPeriod === 'yearly' ? `$${Math.round(j.salaryMin / 1000)}k–$${Math.round(j.salaryMax / 1000)}k` : '';
      jobs.push(job({ id: `jby:${j.id}`, source: 'jobicy', company: j.companyName || 'Unknown', title: j.jobTitle || '', url: j.url, location: `Remote · ${j.jobGeo || 'Anywhere'}`, remote: true, posted: iso(j.pubDate), descriptionHtml: j.jobDescription || j.jobExcerpt || '', salary: sal, department: (j.jobIndustry || []).join(', '), employmentType: (j.jobType || []).join(', ') }));
    }
  }
  return jobs.length ? { ok: true, jobs } : { ok: false, jobs: [], error: 'no results' };
}

export async function fetchWorkingNomads() {
  const r = await req('https://www.workingnomads.com/api/exposed_jobs/');
  if (!Array.isArray(r.data)) return bad(r);
  const jobs = r.data.map((j) => job({ id: `wn:${(j.url || '').replace(/\D/g, '') || j.title}`, source: 'workingnomads', company: j.company_name || 'Unknown', title: j.title || '', url: j.url, location: `Remote · ${j.location || 'Anywhere'}`, remote: !j.location || /usa|united states|americas|north america|anywhere|worldwide/i.test(j.location), posted: iso(j.pub_date), descriptionHtml: `${j.description || ''}<p>Tags: ${j.tags || ''}</p>`, department: j.category_name || '' }));
  return { ok: true, jobs };
}

export async function fetchArbeitnow({ pages = 3 } = {}) {
  const jobs = [];
  for (let page = 1; page <= pages; page++) {
    const r = await req(`https://www.arbeitnow.com/api/job-board-api?remote=true&page=${page}`);
    if (!r.data || !Array.isArray(r.data.data)) { if (page === 1) return bad(r); break; }
    for (const j of r.data.data) jobs.push(job({ id: `arb:${j.slug}`, source: 'arbeitnow', company: j.company_name || 'Unknown', title: j.title || '', url: j.url, location: j.location || '', remote: !!j.remote, posted: iso(j.created_at), descriptionHtml: j.description || '', employmentType: (j.job_types || []).join(', ') }));
    if (!r.data.links?.next) break;
  }
  return { ok: true, jobs };
}

export async function fetchWWR() {
  const jobs = [];
  for (const cat of ['remote-design-jobs', 'remote-programming-jobs', 'remote-full-stack-programming-jobs', 'remote-front-end-programming-jobs', 'remote-product-jobs']) {
    const r = await req(`https://weworkremotely.com/categories/${cat}.rss`, { headers: { accept: 'application/rss+xml, application/xml, text/xml' } });
    if (!r.text.includes('<item>')) continue;
    for (const m of r.text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1]; const tag = (t) => decodeEntities((x.match(new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`)) || [, ''])[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim());
      const full = tag('title'); const [company, ...rest] = full.split(':'); const title = rest.join(':').trim() || full;
      const region = tag('region'); const link = tag('link') || tag('guid');
      if (jobs.some((j) => j.url === link)) continue;
      jobs.push(job({ id: `wwr:${link.split('/').filter(Boolean).pop()}`, source: 'wwr', company: company.trim(), title, url: link, location: `Remote · ${region || 'Anywhere'}`, remote: !region || /usa|united states|americas|north america|anywhere/i.test(region), posted: iso(tag('pubDate')), descriptionHtml: tag('description'), department: cat.replace(/remote-|-jobs/g, '') }));
    }
  }
  return jobs.length ? { ok: true, jobs } : { ok: false, jobs: [], error: 'no items' };
}

// ---------------- Adzuna ----------------
// https://developer.adzuna.com — free app id and key, read from ADZUNA_APP_ID and ADZUNA_APP_KEY.
//
// The only source here that needs a key, and the only one that is an aggregator of aggregators: it carries
// inventory from job sites with no usable public API of their own, including postings that never reach a
// company ATS board. That is the reason to have it, and it is the sanctioned way to see that inventory.
//
// Three limits to know before trusting what it returns:
//   1. The API returns a *snippet* of each description, not the full text. `descTerms` therefore see a
//      paragraph where an ATS source gives them a page, so an Adzuna row usually scores lower than the same
//      job fetched from its ATS. When both appear, run.mjs keeps the ATS copy.
//   2. Results are per country, and salary figures are in that country's currency. Only `us` rows get a
//      `$` salary string, because parseSalary reads dollars; other countries get a currency-tagged string
//      that is shown to the reader and deliberately not parsed as USD.
//   3. `salary_is_predicted` marks a figure Adzuna inferred rather than one the employer published. Those
//      are never emitted as a salary: a guessed number would move the pay band as if it were stated.
//
// `url` is Adzuna's redirect, not the employer's page — that is what the API gives, and it resolves.
const ADZUNA_COUNTRIES = ['us', 'gb', 'ca', 'au', 'at', 'be', 'br', 'ch', 'de', 'es', 'fr', 'in', 'it', 'mx', 'nl', 'nz', 'pl', 'sg', 'za'];
const ADZUNA_CURRENCY = { us: 'USD', gb: 'GBP', ca: 'CAD', au: 'AUD', at: 'EUR', be: 'EUR', br: 'BRL', ch: 'CHF', de: 'EUR', es: 'EUR', fr: 'EUR', in: 'INR', it: 'EUR', mx: 'MXN', nl: 'EUR', nz: 'NZD', pl: 'PLN', sg: 'SGD', za: 'ZAR' };

const adzunaSalary = (j, country) => {
  const lo = Number(j.salary_min) || 0, hi = Number(j.salary_max) || 0;
  if (!hi || String(j.salary_is_predicted) === '1') return '';
  const k = (n) => `${Math.round(n / 1000)}k`;
  if (country === 'us') return lo && lo !== hi ? `$${k(lo)} - $${k(hi)}` : `$${k(hi)}`;
  const cur = ADZUNA_CURRENCY[country] || country.toUpperCase();
  return lo && lo !== hi ? `${cur} ${k(lo)}-${k(hi)}` : `${cur} ${k(hi)}`;
};

/**
 * One query per search term per country, paginated. Terms come from the profile's own `titleTerms` unless
 * `adzuna.queries` overrides them, so the feed follows the profile rather than being a second thing to tune.
 */
export async function fetchAdzuna(criteria = {}) {
  const appId = process.env.ADZUNA_APP_ID, appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return { ok: false, jobs: [], error: 'needs ADZUNA_APP_ID and ADZUNA_APP_KEY (free at developer.adzuna.com)' };

  const cfg = criteria.adzuna || {};
  const countries = (cfg.countries?.length ? cfg.countries : ['us']).filter((c) => ADZUNA_COUNTRIES.includes(c));
  if (!countries.length) return { ok: false, jobs: [], error: `no supported country in adzuna.countries (have: ${ADZUNA_COUNTRIES.join(', ')})` };
  const queries = cfg.queries?.length
    ? cfg.queries
    : Object.entries(criteria.titleTerms || {}).sort((a, b) => b[1] - a[1]).slice(0, cfg.maxQueries ?? 6).map(([t]) => t);
  if (!queries.length) return { ok: false, jobs: [], error: 'no titleTerms and no adzuna.queries to search for' };

  const pages = Math.max(1, cfg.pages ?? 2);
  const perPage = Math.min(50, cfg.resultsPerPage ?? 50);
  const maxDaysOld = cfg.maxDaysOld ?? 30;
  const cutoff = Date.now() - maxDaysOld * 864e5;

  const byId = new Map();   // the same posting comes back under several terms
  let calls = 0, failed = 0, lastError = '';
  for (const country of countries) {
    for (const what of queries) {
      for (let page = 1; page <= pages; page++) {
        const qs = new URLSearchParams({ app_id: appId, app_key: appKey, 'content-type': 'application/json', results_per_page: String(perPage), what, max_days_old: String(maxDaysOld) });
        if (cfg.where) qs.set('where', cfg.where);
        const r = await req(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${qs}`);
        calls++;
        if (!r.data || !Array.isArray(r.data.results)) { failed++; lastError = r.error || `HTTP ${r.status}`; break; }
        for (const j of r.data.results) {
          const id = `adz:${country}:${j.id}`;
          if (byId.has(id)) continue;
          const location = j.location?.display_name || (j.location?.area || []).slice(1).reverse().join(', ') || '';
          const title = decodeEntities(j.title || '').replace(/<[^>]+>/g, '').trim();
          // max_days_old is sent, but filtered here too so recency holds even if the parameter is ignored.
          const posted = iso(j.created);
          if (posted && Date.parse(posted) < cutoff) continue;
          byId.set(id, job({
            id,
            source: 'adzuna',
            company: decodeEntities(j.company?.display_name || 'Unknown').trim(),
            title,
            url: j.redirect_url || '',
            location,
            remote: isRemoteText(location) || isRemoteText(title),
            posted,
            descriptionHtml: j.description || '',
            salary: adzunaSalary(j, country),
            department: j.category?.label || '',
            employmentType: [j.contract_time, j.contract_type].filter(Boolean).join(', '),
          }));
        }
        if (r.data.results.length < perPage) break;   // last page for this term
      }
    }
  }
  if (!byId.size) return { ok: false, jobs: [], error: failed ? `${failed}/${calls} requests failed (${lastError})` : 'no results' };
  return { ok: true, jobs: [...byId.values()] };
}

// ---------------- USAJOBS ----------------
// https://developer.usajobs.gov — free key, plus the email you registered it with, which the API expects as
// the User-Agent. Read from USAJOBS_API_KEY and USAJOBS_EMAIL.
//
// Every federal job in the United States, from one endpoint. Unlike Adzuna this returns the *whole*
// description under Fields=Full, so descTerms see as much as they do from an ATS, and these rows score on
// equal footing. It also carries an ApplicationCloseDate, which almost nothing else does — federal postings
// have hard deadlines.
//
// Two shapes to respect:
//   1. PositionRemuneration carries a RateIntervalCode. Only "PA" (per annum) becomes a `$` salary;
//      an hourly or biweekly figure written as an annual one would put the pay band somewhere invented.
//   2. Host is not set as a header. The docs list it, but it is derived from the URL and Node forbids
//      setting it; the request is to data.usajobs.gov either way.
const USAJOBS_DESC_PARTS = ['JobSummary', 'MajorDuties', 'Qualifications', 'Requirements', 'Education'];

const usajobsSalary = (rem = []) => {
  const annual = rem.find((r) => r.RateIntervalCode === 'PA');
  if (!annual) return '';
  const lo = Number(annual.MinimumRange) || 0, hi = Number(annual.MaximumRange) || 0;
  if (!hi) return '';
  const k = (n) => `${Math.round(n / 1000)}k`;
  return lo && lo !== hi ? `$${k(lo)} - $${k(hi)}` : `$${k(hi)}`;
};

/**
 * One query per search term, paginated. Terms come from the profile's `titleTerms` unless
 * `usajobs.queries` overrides them, matching how Adzuna works.
 */
export async function fetchUSAJobs(criteria = {}) {
  const key = process.env.USAJOBS_API_KEY, email = process.env.USAJOBS_EMAIL;
  if (!key || !email) return { ok: false, jobs: [], error: 'needs USAJOBS_API_KEY and USAJOBS_EMAIL (free at developer.usajobs.gov; the email is the one the key is registered to)' };

  const cfg = criteria.usajobs || {};
  const queries = cfg.queries?.length
    ? cfg.queries
    : Object.entries(criteria.titleTerms || {}).sort((a, b) => b[1] - a[1]).slice(0, cfg.maxQueries ?? 6).map(([t]) => t);
  if (!queries.length) return { ok: false, jobs: [], error: 'no titleTerms and no usajobs.queries to search for' };

  const pages = Math.max(1, cfg.pages ?? 2);
  const perPage = Math.min(500, cfg.resultsPerPage ?? 250);
  const datePosted = Math.min(60, Math.max(0, cfg.datePosted ?? 30));   // the API caps this at 60 days
  const remoteOnly = cfg.remoteOnly ?? criteria.location?.requireRemote ?? false;
  const headers = { 'Authorization-Key': key, 'user-agent': email };

  const byId = new Map();
  let calls = 0, failed = 0, lastError = '';
  for (const term of queries) {
    for (let page = 1; page <= pages; page++) {
      const qs = new URLSearchParams({ [cfg.searchBy === 'keyword' ? 'Keyword' : 'PositionTitle']: term, ResultsPerPage: String(perPage), Page: String(page), DatePosted: String(datePosted), Fields: 'Full' });
      if (remoteOnly) qs.set('RemoteIndicator', 'True');
      if (cfg.locationName) qs.set('LocationName', cfg.locationName);
      const r = await req(`https://data.usajobs.gov/api/Search?${qs}`, { headers });
      calls++;
      const result = r.data?.SearchResult;
      if (!result || !Array.isArray(result.SearchResultItems)) { failed++; lastError = r.error || `HTTP ${r.status}`; break; }
      for (const item of result.SearchResultItems) {
        const d = item.MatchedObjectDescriptor || {};
        const id = `usa:${item.MatchedObjectId || d.PositionID}`;
        if (byId.has(id)) continue;
        const details = d.UserArea?.Details || {};
        const location = d.PositionLocationDisplay || (d.PositionLocation || []).map((l) => l.LocationName).join('; ') || '';
        const closes = iso(d.ApplicationCloseDate);
        byId.set(id, job({
          id,
          source: 'usajobs',
          // The agency is the employer; the department is the parent, and is the more recognisable name.
          company: d.OrganizationName || d.DepartmentName || 'US Federal Government',
          title: decodeEntities(d.PositionTitle || '').trim(),
          url: d.PositionURI || (Array.isArray(d.ApplyURI) ? d.ApplyURI[0] : '') || '',
          location,
          remote: isRemoteText(location) || /\bremote\b/i.test(d.PositionTitle || ''),
          posted: iso(d.PublicationStartDate || d.PositionStartDate),
          descriptionHtml: [
            ...USAJOBS_DESC_PARTS.map((k) => (details[k] ? `<h3>${k.replace(/([a-z])([A-Z])/g, '$1 $2')}</h3>${details[k]}` : '')),
            d.QualificationSummary ? `<h3>Qualification summary</h3>${d.QualificationSummary}` : '',
            closes ? `<p>Applications close ${closes.slice(0, 10)}.</p>` : '',
          ].filter(Boolean).join(''),
          salary: usajobsSalary(d.PositionRemuneration),
          department: (d.JobCategory || []).map((c) => c.Name).filter(Boolean).join(', ') || d.DepartmentName || '',
          employmentType: [(d.PositionSchedule || [])[0]?.Name, (d.PositionOfferingType || [])[0]?.Name].filter(Boolean).join(', '),
        }));
      }
      const totalPages = Number(result.UserArea?.NumberOfPages) || 1;
      if (page >= totalPages || result.SearchResultItems.length < perPage) break;
    }
  }
  if (!byId.size) return { ok: false, jobs: [], error: failed ? `${failed}/${calls} requests failed (${lastError})` : 'no results' };
  return { ok: true, jobs: [...byId.values()] };
}

export const OPEN_SOURCES = {
  email: { label: 'Alert emails (Inbox folder)', fn: async (c) => (await import('./sources-email.mjs')).fetchEmailInbox(c) },
  adzuna: { label: 'Adzuna', fn: fetchAdzuna },
  usajobs: { label: 'USAJOBS (US federal)', fn: fetchUSAJobs },
  themuse: { label: 'The Muse (remote, design + engineering)', fn: fetchTheMuse },
  tekjobs: { label: 'TekJobs postings', fn: fetchTekJobs, defaultOn: true },
  remotive: { label: 'Remotive', fn: fetchRemotive },
  himalayas: { label: 'Himalayas', fn: fetchHimalayas },
  jobicy: { label: 'Jobicy', fn: fetchJobicy },
  workingnomads: { label: 'Working Nomads', fn: fetchWorkingNomads },
  arbeitnow: { label: 'Arbeitnow', fn: fetchArbeitnow },
  wwr: { label: 'We Work Remotely', fn: fetchWWR },
  wellfound: { label: 'Wellfound (remote design-engineering roles)', fn: fetchWellfound },
  builtin: { label: 'Built In (remote)', fn: fetchBuiltIn },
};

export const SINGLETONS = {
  atlassian: fetchAtlassian,
  github: fetchGitHub,
  spotify: fetchSpotify,
  amazon: fetchAmazon,
  google: fetchGoogle,
  apple: fetchApple,
};

export function fetchExtraCompany(c, titleFilter) {
  switch (c.ats) {
    case 'rippling': return fetchRippling(c.name, c.slug, titleFilter);
    case 'smartrecruiters': return fetchSmartRecruiters(c.name, c.slug, titleFilter);
    case 'workable': return fetchWorkable(c.name, c.slug);
    case 'bamboohr': return fetchBambooHR(c.name, c.slug, titleFilter);
    case 'breezy': return fetchBreezy(c.name, c.slug);
    case 'personio': return fetchPersonio(c.name, c.slug);
    case 'teamtailor': return fetchTeamtailor(c.name, c.slug);
    case 'eightfold': return fetchEightfold(c.name, c.slug, titleFilter);
    case 'atlassian': return fetchAtlassian();
    case 'github': return fetchGitHub();
    case 'spotify': return fetchSpotify();
    case 'amazon': return fetchAmazon(titleFilter);
    case 'google': return fetchGoogle(titleFilter);
    case 'apple': return fetchApple(titleFilter);
    default: return Promise.resolve({ ok: false, jobs: [], error: `unknown ats ${c.ats}` });
  }
}
export const EXTRA_ATS = ['rippling', 'smartrecruiters', 'workable', 'bamboohr', 'breezy', 'personio', 'teamtailor', 'eightfold', 'atlassian', 'github', 'spotify', 'amazon', 'google', 'apple'];
