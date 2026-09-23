// Job alert emails, parsed from a folder of saved messages. Same normalized job shape as sources.mjs.
//
// This is the front door to the boards that have no usable public API — LinkedIn, Indeed, Otta and the rest
// all send alert emails, and an email in your own mailbox is your own data. Nothing here contacts those
// sites: it reads files you put in a folder, and the links it produces are for you to open yourself.
//
// Drop `.eml` files into <profile>/Inbox/ (most mail clients save a message with File > Save As, and most
// can be given a rule that does it automatically). Files are never moved or deleted; the scan's own
// deduplication by job id stops a message being imported twice.
//
// What you get is thin by design. An alert email carries a title, a company, usually a location and rarely
// a sentence of description, so these rows score on their title almost alone and will sit below the same
// job fetched from an ATS. That is the right order: this source exists to catch what the others cannot see.
import fs from 'node:fs';
import path from 'node:path';
import { htmlToText, decodeEntities } from './sources.mjs';

// ---------------- a small MIME reader ----------------
// Enough of RFC 2045 to get the HTML out of a saved alert email, and no more. A full parser is a dependency
// this project does not want for one job.

function splitHeaders(raw) {
  const end = raw.search(/\r?\n\r?\n/);
  const head = end === -1 ? raw : raw.slice(0, end);
  const body = end === -1 ? '' : raw.slice(end).replace(/^\r?\n\r?\n/, '');
  const headers = {};
  // Unfold: a header continues while the next line starts with whitespace.
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return { headers, body };
}

const decodeQuotedPrintable = (s) =>
  s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

function decodeBody(body, encoding = '') {
  const enc = encoding.toLowerCase();
  if (enc.includes('base64')) {
    try { return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8'); } catch { return body; }
  }
  if (enc.includes('quoted-printable')) {
    // Decode to bytes first, then read as UTF-8: =C3=A9 is two bytes, not two characters.
    return Buffer.from(decodeQuotedPrintable(body), 'binary').toString('utf8');
  }
  return body;
}

/** The best body part to read: HTML if the message has one, otherwise plain text. */
function bestPart(raw, depth = 0) {
  const { headers, body } = splitHeaders(raw);
  const type = (headers['content-type'] || 'text/plain').toLowerCase();

  if (type.startsWith('multipart/') && depth < 6) {
    const boundary = (type.match(/boundary="?([^";]+)"?/) || [])[1];
    if (boundary) {
      // Non-capturing: a capture group would put its own matches into the split result as undefined entries.
      const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?\\r?\\n`)).slice(1);
      const found = parts.filter((p) => p && p.trim()).map((p) => bestPart(p, depth + 1)).filter(Boolean);
      return found.find((p) => p.type.includes('html')) || found.find((p) => p.type.includes('text')) || null;
    }
  }
  if (!type.startsWith('text/')) return null;
  return { type, text: decodeBody(body, headers['content-transfer-encoding'] || '') };
}

/** `=?utf-8?B?...?=` encoded-words, as they appear in Subject and From. */
function decodeWords(s = '') {
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === 'B') return Buffer.from(text, 'base64').toString('utf8');
      return Buffer.from(decodeQuotedPrintable(text.replace(/_/g, ' ')), 'binary').toString('utf8');
    } catch { return text; }
  });
}

export function readEmail(raw) {
  const { headers } = splitHeaders(raw);
  const part = bestPart(raw);
  return {
    from: decodeWords(headers.from || ''),
    subject: decodeWords(headers.subject || ''),
    date: headers.date || '',
    html: part && part.type.includes('html') ? part.text : '',
    text: part ? part.text : '',
  };
}

// ---------------- turning a message into jobs ----------------

/** Tracking parameters make every copy of a link unique, which would defeat deduplication. */
function cleanUrl(href) {
  try {
    const u = new URL(decodeEntities(href.replace(/&amp;/g, '&')));
    for (const k of [...u.searchParams.keys()]) {
      // utm_ is a prefix (utm_source, utm_campaign, …); the rest are whole names.
      if (/^utm_/i.test(k) || /^(trk|tracking|trackingId|refId|midToken|mid|eid|lipi|licu|from|source|ref)$/i.test(k)) u.searchParams.delete(k);
    }
    u.hash = '';
    return u.toString();
  } catch { return ''; }
}

/** Anchors, in document order, as { href, text }. */
function anchors(html) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    // `end` matters: the context for a job is what comes *after* its link. Starting at `index` instead
    // drags the anchor's own text into the first line whenever the markup has no block break after it,
    // and the company is then read as part of the title.
    out.push({ href: m[1], text: decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(), index: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return out;
}

/**
 * Each board's alert email is laid out differently, but all of them repeat one block per job around one
 * link. `id` pulls a stable identifier out of that link; `clean` rebuilds the canonical URL from it, so the
 * same job in two different alerts collapses to one row.
 */
const BOARDS = [
  {
    name: 'linkedin',
    from: /linkedin\.com/i,
    link: /linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)/i,
    clean: (id) => `https://www.linkedin.com/jobs/view/${id}/`,
  },
  {
    name: 'indeed',
    from: /indeed\.com/i,
    link: /indeed\.com\/(?:viewjob|rc\/clk|pagead\/clk)[^"']*?[?&]jk=([0-9a-f]+)/i,
    clean: (id) => `https://www.indeed.com/viewjob?jk=${id}`,
  },
  {
    // Otta was acquired by Welcome to the Jungle; app.otta.com now redirects to app.welcometothejungle.com.
    // Both senders and both link shapes are matched, because old alerts keep working and new ones arrive
    // under the new name.
    name: 'otta',
    from: /(otta\.com|welcometothejungle\.com)/i,
    link: /(?:otta\.com|welcometothejungle\.com)\/jobs\/([A-Za-z0-9_-]+)/i,
    clean: (id) => `https://app.welcometothejungle.com/jobs/${id}`,
  },
  {
    name: 'wellfound',
    from: /(wellfound|angel)\.co/i,
    link: /wellfound\.com\/jobs\/(\d+)/i,
    clean: (id) => `https://wellfound.com/jobs/${id}`,
  },
];

/** Anything else: keep links that look like a job posting on a board we already understand. */
const GENERIC_LINK = /(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|workable\.com|breezy\.hr|bamboohr\.com)\/[^"']*/i;

/**
 * The text that follows a job link, up to the next one — where the company and location live in every
 * layout examined. Read as plain text so a change of markup does not break it.
 */
function contextAfter(html, from, to) {
  return htmlToText(html.slice(from, to === -1 ? from + 1200 : to))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

const LOCATION_HINT = /remote|hybrid|on-?site|,\s*[A-Z]{2}\b|United States|United Kingdom|Canada|Germany|India|Ireland|Netherlands|Australia|Singapore/i;

export function jobsFromEmail(raw, file = '') {
  const mail = readEmail(raw);
  const html = mail.html || mail.text;
  if (!html) return [];
  const board = BOARDS.find((b) => b.from.test(mail.from)) || null;
  const links = anchors(html);
  const posted = mail.date && !isNaN(Date.parse(mail.date)) ? new Date(mail.date).toISOString() : null;

  const jobs = [];
  const seen = new Set();
  for (let i = 0; i < links.length; i++) {
    const a = links[i];
    const hit = board ? a.href.match(board.link) : a.href.match(GENERIC_LINK);
    if (!hit) continue;
    const url = board ? board.clean(hit[1]) : cleanUrl(a.href);
    if (!url || seen.has(url)) continue;

    // The anchor text is the title in every layout examined; anchors that are buttons ("Apply", "View job")
    // wrap the same link, so the first one with real words wins.
    const title = a.text.replace(/\s+/g, ' ').trim();
    if (!title || title.length < 3 || /^(apply|view|see|show)\b/i.test(title)) continue;

    const next = links.slice(i + 1).find((l) => (board ? l.href.match(board.link) : l.href.match(GENERIC_LINK)));
    const lines = contextAfter(html, a.end, next ? next.index : -1).filter((l) => l && l !== title);
    const location = lines.find((l) => LOCATION_HINT.test(l) && l.length < 80) || '';
    const company = lines.find((l) => l !== location && l.length < 60 && !/^\W/.test(l)) || '';

    seen.add(url);
    jobs.push({
      id: `mail:${board ? board.name : 'link'}:${url}`,
      source: `email:${board ? board.name : 'link'}`,
      company: company || 'Unknown (from an alert email)',
      title,
      url,
      location,
      remote: /\bremote\b/i.test(`${location} ${title}`),
      posted,
      // Alert emails carry a snippet at best. The subject is kept so the note says where the row came from.
      descriptionHtml: `<p>Imported from an alert email${board ? ` (${board.name})` : ''}${file ? `: <code>${path.basename(file)}</code>` : ''}.</p><p>${decodeEntities(mail.subject)}</p>`,
      salary: '',
      department: '',
      employmentType: '',
    });
  }
  return jobs;
}

/**
 * Every `.eml` in the inbox folder, as jobs. Never writes, moves or deletes a message: the folder is the
 * person's, and the scan already refuses to rewrite a note it has seen before.
 */
export async function fetchEmailInbox(criteria = {}) {
  const cfg = criteria.email || {};
  const dir = cfg.dir || (criteria._inbox ?? '');
  if (!dir) return { ok: false, jobs: [], error: 'no inbox folder configured' };
  if (!fs.existsSync(dir)) return { ok: false, jobs: [], error: `no folder at ${dir} — create it and save alert emails into it as .eml` };

  const files = fs.readdirSync(dir).filter((f) => /\.(eml|txt|mht|mhtml)$/i.test(f));
  if (!files.length) return { ok: false, jobs: [], error: `no .eml files in ${dir}` };

  const all = [];
  const failures = [];
  for (const f of files.slice(0, cfg.maxFiles ?? 200)) {
    const full = path.join(dir, f);
    try {
      all.push(...jobsFromEmail(fs.readFileSync(full, 'utf8'), full));
    } catch (e) {
      failures.push(`${f}: ${e.message}`);
    }
  }
  const byUrl = new Map();
  for (const j of all) if (!byUrl.has(j.url)) byUrl.set(j.url, j);
  if (!byUrl.size) return { ok: false, jobs: [], error: failures.length ? `no jobs found; ${failures[0]}` : `no job links found in ${files.length} message(s)` };
  return { ok: true, jobs: [...byUrl.values()] };
}
