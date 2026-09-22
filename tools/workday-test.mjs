// Test Workday CXS endpoints for large companies. Prints which tenants respond and a few design-eng hits.
const TENANTS = [
  { name: 'Adobe', host: 'adobe.wd5.myworkdayjobs.com', tenant: 'adobe', site: 'external_experienced' },
  { name: 'Salesforce', host: 'salesforce.wd12.myworkdayjobs.com', tenant: 'salesforce', site: 'External_Career_Site' },
  { name: 'Nvidia', host: 'nvidia.wd5.myworkdayjobs.com', tenant: 'nvidia', site: 'NVIDIAExternalCareerSite' },
  { name: 'Autodesk', host: 'autodesk.wd1.myworkdayjobs.com', tenant: 'autodesk', site: 'Ext' },
  { name: 'Intuit', host: 'intuit.wd1.myworkdayjobs.com', tenant: 'intuit', site: 'Intuit_Careers' },
  { name: 'Workday', host: 'workday.wd5.myworkdayjobs.com', tenant: 'workday', site: 'Workday' },
  { name: 'Atlassian', host: 'atlassian.wd3.myworkdayjobs.com', tenant: 'atlassian', site: 'Atlassian' },
  { name: 'Netflix', host: 'netflix.wd1.myworkdayjobs.com', tenant: 'netflix', site: 'Netflix' },
  { name: 'PayPal', host: 'paypal.wd1.myworkdayjobs.com', tenant: 'paypal', site: 'jobs' },
  { name: 'Splunk', host: 'splunk.wd1.myworkdayjobs.com', tenant: 'splunk', site: 'Splunk_Careers' },
  { name: 'ServiceNow', host: 'servicenow.wd1.myworkdayjobs.com', tenant: 'servicenow', site: 'ServiceNow_External' },
  { name: 'VMware/Broadcom', host: 'broadcom.wd1.myworkdayjobs.com', tenant: 'broadcom', site: 'External_Career' },
  { name: 'Snap', host: 'snap.wd1.myworkdayjobs.com', tenant: 'snap', site: 'Snap' },
  { name: 'Warner Bros. Discovery', host: 'warnerbros.wd5.myworkdayjobs.com', tenant: 'warnerbros', site: 'global' },
  { name: 'Disney', host: 'disney.wd5.myworkdayjobs.com', tenant: 'disney', site: 'disneycareer' },
  { name: 'Target', host: 'target.wd5.myworkdayjobs.com', tenant: 'target', site: 'targetcareers' },
  { name: 'Capital One', host: 'capitalone.wd12.myworkdayjobs.com', tenant: 'capitalone', site: 'Capital_One' },
  { name: 'Slack', host: 'salesforce.wd12.myworkdayjobs.com', tenant: 'salesforce', site: 'Slack' },
];
const H = { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'TekJobs/1.0 (+https://github.com/Timurtek/tekjobs)' };
for (const t of TENANTS) {
  const url = `https://${t.host}/wday/cxs/${t.tenant}/${t.site}/jobs`;
  try {
    const r = await fetch(url, { method: 'POST', headers: H, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: 'design engineer' }), signal: AbortSignal.timeout(20000) });
    const d = await r.json().catch(() => null);
    if (!d || !Array.isArray(d.jobPostings)) { console.log(`x ${t.name.padEnd(24)} HTTP ${r.status}`); continue; }
    const hits = d.jobPostings.filter((j) => /design (engineer|technologist|system)|ux engineer|front.?end|prototyp/i.test(j.title));
    console.log(`✓ ${t.name.padEnd(24)} total for query: ${d.total}  relevant on p1: ${hits.length}  ${hits.slice(0, 3).map((h) => `"${h.title}" @ ${h.locationsText}`).join(' | ')}`);
    if (hits[0]) {
      const det = await fetch(`https://${t.host}/wday/cxs/${t.tenant}/${t.site}${hits[0].externalPath}`, { headers: H, signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => null);
      const info = det?.jobPostingInfo;
      if (info) console.log(`     detail ok: posted ${info.startDate || info.postedOn} · remote=${info.remoteType || 'n/a'} · desc ${String(info.jobDescription || '').length} chars · url ${info.externalUrl || ''}`);
    }
  } catch (e) { console.log(`x ${t.name.padEnd(24)} ${e.name === 'TimeoutError' ? 'timeout' : e.message}`); }
}
