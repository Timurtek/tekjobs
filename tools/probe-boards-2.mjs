// Second candidate batch, 2026-09-21: design-engineering-relevant companies not yet in the watchlist.
// Prints watchlist rows for the boards that answer; misses go to stderr.
const C = {
  Palantir: ['palantir'], Confluent: ['confluent'], Fastly: ['fastly'], Pendo: ['pendo'], FullStory: ['fullstory'], Cloudinary: ['cloudinary'], Unity: ['unity'], Kickstarter: ['kickstarter'],
  StockX: ['stockx'], GOAT: ['goat', 'goatgroup'], Redfin: ['redfin'], Compass: ['compass', 'urbancompass'], Hopper: ['hopper'], Rivian: ['rivian'], Waymo: ['waymo'], Aurora: ['aurora', 'aurorainnovation'], Zoox: ['zoox'],
  'Shield AI': ['shieldai', 'shield-ai'], Airbyte: ['airbyte'], Metabase: ['metabase'], Chronosphere: ['chronosphere'], PagerDuty: ['pagerduty'], 'incident.io': ['incident-io', 'incidentio'], LogRocket: ['logrocket'],
  Statsig: ['statsig'], Split: ['split'], Drata: ['drata'], Secureframe: ['secureframe'], Hasura: ['hasura'], DigitalOcean: ['digitalocean'], Shortwave: ['shortwave'], Gather: ['gather', 'gathertown'],
  'Luma (events)': ['luma', 'lumahq'], Partiful: ['partiful'], Eventbrite: ['eventbrite'], Motion: ['usemotion', 'motion'], Attentive: ['attentive', 'attentivemobile'], Iterable: ['iterable'], 'Customer.io': ['customerio', 'customer-io'],
  GoDaddy: ['godaddy'], ClickUp: ['clickup'], AngelList: ['angellist'], 'Gemini (exchange)': ['gemini'], Kraken: ['kraken', 'krakenfx'], Wealthsimple: ['wealthsimple'], Betterment: ['betterment'],
  Mural: ['mural'], Whimsical: ['whimsical'], Pitch: ['pitch'], Tome: ['tome'], 'Beautiful.ai': ['beautifulai'], Canva: ['canva'],
  Framer: ['framer', 'framerjs'], Wix: ['wix'], Typeform: ['typeform'], Tally: ['tally', 'tallyforms'], Fillout: ['fillout'], Jotform: ['jotform'],
  Docusign: ['docusign'], PandaDoc: ['pandadoc'], Box: ['box'], Egnyte: ['egnyte'], Coda: ['coda', 'codaio'], Slite: ['slite'], Almanac: ['almanac'],
  Height: ['height'], Shortcut: ['shortcut', 'clubhouse'], Basecamp: ['basecamp', '37signals'], Doist: ['doist'], Superlist: ['superlist'],
  Grammarly: ['grammarly'], Otter: ['otter'], Fireflies: ['fireflies', 'firefliesai'], Gong: ['gong', 'gongio'], Clari: ['clari'], Outreach: ['outreach'], 'Apollo.io': ['apolloio', 'apollo-io'],
  Socure: ['socure'], Unit21: ['unit21'], Middesk: ['middesk'], Finch: ['finch', 'tryfinch'], Merge: ['merge', 'mergeapi'], Codat: ['codat'], Rutter: ['rutter'], Pinwheel: ['pinwheel'], Argyle: ['argyle'], Atomic: ['atomic', 'atomicfi'], Truework: ['truework'], Certn: ['certn'],
  'Culture Amp': ['cultureamp'], '15Five': ['15five'], Leapsome: ['leapsome'], Pave: ['pave'], Ledgy: ['ledgy'],
  Sketch: ['sketch', 'sketchapp'], Zeplin: ['zeplin'], Supernova: ['supernova', 'supernovaio'], Knapsack: ['knapsack'], zeroheight: ['zeroheight'],
  Postmark: ['postmark'], Mailgun: ['mailgun'], Loops: ['loops'], ToolJet: ['tooljet'], Superblocks: ['superblocks'], Internal: ['internal'], Basedash: ['basedash'],
  'Stability AI': ['stabilityai', 'stability-ai', 'stability'], 'Black Forest Labs': ['blackforestlabs', 'bfl'], Leonardo: ['leonardoai', 'leonardo-ai'], HeyGen: ['heygen'], Speechmatics: ['speechmatics'],
  Replika: ['replika', 'luka'], Inworld: ['inworld', 'inworldai'], Sesame: ['sesame', 'sesameai'], Hume: ['hume', 'humeai'], 'Wispr Flow': ['wispr', 'wisprflow'], Superwhisper: ['superwhisper'], Amie: ['amie'], Reflect: ['reflect', 'reflectapp'], Mem: ['mem', 'memlabs'],
  'You.com': ['youcom', 'you'], 'Reflection AI': ['reflectionai', 'reflection'], Magic: ['magic', 'magicdev'],
  // Same company, a different platform than the one on file (the row is only added if the name is not already in the table).
  'Figma (ashby)': ['figma'], 'Vercel (ashby)': ['vercel'], 'Netlify (ashby)': ['netlify'], 'Cloudflare (ashby)': ['cloudflare'], 'Retool (gh)': ['retool'], 'Appsmith (gh)': ['appsmith'], 'Loom (gh)': ['loom'], 'Notion (gh)': ['notion'], 'Linear (gh)': ['linear'], 'Miro (gh)': ['miro'], 'Webflow (ashby)': ['webflow'], 'Squarespace (ashby)': ['squarespace'], 'Carta (ashby)': ['carta'], 'Plaid (gh)': ['plaid'], 'Lattice (ashby)': ['lattice'], 'Checkr (ashby)': ['checkr'], 'Persona (gh)': ['persona'], 'Alloy (ashby)': ['alloy'], 'Sardine (gh)': ['sardine'],
};
const UA = { 'user-agent': 'TekJobs/1.0 probe (+https://github.com/Timurtek/tekjobs)' };
async function probe(ats, slug) {
  try {
    const url = ats === 'greenhouse' ? `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs` : ats === 'lever' ? `https://api.lever.co/v0/postings/${slug}?mode=json&limit=1` : `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    const d = await r.json().catch(() => null);
    if (ats === 'greenhouse') return Array.isArray(d?.jobs) ? d.jobs.length : null;
    if (ats === 'lever') return Array.isArray(d) ? (d.length ? 1 : 0) : null;
    return Array.isArray(d?.jobs) ? d.jobs.length : null;
  } catch { return null; }
}
const entries = Object.entries(C); const rows = []; const misses = []; let i = 0;
await Promise.all(Array.from({ length: 10 }, async () => {
  while (i < entries.length) {
    const [name, slugs] = entries[i++]; let found = null;
    for (const s of slugs) { for (const ats of ['greenhouse', 'lever', 'ashby']) { const n = await probe(ats, s); if (n !== null && n >= 1) { found = { ats, slug: s, n }; break; } } if (found) break; }
    if (found) rows.push({ name: name.replace(/ \((gh|ashby|lever|events|exchange)\)$/, ''), ...found }); else misses.push(name);
  }
}));
rows.sort((a, b) => a.name.localeCompare(b.name));
for (const r of rows) console.log(`| ${r.name} | ${r.ats} | ${r.slug} | B | | ${r.n} postings at probe 2026-09-21 |`);
console.error(`hits ${rows.length} / misses ${misses.length}: ${misses.join(', ')}`);
