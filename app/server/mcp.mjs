#!/usr/bin/env node
// TekJobs MCP server (stdio, JSON-RPC 2.0). Lets Claude Code / Claude Desktop run the job search without the UI:
// search and read matches, move them through the pipeline, add notes, edit criteria, add boards, trigger a scan,
// and pull the materials needed to tailor an application. Hand-rolled: no SDK dependency.
import * as store from './store.mjs';
import * as letter from './cover-letter.mjs';
import * as tailored from './tailored-resume.mjs';
import * as mail from './mail-check.mjs';
import * as people from './people.mjs';

const TOOLS = [
  { name: 'list_snippets', description: 'The copy panel: the person\'s standard answers for application forms (name, email, phone, links, availability, salary answer, anything they added), grouped, from Profile/Snippets.md. Use these verbatim when drafting form answers; never invent a value that is empty here.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_people', description: 'The people in the search: recruiters, hiring managers, interviewers and referrals, one note each under People/, with role, company, email, last contact and the job notes they are on. Newest contact first.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_person', description: 'One person in full: the row plus their About text and dated Log of contacts.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'add_person', description: 'Add a person (or recognise one already there, by email or name and company) and optionally put them on a job note. role: recruiter | hiring-manager | interviewer | referral | other. Give jobId to attach; context is a few words on the thread.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string', enum: people.ROLES }, company: { type: 'string' }, email: { type: 'string' }, links: { type: 'string' }, about: { type: 'string' }, jobId: { type: 'string' }, context: { type: 'string' } }, required: ['name'] } },
  { name: 'attach_person', description: 'Put an existing person on a job note (a line under its People section) and the job on their Threads. Idempotent.', inputSchema: { type: 'object', properties: { jobId: { type: 'string' }, personId: { type: 'string' }, role: { type: 'string', enum: people.ROLES }, context: { type: 'string' } }, required: ['jobId', 'personId'] } },
  { name: 'log_contact', description: "Append a dated line to a person's Log (a call, a reply, a note to self) and move their last contact forward. Nothing is sent.", inputSchema: { type: 'object', properties: { personId: { type: 'string' }, text: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD, default today.' } }, required: ['personId', 'text'] } },
  { name: 'tailored_resume_materials', description: 'Everything needed to tailor the resume to one posting: the posting, the resume of record (the only source of facts), the binding rules and the exact Markdown structure to output. Tailoring means reorder, prune, tighten and re-summarise; never add a bullet, title, date or number. Write it from the returned prompt, then call save_tailored_resume. emphasis: auto | design-systems | ai-product.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, emphasis: { type: 'string' }, extra: { type: 'string' } }, required: ['id'] } },
  { name: 'save_tailored_resume', description: 'Save a tailored resume (Markdown in the required structure) into the job note. Returns warnings: bullets that do not trace to the resume of record, figures or date ranges or job headers that are not on it. Fix every warning and save again; a person will upload this. The print view is /api/jobs/<id>/resume.html on the local server.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'] } },
  { name: 'cover_letter_materials', description: 'Everything needed to write a cover letter for one job: the posting, the resume (the only source of facts), the profile, positioning, what the packet has already decided, and the binding rules. Write the letter yourself from the returned prompt, then call save_cover_letter. emphasis: auto | design-systems | ai-product. length: short | standard. extra: anything the person asked you to include.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, emphasis: { type: 'string' }, length: { type: 'string' }, extra: { type: 'string' } }, required: ['id'] } },
  { name: 'save_cover_letter', description: 'Save a cover letter into the job note (plain text, no markdown). Returns the word count and warnings: figures that are not on the resume, dashes, placeholders, stock phrases, a letter that never names the company. Fix what it flags and save again. Saving does not change the job status and nothing is sent.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'] } },
  { name: 'search_jobs', description: 'Search the open job matches in the vault. Returns compact rows sorted by score. Filters: q (text in company/title/location), status (new|reviewing|applying|applied|interviewing|offer|rejected|passed|all, or several comma-separated), band (floor|stretch|below|unknown|all), kind (design-eng|adjacent|all), location (comma-separated any-of, matched against the posting\'s location text), remote (true keeps only rows the scan marked remote), source (a note source such as ashby, greenhouse, wellfound, builtin, google, apple, or several comma-separated; "link" means every job the person added by pasting a link), company (one or several comma-separated), payMin / payMax (annual, judged on the top of the stated range), payKnown (true keeps only postings that state pay), postedDays / foundDays (posted or found within N days), minScore, maxScore, limit.', inputSchema: { type: 'object', properties: { q: { type: 'string' }, status: { type: 'string' }, band: { type: 'string' }, kind: { type: 'string' }, location: { type: 'string' }, remote: { type: 'boolean' }, source: { type: 'string' }, company: { type: 'string' }, payMin: { type: 'number' }, payMax: { type: 'number' }, payKnown: { type: 'boolean' }, postedDays: { type: 'number' }, foundDays: { type: 'number' }, maxScore: { type: 'number' }, minScore: { type: 'number' }, limit: { type: 'number' } } } },
  { name: 'get_job', description: 'Read one job note in full: frontmatter, why it matched, status log, notes, application section, and the job description text. id is the note name (from search_jobs).', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'today', description: "The short list that wants a decision today, rather than the whole inventory: the top unreviewed matches by fit, ones aging past the point where listings here start closing, ones that closed while still unreviewed, and anything in flight that is being prepared, due a follow-up, or interviewing. Scores are given as a 0-100 fit alongside the raw score. Start here.", inputSchema: { type: 'object', properties: { cap: { type: 'number', description: 'Rows per section, default 7.' } } } },
  { name: 'set_status', description: 'Move a job through the pipeline. Rewrites the note frontmatter and appends to its Status log. You can move a job as far as \"ready\", which means a packet is drafted and waiting on the person. You cannot set applied, interviewing or offer: those record things that happened outside this machine, and only the person they happened to can say so. When passing on a job, give a reason: it is what lets the criteria be argued with later from evidence rather than memory.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: store.STATUSES }, reason: { type: 'string', enum: store.PASS_REASONS, description: 'Why, when the status is passed or rejected.' } }, required: ['id', 'status'] } },
  { name: 'add_note', description: "Append a dated line under the job note's Notes section.", inputSchema: { type: 'object', properties: { id: { type: 'string' }, note: { type: 'string' } }, required: ['id', 'note'] } },
  { name: 'save_application_field', description: 'Fill one field of the application packet in a job note. Use after drafting. Call application_packet first to see the fields, what is already filled, and what is still required.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, field: { type: 'string', enum: store.APPLICATION_FIELDS.map((f) => f.field) }, value: { type: 'string' } }, required: ['id', 'field', 'value'] } },
  { name: 'application_packet', description: "The application packet for one job as structured data: every field, what is in it, which required ones are still missing, and whether it is ready for a person to approve. 'ready' means the required fields are filled, not that the application is good, and it is never permission to send anything.", inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'application_materials', description: 'Everything needed to tailor an application for one job: the job note plus the candidate profile, positioning note, and current resume draft from the vault. Read this, then draft; then save with save_application_field.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'summary', description: 'Pipeline counts by status, pay band and kind; last scan; current floor, stretch and score bar.', inputSchema: { type: 'object', properties: {} } },
  { name: 'run_scan', description: 'Start a scan of every board now (background). Poll scan_status. Pass dry=true to score without writing notes. Pass criteria=<preset name> to score this one run with a named criteria preset instead of the active Search Criteria (see list_criteria_presets).', inputSchema: { type: 'object', properties: { dry: { type: 'boolean' }, criteria: { type: 'string' } } } },
  { name: 'mail_check', description: 'Start a read-only pass over the person\'s mailbox for application updates (confirmations, rejections, interview invitations) through the local CLI\'s Gmail connector, with only the Gmail read tools allowed. Runs in the background for a few minutes; poll mail_items. days: how far back (default: since the last check, or 21 days the first time).', inputSchema: { type: 'object', properties: { days: { type: 'number' } } } },
  { name: 'mail_items', description: 'The application emails found so far, each matched to a job note (exact role, same company, or none) with what confirming it would do. Confirming is done by the person in the app; an agent can read these and tell them what is waiting.', inputSchema: { type: 'object', properties: {} } },
  { name: 'preview_criteria', description: 'What a proposed criteria JSON would do to the notes that exist, without saving or scanning: how many rise above or fall below the bar, who enters or leaves the top 20, the biggest movers. Covers title terms, recency and pay exactly; description, seniority and location rules need a scan.', inputSchema: { type: 'object', properties: { raw: { type: 'string' } }, required: ['raw'] } },
  { name: 'outcomes', description: 'What the search is producing: the funnel (found, reviewed, shortlisted, applied, interviewing, offer), response rate, median days from discovery to application, applications waiting without a response at 7/14/21 days with the oldest listed, and applied/response counts by source.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_criteria_presets', description: 'Named criteria sets under Targets/Criteria/: name, bar, pay floor, title count, and whether one is identical to the active Search Criteria.', inputSchema: { type: 'object', properties: {} } },
  { name: 'save_criteria_preset', description: 'Create or update a named criteria preset from a full criteria JSON string (same shape as get_criteria). Does not change the active criteria; use activate_criteria_preset for that, or run_scan with criteria=<name> for one run.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, raw: { type: 'string' } }, required: ['name', 'raw'] } },
  { name: 'activate_criteria_preset', description: 'Copy a named preset into Targets/Search Criteria.md so the daily scan and everything else use it.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'scan_status', description: 'Whether a scan is running, and its last output lines.', inputSchema: { type: 'object', properties: {} } },
  { name: 'scan_preview', description: 'The top of the last scan\'s ranking, dry or real, with score, pay band and the first reasons: what the criteria find, before or without notes. Use after a dry run_scan.', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: '1 to 50, default 15' } } } },
  { name: 'get_criteria', description: 'The scoring criteria JSON from Targets/Search Criteria.md.', inputSchema: { type: 'object', properties: {} } },
  { name: 'set_criteria', description: 'Replace the criteria JSON block. Pass the full JSON as a string; it is validated before writing.', inputSchema: { type: 'object', properties: { raw: { type: 'string' } }, required: ['raw'] } },
  { name: 'list_companies', description: 'The company watchlist rows (name, ats, slug, tier, status) with each board\'s health: state (failed, zero, stale, never, ok), last success, last attempt, last error.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_feeds', description: 'The aggregator feeds: whether each is on under the criteria\'s openSources, and how it did on the last scan.', inputSchema: { type: 'object', properties: {} } },
  { name: 'onboarding_status', description: 'What the onboarding still needs: profile folder, resume, profile note, criteria, first scan. Call this first in a new setup.', inputSchema: { type: 'object', properties: {} } },
  { name: 'onboarding_materials', description: 'Start the onboarding interview. Returns the resume text, the current profile note, the current criteria JSON, and the interview script to follow step by step. Follow the script; it ends with save_profile, set_criteria and a scan.', inputSchema: { type: 'object', properties: {} } },
  { name: 'save_profile', description: 'Write Profile/Profile.md in full (markdown with the standard headings). The previous version is kept beside it.', inputSchema: { type: 'object', properties: { markdown: { type: 'string' } }, required: ['markdown'] } },
  { name: 'fetch_link', description: 'Fetch a public page the user gave you (portfolio, GitHub, personal site) as plain text, to fold into the profile. http(s) only; never use it on LinkedIn profile pages.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'import_resume', description: 'Import a resume file from a local path (PDF, DOCX, Markdown, text): copies it into Profile/ and extracts its text for the interview.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'add_job', description: 'Add postings the person found themselves, from links (LinkedIn job pages, a company careers page, a Greenhouse/Lever/Ashby posting). Each link is read once, scored with the current criteria, and written as a job note unless the scan already has it or a note with the same company and title exists. A LinkedIn link is opened as a signed-out visitor; if it names the company\'s own apply page on a known board, that page is imported and the LinkedIn link is recorded as where it was seen. Returns one result per link. Up to 25 links.', inputSchema: { type: 'object', properties: { urls: { type: 'array', items: { type: 'string' } } }, required: ['urls'] } },
  { name: 'attach_posting', description: 'Attach the real posting to a note that was created without one (from an application email or a pasted link with thin data). Reads the posting through its board when the link is Greenhouse/Lever/Ashby (including company pages with ?gh_jid= or ?ashby_jid=), replaces the note\'s posting facts, score, reasons and description, and keeps the status, notes, packet and drafts. The note name does not change.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' } }, required: ['id', 'url'] } },
  { name: 'add_company', description: 'Append a board to the watchlist. ats is the platform (greenhouse, lever, ashby, workday, rippling, smartrecruiters, workable, bamboohr, breezy, personio, teamtailor, eightfold, atlassian, github, spotify, amazon); slug is the board token.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, ats: { type: 'string' }, slug: { type: 'string' }, tier: { type: 'string' }, notes: { type: 'string' } }, required: ['name', 'ats', 'slug'] } },
];

async function call(name, a = {}) {
  switch (name) {
    case 'onboarding_status': return store.onboardingStatus();
    case 'onboarding_materials': return store.onboardingMaterials();
    case 'save_profile': return store.saveProfile(a.markdown);
    case 'fetch_link': return store.fetchLink(a.url);
    case 'import_resume': return store.importResume(a.path);
    case 'search_jobs': { const r = store.searchJobs({ q: a.q, location: a.location || '', status: a.status, band: a.band, kind: a.kind, source: a.source, company: a.company, payMin: a.payMin, payMax: a.payMax, payKnown: a.payKnown === true, postedDays: a.postedDays, foundDays: a.foundDays, maxScore: a.maxScore, remoteOnly: a.remote === true, minScore: a.minScore, limit: a.limit || 50 }); return { total: r.total, rows: r.rows.map((j) => ({ id: j.id, score: j.score, company: j.company, title: j.title, location: j.location, pay: j.salary, band: j.payBand, status: j.status, posted: j.posted, url: j.url })) }; }
    case 'get_job': return store.getJob(a.id);
    case 'today': return store.today({ cap: a.cap || 7 });
    case 'set_status': return store.setStatus(a.id, a.status, 'mcp', a.reason || '');
    case 'add_note': return store.addNote(a.id, a.note, 'mcp');
    case 'save_application_field': return store.saveApplicationDraft(a.id, { field: a.field, value: a.value });
    case 'application_packet': return store.applicationPacket(a.id);
    case 'tailored_resume_materials': return { ...await tailored.materials(a.id, { emphasis: a.emphasis, extra: a.extra || '' }), saved: tailored.saved(a.id) };
    case 'save_tailored_resume': return tailored.save(a.id, a.text, 'mcp');
    case 'cover_letter_materials': return { ...await letter.materials(a.id, { emphasis: a.emphasis, length: a.length, extra: a.extra || '' }), saved: letter.saved(a.id) };
    case 'save_cover_letter': return letter.save(a.id, a.text, 'mcp');
    case 'application_materials': return { job: store.getJob(a.id), packet: store.applicationPacket(a.id), ...store.profile() };
    case 'summary': return store.summary();
    case 'run_scan': return store.runScan(a.dry ? ['--dry'] : [], { criteria: a.criteria || '', via: 'mcp' });
    case 'mail_check': return mail.start({ sinceDays: a.days });
    case 'mail_items': return mail.items();
    case 'preview_criteria': return store.previewCriteria(a.raw);
    case 'outcomes': return store.outcomes();
    case 'list_criteria_presets': return store.criteriaPresets();
    case 'save_criteria_preset': return store.saveCriteriaPreset(a.name, a.raw);
    case 'activate_criteria_preset': return store.activateCriteriaPreset(a.name);
    case 'scan_status': return store.scanStatus();
    case 'scan_preview': return store.scanPreview(a);
    case 'get_criteria': return store.getCriteria();
    case 'set_criteria': return store.setCriteria(a.raw);
    case 'list_companies': return store.companies();
    case 'list_feeds': return store.feeds();
    case 'add_company': return store.addCompany(a);
    case 'add_job': return store.importLinks(a.urls);
    case 'attach_posting': return store.attachPosting(a.id, a.url);
    case 'list_snippets': return store.getSnippets();
    case 'list_people': return people.listPeople();
    case 'get_person': return people.getPerson(a.id);
    case 'add_person': { const p = people.createPerson(a); if (a.jobId) people.attachPerson(a.jobId, p.id, { role: a.role, context: a.context }); return people.getPerson(p.id); }
    case 'attach_person': return people.attachPerson(a.jobId, a.personId, { role: a.role, context: a.context });
    case 'log_contact': return people.logContact(a.personId, { date: a.date, via: 'mcp', text: a.text });
    default: throw Object.assign(new Error(`unknown tool ${name}`), { code: -32601 });
  }
}

const write = (o) => process.stdout.write(JSON.stringify(o) + '\n');
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    handle(msg);
  }
});
function handle(msg) {
  const { id, method, params = {} } = msg;
  if (method === 'initialize') return write({ jsonrpc: '2.0', id, result: { protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'tekjobs', version: '0.1.0' } } });
  if (method === 'notifications/initialized' || method?.startsWith('notifications/')) return;
  if (method === 'ping') return write({ jsonrpc: '2.0', id, result: {} });
  if (method === 'tools/list') return write({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  if (method === 'tools/call') {
    return call(params.name, params.arguments || {})
      .then((result) => write({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } }))
      .catch((e) => write({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: e.message }] } }));
  }
  if (id !== undefined) write({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
}
process.stderr.write(`tekjobs-mcp: vault ${store.VAULT}\n`);
