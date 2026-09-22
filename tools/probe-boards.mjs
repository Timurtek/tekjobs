// Probe candidate company slugs against Greenhouse, Lever, and Ashby. Prints a markdown table of hits.
// Usage: node tools/probe-boards.mjs [--min N]   (min postings to count as a live board, default 1)
const args = process.argv.slice(2);
const MIN = Number(args[args.indexOf('--min') + 1] || 1);

// name -> slug candidates. Design-eng-relevant and pay-competitive companies not already in the vault table.
const CANDIDATES = {
  'Airtable': ['airtable'], 'Amplitude': ['amplitude'], 'Anduril': ['andurilindustries', 'anduril'], 'Anyscale': ['anyscale'],
  'Arize': ['arize', 'arizeai'], 'Ashby': ['ashby'], 'Atlan': ['atlan'], 'Benchling': ['benchling'], 'BetterUp': ['betterup'],
  'Bitwarden': ['bitwarden'], 'Brightwheel': ['brightwheel'], 'Calendly': ['calendly'], 'Carbon Health': ['carbonhealth'],
  'Cedar': ['cedar'], 'Census': ['census'], 'Chainguard': ['chainguard'], 'Checkr': ['checkr'], 'Chorus One': ['chorusone'],
  'Circle': ['circle'], 'ClickHouse': ['clickhouse'], 'Cockroach Labs': ['cockroachlabs'], 'Color': ['color'], 'Comet': ['comet'],
  'Common Room': ['commonroom'], 'Cribl': ['cribl'], 'CrowdStrike': ['crowdstrike'], 'Dagster': ['dagsterlabs', 'dagster'],
  'Dandy': ['dandy'], 'Dbt Labs': ['dbtlabsinc', 'dbtlabs'], 'Docker': ['docker'], 'Doximity': ['doximity'], 'Dremio': ['dremio'],
  'Eppo': ['eppo'], 'Ethos': ['ethoslife', 'ethos'], 'EvenUp': ['evenup', 'evenuplaw'], 'Fathom': ['fathom'], 'Fivetran': ['fivetran'],
  'Flexport': ['flexport'], 'Forethought': ['forethought'], 'Found': ['found'], 'Front': ['front'], 'GitLab': ['gitlab'],
  'GitHub': ['github'], 'Gong': ['gong'], 'Grow Therapy': ['growtherapy'], 'Headway': ['headway'], 'Hex': ['hex', 'hextechnologies'],
  'Hightouch': ['hightouch'], 'Honeycomb': ['honeycomb'], 'Included Health': ['includedhealth'], 'Instabase': ['instabase'],
  'Ironclad': ['ironclad'], 'Jasper': ['jasper', 'jasperai'], 'Kong': ['kong'], 'Lambda': ['lambda', 'lambdalabs'], 'Lightdash': ['lightdash'],
  'Loom': ['loom'], 'Maven': ['maven', 'mavenclinic'], 'Mem': ['mem'], 'Metronome': ['metronome'], 'Motive': ['motive', 'gomotive'],
  'Navan': ['navan', 'tripactions'], 'Nuro': ['nuro'], 'Observe': ['observeinc', 'observe'], 'Omni': ['omni'], 'One Medical': ['onemedical'],
  'Opendoor': ['opendoor'], 'Orum': ['orum'], 'Outschool': ['outschool'], 'Pave': ['pave'], 'Persona': ['persona', 'withpersona'],
  'Pilot': ['pilot', 'pilotcom'], 'Podium': ['podium'], 'Pulley': ['pulley'], 'Quora': ['quora'], 'Recharge': ['recharge'],
  'Redpanda': ['redpanda', 'redpandadata'], 'Retool': ['retool'], 'Rewind': ['rewind'], 'Rubrik': ['rubrik'], 'Samsara': ['samsara'],
  'Scribe': ['scribe'], 'Sigma Computing': ['sigmacomputing'], 'Skydio': ['skydio'], 'Snorkel': ['snorkelai'], 'Sprig': ['sprig'],
  'Starburst': ['starburstdata', 'starburst'], 'Stord': ['stord'], 'Stytch': ['stytch'], 'Synthesia': ['synthesia'], 'Tecton': ['tecton'],
  'Thumbtack': ['thumbtack'], 'Tinybird': ['tinybird'], 'Turo': ['turo'], 'Upstart': ['upstart'], 'Verkada': ['verkada'], 'Vimeo': ['vimeo'],
  'Wealthfront': ['wealthfront'], 'Whatnot': ['whatnot'], 'Wiz': ['wiz'], 'Zscaler': ['zscaler'], 'Zocdoc': ['zocdoc'],
  // design-tool and creative-tool companies
  'Adobe Firefly (Frame.io)': ['frameio'], 'Canva': ['canva'], 'Cavalry': ['cavalry'], 'Descript': ['descript'], 'Fable': ['fable'],
  'Figma (ashby)': ['figma'], 'Framer': ['framer'], 'Jitter': ['jitter'], 'Kittl': ['kittl'], 'Lottie (LottieFiles)': ['lottiefiles'],
  'Maze': ['maze', 'mazedesign'], 'Mobbin': ['mobbin'], 'Modyfi': ['modyfi'], 'Origami': ['origami'], 'Play': ['playhq', 'createwithplay'],
  'Rive': ['rive'], 'Spline': ['spline'], 'Supernova': ['supernova', 'supernovaio'], 'Tldraw': ['tldraw'], 'Whimsical': ['whimsical'],
  'Zeroheight': ['zeroheight'], 'Knapsack': ['knapsack'], 'Storybook': ['storybook'], 'Chroma': ['chroma'], 'Pencil': ['pencil'],
  // AI-native product companies
  'Adept': ['adept'], 'AI21': ['ai21'], 'Aleph Alpha': ['aleph-alpha'], 'Anon': ['anon'], 'Arcade': ['arcade', 'arcadeai'],
  'Assembled': ['assembled'], 'Brainbase': ['brainbase'], 'Cartesia': ['cartesia'], 'Chalk': ['chalk'], 'Coframe': ['coframe'],
  'Contextual AI': ['contextualai', 'contextual'], 'Copy.ai': ['copyai'], 'Crusoe': ['crusoe'], 'Dust': ['dust'], 'E2B': ['e2b'],
  'Elicit': ['elicit'], 'Exa': ['exa', 'exa-ai'], 'Fixie': ['fixie'], 'Flatfile': ['flatfile'], 'Galileo AI': ['galileo-ai'],
  'Glean (ashby)': ['glean'], 'Hebbia': ['hebbia'], 'Humanloop': ['humanloop'], 'Inngest': ['inngest'], 'Jam': ['jam'],
  'Kapa': ['kapa', 'kapa-ai'], 'Klarity': ['klarity'], 'Latent Space': ['latentspace'], 'Lindy': ['lindy'], 'Luma AI': ['lumaai', 'luma-ai'],
  'Magic': ['magic'], 'Mem0': ['mem0'], 'Meter': ['meter'], 'Moonhub': ['moonhub'], 'Numeric': ['numeric'], 'Oleve': ['oleve'],
  'Otter': ['otter', 'otterai'], 'Parloa': ['parloa'], 'Pylon': ['pylon'], 'Relevance AI': ['relevanceai'], 'Rewind (Limitless)': ['limitless'],
  'Rossum': ['rossum'], 'Sana': ['sana', 'sanalabs'], 'Sema4': ['sema4ai', 'sema4'], 'Sourcegraph (ashby)': ['sourcegraph'],
  'Stack AI': ['stackai', 'stack-ai'], 'Tavus': ['tavus'], 'Tennr': ['tennr'], 'Toma': ['toma'], 'Unify': ['unify'], 'Vellum': ['vellum', 'vellumai'],
  'Vercept': ['vercept'], 'Wispr': ['wispr', 'wisprflow'], 'Wordware': ['wordware'], 'Zep': ['zep'], 'Zencoder': ['zencoder'],
  // developer-tool companies with strong design engineering
  'Appwrite': ['appwrite'], 'Arcjet': ['arcjet'], 'Astro': ['astro'], 'Axiom': ['axiom', 'axiomhq'], 'Bun': ['bun', 'oven'],
  'Cal.com (ashby)': ['calcom'], 'Coder': ['coder'], 'CodeSandbox': ['codesandbox'], 'Courier': ['courier'], 'Depot': ['depot'],
  'Deno': ['deno', 'denoland'], 'Doppler': ['doppler'], 'Dub (ashby)': ['dubinc', 'dub-co'], 'Fern': ['fern', 'buildwithfern'],
  'Fly.io': ['fly', 'flyio'], 'Grafbase': ['grafbase'], 'Hashnode': ['hashnode'], 'Knock': ['knock'], 'Liveblocks': ['liveblocks'],
  'Mux': ['mux'], 'Northflank': ['northflank'], 'Novu': ['novu'], 'Nx (Nrwl)': ['nrwl', 'nx'], 'Pierre': ['pierre'], 'PlanetScale': ['planetscale'],
  'Prisma (ashby)': ['prisma'], 'Replicate': ['replicate'], 'Retool (ashby)': ['retool'], 'Runpod': ['runpod'], 'Sanity (gh)': ['sanity'],
  'Sourcegraph (lever)': ['sourcegraph'], 'Speakeasy': ['speakeasy', 'speakeasyapi'], 'Stainless (ashby)': ['stainlessapi'],
  'Tigris': ['tigrisdata'], 'Trigger.dev': ['triggerdotdev', 'trigger'], 'Turborepo/Vercel': ['vercel'], 'Turso': ['turso'],
  'Upstash': ['upstash'], 'Val Town': ['valtown', 'val-town'], 'Warp (gh)': ['warp'], 'Xata': ['xata'], 'Zapier (gh)': ['zapier'],
  // fintech / consumer with high pay bands
  'Alloy': ['alloy'], 'Anchorage': ['anchorage', 'anchoragedigital'], 'Bilt': ['bilt', 'biltrewards'], 'Cash App': ['cashapp'],
  'Column': ['column'], 'Copper': ['copper'], 'Current': ['current'], 'Dave': ['dave'], 'Empower': ['empower'], 'Fireblocks': ['fireblocks'],
  'Kraken': ['kraken'], 'Lithic': ['lithic'], 'Marqeta': ['marqeta'], 'Melio': ['melio'], 'Moov': ['moov'], 'Nala': ['nala'],
  'OpenSea': ['opensea'], 'Payoneer': ['payoneer'], 'Public': ['public', 'publiccom'], 'Rho': ['rho'], 'Sardine': ['sardine'],
  'SoFi': ['sofi'], 'Stash': ['stash'], 'Step': ['step'], 'Tally': ['tally'], 'Unit': ['unit'], 'Vanta (gh)': ['vanta'], 'Zip': ['zip', 'ziphq'],
  // media / consumer
  'Airbnb (lever)': ['airbnb'], 'Bumble': ['bumble'], 'Cameo': ['cameo'], 'Discord (lever)': ['discord'], 'Etsy': ['etsy'], 'Fandom': ['fandom'],
  'Grindr': ['grindr'], 'Hinge': ['hinge'], 'Match': ['match', 'matchgroup'], 'Medium': ['medium'], 'NBCUniversal': ['nbcuniversal'],
  'Peloton': ['peloton'], 'Pocket FM': ['pocketfm'], 'Quizlet': ['quizlet'], 'Rec Room': ['recroom'], 'Sonos': ['sonos'], 'Tinder': ['tinder'],
  'Tubi': ['tubi'], 'Udemy': ['udemy'], 'Vox Media': ['voxmedia'], 'Warner Bros. Discovery': ['wbd'], 'Yelp': ['yelp'],
  // health
  'Abridge': ['abridge'], 'Ambience': ['ambiencehealthcare', 'ambience'], 'Cityblock': ['cityblock'], 'Commure': ['commure'], 'Devoted': ['devoted', 'devotedhealth'],
  'Function Health': ['functionhealth'], 'Hims & Hers': ['himshers', 'hims'], 'Nourish': ['nourish'], 'Oscar': ['oscar', 'oscarhealth'],
  'Ro': ['ro'], 'Rula': ['rula'], 'Spring Health': ['springhealth'], 'Tempus': ['tempus'], 'Zus': ['zus', 'zushealth'],
};

const UA = { 'user-agent': 'TekJobs/1.0 probe (+https://github.com/Timurtek/tekjobs)' };
async function probe(ats, slug) {
  try {
    const url = ats === 'greenhouse' ? `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`
      : ats === 'lever' ? `https://api.lever.co/v0/postings/${slug}?mode=json&limit=1`
      : `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    const d = await r.json().catch(() => null);
    if (ats === 'greenhouse') return Array.isArray(d?.jobs) ? d.jobs.length : null;
    if (ats === 'lever') return Array.isArray(d) ? (d.length ? 1 : 0) : null;
    return Array.isArray(d?.jobs) ? d.jobs.length : null;
  } catch { return null; }
}

const entries = Object.entries(CANDIDATES);
const rows = []; const misses = [];
let i = 0;
await Promise.all(Array.from({ length: 10 }, async () => {
  while (i < entries.length) {
    const [name, slugs] = entries[i++];
    let found = null;
    for (const s of slugs) {
      for (const ats of ['greenhouse', 'lever', 'ashby']) {
        const n = await probe(ats, s);
        if (n !== null && n >= MIN && !(ats === 'ashby' && n === 0)) { found = { ats, slug: s, n }; break; }
      }
      if (found) break;
    }
    if (found) rows.push({ name: name.replace(/ \((gh|ashby|lever)\)$/, ''), ...found }); else misses.push(name);
  }
}));
rows.sort((a, b) => a.name.localeCompare(b.name));
console.log('| Company | ATS | Slug | Tier | Status | Notes |\n|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.name} | ${r.ats} | ${r.slug} | B | | ${r.n} postings at probe |`);
console.error(`\nhits: ${rows.length}  misses: ${misses.length}\nmisses: ${misses.join(', ')}`);
