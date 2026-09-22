// Probe candidate job sources beyond Greenhouse/Lever/Ashby/Workday. Read-only. Prints what responds and roughly how much.
const UA = 'TekJobs/1.0 (personal job search tool; +https://github.com/Timurtek/tekjobs)';
const J = { accept: 'application/json', 'user-agent': UA };
const T = [
  // --- other ATS platforms (company boards) ---
  ['ATS SmartRecruiters (visa)', 'https://api.smartrecruiters.com/v1/companies/Visa/postings?limit=5', 'GET', null, d => d?.totalFound],
  ['ATS SmartRecruiters (ubisoft)', 'https://api.smartrecruiters.com/v1/companies/Ubisoft2/postings?limit=5', 'GET', null, d => d?.totalFound],
  ['ATS Recruitee (mollie)', 'https://mollie.recruitee.com/api/offers/', 'GET', null, d => d?.offers?.length],
  ['ATS Workable (widget, typeform)', 'https://apply.workable.com/api/v1/widget/accounts/typeform?details=false', 'GET', null, d => d?.jobs?.length],
  ['ATS Workable (v3 jobs, typeform)', 'https://apply.workable.com/api/v3/accounts/typeform/jobs', 'POST', { query: '', location: [], department: [], worktype: [], remote: [] }, d => d?.total],
  ['ATS BambooHR (bamboohr)', 'https://bamboohr.bamboohr.com/careers/list', 'GET', null, d => d?.result?.length],
  ['ATS Pinpoint (pinpointhq)', 'https://pinpointhq.pinpointhq.com/postings.json', 'GET', null, d => d?.data?.length],
  ['ATS Breezy (breezy)', 'https://breezy.breezy.hr/json', 'GET', null, d => Array.isArray(d) ? d.length : null],
  ['ATS Rippling (rippling)', 'https://api.rippling.com/platform/api/ats/v1/board/rippling/jobs', 'GET', null, d => Array.isArray(d) ? d.length : d?.items?.length],
  ['ATS Eightfold (netflix)', 'https://explore.jobs.netflix.net/api/apply/v2/jobs?domain=netflix.com&start=0&num=10&query=design%20engineer', 'GET', null, d => d?.count],
  ['ATS Teamtailor (public jobs json?)', 'https://career.teamtailor.com/jobs.json', 'GET', null, d => d?.jobs?.length ?? d?.length],
  ['ATS Dover (?)', 'https://app.dover.com/api/v1/careers-page/dover/jobs', 'GET', null, d => d?.results?.length],
  ['ATS Gem (?)', 'https://jobs.gem.com/api/public/boards/gem', 'GET', null, d => d?.jobs?.length],
  ['ATS Personio (xml feed)', 'https://personio.jobs.personio.de/xml', 'GET', null, (d, t) => t?.includes('<position') ? (t.match(/<position>/g) || []).length : null],
  // --- big-tech proprietary career APIs ---
  ['BigTech Microsoft', 'https://gcsservices.careers.microsoft.com/search/api/v1/search?q=design%20engineer&l=en_us&pg=1&pgSz=20&o=Relevance&flt=true', 'GET', null, d => d?.operationResult?.result?.totalJobs],
  ['BigTech Google', 'https://careers.google.com/api/v3/search/?q=design%20engineer&page=1', 'GET', null, d => d?.count],
  ['BigTech Apple', 'https://jobs.apple.com/api/role/search', 'POST', { query: 'design engineer', filters: {}, page: 1, locale: 'en-us', sort: 'relevance' }, d => d?.totalRecords],
  ['BigTech Amazon', 'https://www.amazon.jobs/en/search.json?base_query=design%20engineer&result_limit=10&offset=0', 'GET', null, d => d?.hits],
  ['BigTech Atlassian', 'https://www.atlassian.com/endpoint/careers/listings', 'GET', null, d => Array.isArray(d) ? d.length : null],
  ['BigTech Spotify', 'https://api-dot-new-spotifyjobs-com.nw.r.appspot.com/wp-json/animal/v1/job/search?q=design', 'GET', null, d => d?.result?.length],
  ['BigTech Uber', 'https://www.uber.com/api/loadSearchJobsResults?localeCode=en', 'POST', { params: { query: 'design engineer', location: [], department: [], team: [], programAndPlatform: [], lineOfBusinessName: [] }, limit: 10, page: 0 }, d => d?.data?.totalResults?.low ?? d?.data?.totalResults, { 'x-csrf-token': 'x' }],
  ['BigTech Shopify (guess)', 'https://www.shopify.com/careers/api/search?keywords=design', 'GET', null, d => d?.length ?? d?.jobs?.length],
  ['BigTech GitHub (careers)', 'https://www.github.careers/api/jobs?keywords=design&page=1', 'GET', null, d => d?.totalCount ?? d?.jobs?.length],
  ['Remote-first Automattic (gh)', 'https://boards-api.greenhouse.io/v1/boards/automattic/jobs', 'GET', null, d => d?.jobs?.length],
  ['Remote-first Canonical (gh)', 'https://boards-api.greenhouse.io/v1/boards/canonical/jobs', 'GET', null, d => d?.jobs?.length],
  ['Remote-first Mozilla (gh)', 'https://boards-api.greenhouse.io/v1/boards/mozilla/jobs', 'GET', null, d => d?.jobs?.length],
  ['Remote-first Wikimedia (gh)', 'https://boards-api.greenhouse.io/v1/boards/wikimedia/jobs', 'GET', null, d => d?.jobs?.length],
  ['Remote-first HashiCorp (gh)', 'https://boards-api.greenhouse.io/v1/boards/hashicorp/jobs', 'GET', null, d => d?.jobs?.length],
  ['Remote-first Doist (?)', 'https://boards-api.greenhouse.io/v1/boards/doist/jobs', 'GET', null, d => d?.jobs?.length],
  // --- free aggregator APIs ---
  ['Agg Remotive', 'https://remotive.com/api/remote-jobs?category=software-dev&limit=5', 'GET', null, d => d?.['total-job-count'] ?? d?.jobs?.length],
  ['Agg Himalayas', 'https://himalayas.app/jobs/api?limit=5', 'GET', null, d => d?.total_count ?? d?.jobs?.length],
  ['Agg Jobicy', 'https://jobicy.com/api/v2/remote-jobs?count=5&tag=design', 'GET', null, d => d?.jobCount ?? d?.jobs?.length],
  ['Agg Working Nomads', 'https://www.workingnomads.com/api/exposed_jobs/', 'GET', null, d => Array.isArray(d) ? d.length : null],
  ['Agg The Muse', 'https://www.themuse.com/api/public/jobs?category=Design%20and%20UX&page=1', 'GET', null, d => d?.total ?? d?.results?.length],
  ['Agg Arbeitnow', 'https://www.arbeitnow.com/api/job-board-api?remote=true', 'GET', null, d => d?.data?.length],
  ['Agg WeWorkRemotely RSS (design)', 'https://weworkremotely.com/categories/remote-design-jobs.rss', 'GET', null, (d, t) => (t?.match(/<item>/g) || []).length || null],
  ['Agg WeWorkRemotely RSS (programming)', 'https://weworkremotely.com/categories/remote-programming-jobs.rss', 'GET', null, (d, t) => (t?.match(/<item>/g) || []).length || null],
  ['Agg YC Work at a Startup (algolia)', 'https://45bwzj1sgc-dsn.algolia.net/1/indexes/WaaSPublicCompanyJob/query?x-algolia-application-id=45BWZJ1SGC&x-algolia-api-key=MjBjYjRiMzY0NzdhZWY0NjExY2NhZjYxMGIxYjc2MTAwNWFkNTkwNTc4NjgxYjU0YzFhYTY2ZGQ5OGY5NDMxZnJlc3RyaWN0SW5kaWNlcz0lNUIlMjJXYWFTUHVibGljQ29tcGFueUpvYiUyMiU1RCZ0YWdGaWx0ZXJzPSU1QiUyMiUyMiU1RCZhbmFseXRpY3NUYWdzPSU1QiUyMnljZGMlMjIlNUQ%3D', 'POST', { query: 'design engineer', hitsPerPage: 5 }, d => d?.nbHits],
  ['Agg Dribbble jobs (json?)', 'https://dribbble.com/jobs.json', 'GET', null, d => Array.isArray(d) ? d.length : null],
  ['Agg Reddit r/UXjobs (json)', 'https://www.reddit.com/r/UXDesign/search.json?q=hiring&restrict_sr=1&sort=new&limit=5', 'GET', null, d => d?.data?.children?.length],
  ['Agg LinkedIn guest (ToS-questionable)', 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=design%20engineer&location=United%20States&f_WT=2&start=0', 'GET', null, (d, t) => (t?.match(/base-card/g) || []).length || null],
];
for (const [name, url, method, body, pick, extraH] of T) {
  try {
    const r = await fetch(url, { method, headers: { ...J, ...(body ? { 'content-type': 'application/json' } : {}), ...(extraH || {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let d = null; try { d = JSON.parse(text); } catch { /* not json */ }
    const n = pick(d, text);
    console.log(`${n != null && n !== 0 ? '✓' : r.ok ? '~' : 'x'} ${name.padEnd(42)} HTTP ${r.status}  count=${n ?? 'n/a'}  ${d ? 'json' : text.slice(0, 40).replace(/\s+/g, ' ')}`);
  } catch (e) { console.log(`x ${name.padEnd(42)} ${e.name === 'TimeoutError' ? 'timeout' : e.message}`); }
}
