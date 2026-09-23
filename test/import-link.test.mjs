// A pasted link goes through: strip tracking, decide which reader, read structured data. The network parts
// are not tested here; the decisions and parsers are, because they are where a wrong guess writes a wrong note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanUrl, classify, jobPostingFromJsonLd, jobFromJsonLd, linkedInApplyUrl, pageTitle, siteName } from '../scraper/import-link.mjs';
import { parseGoogleJobPage } from '../scraper/sources-sites.mjs';

test('classify: Google and Apple job pages get their own readers', () => {
  assert.deepEqual(classify('https://www.google.com/about/careers/applications/jobs/results/87805489504494278-senior-ux-engineer'), { kind: 'google', id: '87805489504494278' });
  assert.deepEqual(classify('https://jobs.apple.com/en-us/details/200680033/product-designer-design-systems'), { kind: 'apple', id: '200680033' });
});

test('a plain page: the h1 unless it is a label, the site name from og or the domain', () => {
  const html = '<html><head><title>Senior UX Engineer, Knowledge Engine — Acme Careers</title><meta property="og:site_name" content="Acme Careers"></head><body><h1>Job details</h1></body></html>';
  assert.equal(pageTitle(html), 'Senior UX Engineer, Knowledge Engine');
  assert.equal(siteName(html, 'https://careers.acme.com/x'), 'Acme');
  assert.equal(pageTitle('<h1>Design Engineer</h1><title>Careers | Beta</title>'), 'Design Engineer');
  assert.equal(siteName('<html></html>', 'https://www.google.com/about/careers/x'), 'Google');
  assert.equal(siteName('<html></html>', 'https://jobs.example.co.uk/x'), 'Example');
});

test('a Google job page parses to a job: title from the tab title, employer and place from the icons', () => {
  const html = '<html><head><title>Senior UX Engineer, AI Systems — Google Careers</title></head><body><h2>job details</h2><span>corporate_fare</span><span>Google</span><span>place</span><span>Mountain View, CA, USA</span><span>; </span><span>Seattle, WA, USA</span><span>bar_chart</span><span>Advanced</span><h3>Minimum qualifications</h3><p>Bachelor\'s degree.</p><h3>About the job</h3><p>Prototype it.</p><p>Google is proud to be an equal opportunity workplace.</p></body></html>';
  const j = parseGoogleJobPage(html, 'https://www.google.com/about/careers/applications/jobs/results/87805489504494278-senior-ux-engineer');
  assert.equal(j.title, 'Senior UX Engineer, AI Systems');
  assert.equal(j.company, 'Google');
  assert.equal(j.id, 'goog:87805489504494278');
  assert.match(j.location, /Mountain View/);
  assert.match(j.location, /Seattle/);
  assert.equal(j.department, 'Level: Advanced');
  assert.match(j.descriptionHtml, /Prototype it/);
  assert.doesNotMatch(j.descriptionHtml, /equal opportunity/);
});

test('cleanUrl strips tracking and keeps the parts that identify the posting', () => {
  assert.equal(cleanUrl('https://jobs.ashbyhq.com/elevenlabs/5494be31?utm_source=linkedin&ref=x&gh_src=abc#top'), 'https://jobs.ashbyhq.com/elevenlabs/5494be31');
  assert.equal(cleanUrl('https://example.com/careers?gh_jid=123&utm_campaign=y'), 'https://example.com/careers?gh_jid=123');
  assert.throws(() => cleanUrl('ftp://x'), /http/);
});

test('classify: each board by its URL shape, LinkedIn by job id, Indeed refused', () => {
  assert.deepEqual(classify('https://boards.greenhouse.io/vercel/jobs/7123456'), { kind: 'greenhouse', slug: 'vercel', id: '7123456' });
  assert.deepEqual(classify('https://job-boards.greenhouse.io/figma/jobs/5555'), { kind: 'greenhouse', slug: 'figma', id: '5555' });
  assert.deepEqual(classify('https://www.example.com/careers/?gh_jid=42'), { kind: 'greenhouse', slug: '', id: '42' });
  assert.deepEqual(classify('https://jobs.lever.co/acme/0b1c2d3e-1111-2222-3333-444455556666/apply'), { kind: 'lever', slug: 'acme', id: '0b1c2d3e-1111-2222-3333-444455556666' });
  assert.deepEqual(classify('https://jobs.ashbyhq.com/linear/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), { kind: 'ashby', slug: 'linear', id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
  assert.deepEqual(classify('https://ternion.security/careers?ashby_jid=71c804a4-b005-4778-8f9e-16f5905781f0'), { kind: 'ashby', slug: '', id: '71c804a4-b005-4778-8f9e-16f5905781f0' }, 'a careers page embedding Ashby; the board is read off the page');
  assert.deepEqual(classify('https://www.linkedin.com/jobs/view/4290001234/'), { kind: 'linkedin', id: '4290001234' });
  assert.deepEqual(classify('https://www.linkedin.com/jobs/view/design-engineer-at-acme-4290001234'), { kind: 'linkedin', id: '4290001234' });
  assert.deepEqual(classify('https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4290009999'), { kind: 'linkedin', id: '4290009999' });
  assert.equal(classify('https://www.linkedin.com/jobs/').kind, 'unsupported');
  assert.equal(classify('https://www.indeed.com/viewjob?jk=abc').kind, 'unsupported');
  assert.deepEqual(classify('https://careers.example.com/job/123'), { kind: 'page' });
});

test('a JobPosting in JSON-LD becomes a job: company, locations, salary, remote, dates', () => {
  const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Design Engineer","description":"<p>Build it.</p>","datePosted":"2026-09-15","employmentType":"FULL_TIME","hiringOrganization":{"@type":"Organization","name":"Acme"},"jobLocation":[{"@type":"Place","address":{"addressLocality":"Seattle","addressRegion":"WA","addressCountry":"US"}}],"jobLocationType":"TELECOMMUTE","baseSalary":{"@type":"MonetaryAmount","currency":"USD","value":{"@type":"QuantitativeValue","minValue":200000,"maxValue":260000,"unitText":"YEAR"}},"identifier":{"@type":"PropertyValue","name":"Acme","value":"req-77"}}</script></html>`;
  const p = jobPostingFromJsonLd(html);
  assert.equal(p.title, 'Design Engineer');
  const j = jobFromJsonLd(p, 'https://careers.acme.com/j/77');
  assert.equal(j.company, 'Acme');
  assert.equal(j.location, 'Seattle, WA, US');
  assert.equal(j.remote, true);
  assert.equal(j.salary, '$200k–$260k');
  assert.equal(j.posted.slice(0, 10), '2026-09-15');
  assert.equal(j.employmentType, 'FULL_TIME');
  assert.equal(j.id, 'link:req-77');
});

test('JSON-LD inside @graph and with an entity-encoded script type is still found; a page without one gives null', () => {
  const html = '<script type="application/ld&#x2B;json">{"@graph":[{"@type":"WebSite"},{"@type":"JobPosting","title":"UX Engineer","hiringOrganization":{"name":"Beta"}}]}</script>';
  assert.equal(jobPostingFromJsonLd(html).title, 'UX Engineer');
  assert.equal(jobPostingFromJsonLd('<html><p>no data</p></html>'), null);
});

test('the LinkedIn apply link is read out of its comment and unwrapped from the redirect', () => {
  const wrapped = '<code id="applyUrl" style="display: none"><!--"https://www.linkedin.com/job-apply/123?url=https%3A%2F%2Fjobs.lever.co%2Facme%2Fabc&amp;trk=x"--></code>';
  assert.equal(linkedInApplyUrl(wrapped), 'https://jobs.lever.co/acme/abc');
  const direct = '<code id="applyUrl"><!--"https://boards.greenhouse.io/acme/jobs/1"--></code>';
  assert.equal(linkedInApplyUrl(direct), 'https://boards.greenhouse.io/acme/jobs/1');
  assert.equal(linkedInApplyUrl('<div>nothing</div>'), '');
});
