// The page-scraping sources (Google, Apple, Wellfound, Built In) have no API contract to lean on, so the
// parsers are pinned against small copies of what each page looked like when the source was added. When one
// of these breaks, the page changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoogleCards, parseGoogleDetail, parseAppleHydration, appleDescription, parseWellfoundPage, parseBuiltInCards, parseBuiltInDetail, relativeDate } from '../scraper/sources-sites.mjs';

test('google: a results card yields id, title, employer, locations, level, remote flag and qualifications', () => {
  const html = `<ul><li class="lLd3Je"><div><h3 class="QJPWVe">Senior UX Engineer, Search Ads</h3>
    <i class="google-material-icons">corporate_fare</i><span>Google</span>
    <i class="google-material-icons">place</i><span>New York, NY, USA</span><span>; </span><span>Seattle, WA, USA</span>
    <i class="google-material-icons">bar_chart</i><span>Advanced</span><span>Remote eligible</span>
    <h4>Minimum qualifications</h4><ul><li>Bachelor&#39;s degree or equivalent practical experience.</li><li>8 years of experience with JavaScript.</li></ul>
    <a href="jobs/results/119474956995044038-senior-ux-engineer-search-ads?q=x" aria-label="Learn more about Senior UX Engineer, Search Ads"></a></div></li>
    <li class="lLd3Je"><a href="jobs/results/104497002653328070-package-design-engineer" aria-label="Learn more about Package Design Engineer"></a><i class="google-material-icons">place</i><span>Sunnyvale, CA, USA</span></li></ul>`;
  const cards = parseGoogleCards(html);
  assert.equal(cards.length, 2);
  const [a, b] = cards;
  assert.equal(a.id, '119474956995044038');
  assert.equal(a.slug, 'senior-ux-engineer-search-ads');
  assert.equal(a.title, 'Senior UX Engineer, Search Ads');
  assert.equal(a.company, 'Google');
  assert.equal(a.location, 'New York, NY, USA; Seattle, WA, USA');
  assert.equal(a.level, 'Advanced');
  assert.equal(a.remote, true);
  assert.deepEqual(a.qualifications, ["Bachelor's degree or equivalent practical experience.", '8 years of experience with JavaScript.']);
  assert.equal(b.title, 'Package Design Engineer');
  assert.equal(b.company, 'Google', 'no employer on the card means Google');
  assert.equal(b.remote, false);
  assert.deepEqual(b.qualifications, []);
});

test('google: the detail page is cut from the qualifications to the equal-opportunity footer', () => {
  const html = '<div>Back to jobs search</div><h2>Title</h2><h3>Minimum qualifications:</h3><p>A degree.</p><h3>About the job</h3><p>The US base salary range for this full-time position is $180,000-$260,000.</p><h3>Responsibilities</h3><p>Ship.</p><p>Google is proud to be an equal opportunity workplace.</p><p>Information collected and processed as part of your application.</p>';
  const out = parseGoogleDetail(html);
  assert.match(out, /About the job/);
  assert.match(out, /\$180,000-\$260,000/);
  assert.match(out, /Ship\./);
  assert.doesNotMatch(out, /equal opportunity|Information collected|Back to jobs/);
});

test('apple: the hydration blob is a JSON string inside JSON.parse, and the description is assembled from its parts', () => {
  const data = { loaderData: { jobDetails: { jobsData: { jobSummary: 'Sum "quoted"', description: 'Desc', responsibilities: 'Resp', minimumQualifications: 'Min', preferredQualifications: 'Pref', postingFooters: [{ localizations: { en_US: [{ content: 'At Apple, base pay is one part of our total compensation package. The base pay range for this role is between $150,000 and $250,000.' }, { content: '<p>Apple is an equal opportunity employer.</p>' }] } }] } } } };
  const html = `<html><script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify(data))});</script></html>`;
  const h = parseAppleHydration(html);
  assert.equal(h.loaderData.jobDetails.jobsData.jobSummary, 'Sum "quoted"');
  const desc = appleDescription(h);
  for (const part of ['Sum', 'Desc', 'Resp', 'Min', 'Pref', '$150,000 and $250,000']) assert.match(desc, new RegExp(part.replace(/[$]/g, '\\$')));
  assert.doesNotMatch(desc, /equal opportunity/, 'boilerplate footers stay out; only the pay footer is kept');
  assert.equal(parseAppleHydration('<html>nothing</html>'), null);
  assert.equal(appleDescription(null), '');
});

test('wellfound: startups in the Apollo cache point at their listings', () => {
  const state = { props: { pageProps: { apolloState: { data: {
    'StartupResult:1': { __typename: 'StartupResult', id: '1', name: 'Infisical', highlightedJobListings: [{ __ref: 'JobListingSearchResult:10' }, { __ref: 'JobListingSearchResult:missing' }] },
    'JobListingSearchResult:10': { __typename: 'JobListingSearchResult', id: '10', slug: 'design-engineer-site', title: 'Design Engineer, Site', remote: true, locationNames: ['United States'], compensation: '$100k – $180k', liveStartAt: 1789805278, description: 'Para one.\n\nPara two.', jobType: 'full-time', primaryRoleTitle: 'Frontend' },
    'Badge:X': { __typename: 'Badge' },
  } } } } };
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script></html>`;
  const rows = parseWellfoundPage(html);
  assert.equal(rows.length, 1, 'a dangling ref is skipped');
  assert.equal(rows[0].startup.name, 'Infisical');
  assert.equal(rows[0].listing.title, 'Design Engineer, Site');
  assert.deepEqual(parseWellfoundPage('<html></html>'), []);
});

test('built in: a card yields company, title, path, posted, work mode, location, pay, level and snippet', () => {
  const html = `<div data-id="job-card" x-data="jobTracking"><a href="/company/vercel" target="_blank" data-id="company-title" class="x"><span>Vercel</span></a>
    <h2><a href="/job/design-engineer/11195385" target="_blank" data-id="job-card-title" data-alias="/job/design-engineer/11195385">Design Engineer</a></h2>
    <span class="fs-xs"><i class="fa-regular fa-clock"></i>6 Days Ago</span><span x-cloak>Saved </span><span>Easy Apply</span>
    <span><i class="fa-solid fa-house"></i>Remote or Hybrid</span><span>United States</span><span>208K-312K Annually</span><span>Entry level</span>
    <div>Own product design and frontend implementation for Vercel&#8217;s AI Gateway across the website, dashboard, CLI, and APIs. Translate complex AI infrastructure concepts into understandable, accessible, high-performance experiences.</div></div>
    <div data-id="job-card"><a href="/company/humana" data-id="company-title"><span>Humana</span></a><a href="/job/senior-ui-design-engineer/10881607" data-id="job-card-title">Senior UI Design Engineer</a><span>Yesterday</span><span>118K-160K Annually</span></div>`;
  const [v, h] = parseBuiltInCards(html);
  assert.equal(v.id, '11195385');
  assert.equal(v.path, '/job/design-engineer/11195385');
  assert.equal(v.company, 'Vercel');
  assert.equal(v.title, 'Design Engineer');
  assert.equal(v.posted, '6 Days Ago');
  assert.equal(v.mode, 'Remote or Hybrid');
  assert.equal(v.location, 'United States');
  assert.equal(v.salary, '208K-312K Annually');
  assert.equal(v.level, 'Entry level');
  assert.match(v.snippet, /^Own product design/);
  assert.equal(h.company, 'Humana');
  assert.equal(h.posted, 'Yesterday');
  assert.equal(h.mode, '');
  assert.equal(h.location, '');
});

test('built in: the detail page carries a JobPosting in an entity-encoded ld+json script, inside @graph', () => {
  const html = '<script type="application/ld&#x2B;json"> { "@context": "https://schema.org", "@graph": [{"@type":"Organization","name":"Vercel"},{"@type":"JobPosting","title":"Design Engineer","description":"<p>Full text</p>","datePosted":"2026-09-15","jobLocationType":"TELECOMMUTE"}]}</script>';
  const p = parseBuiltInDetail(html);
  assert.equal(p.title, 'Design Engineer');
  assert.equal(p.jobLocationType, 'TELECOMMUTE');
  assert.equal(parseBuiltInDetail('<script type="application/ld+json">not json</script>'), null);
});

test('relative dates: "N days ago", yesterday, hours, and nonsense', () => {
  const now = new Date('2026-09-21T12:00:00Z');
  assert.equal(relativeDate('6 Days Ago', now).slice(0, 10), '2026-09-15');
  assert.equal(relativeDate('Yesterday', now).slice(0, 10), '2026-09-20');
  assert.equal(relativeDate('2 Weeks Ago', now).slice(0, 10), '2026-09-07');
  assert.equal(relativeDate('3 Hours Ago', now), now.toISOString());
  assert.equal(relativeDate('1 Month Ago', now).slice(0, 10), '2026-08-21');
  assert.equal(relativeDate('', now), null);
  assert.equal(relativeDate('Easy Apply', now), null);
});
