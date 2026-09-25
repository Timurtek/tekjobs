// Reading a LinkedIn data export (the "larger archive" from linkedin.com/mypreferences/d/download-my-data),
// as a zip or an unpacked folder, into the few things a job search can use: who you know at which company,
// who has written to you lately, the answers you have typed into application forms, what you applied to and
// saved. Nothing here writes; app/server/linkedin-import.mjs does, into the profile folder only. The archive
// is read in place and never copied. Files this module does not name (ads, reactions, searches, phone numbers,
// birth date, addresses) are never opened.
import fs from 'node:fs';
import path from 'node:path';
import { openZip } from './zip.mjs';

// ---------------- csv ----------------
/** RFC-4180-ish: quoted cells with commas, quotes and newlines inside; CRLF or LF. */
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

/** Rows as objects keyed by the header. Connections.csv opens with a three-line note before its header. */
export function table(text) {
  let s = String(text).replace(/^﻿/, '');
  if (/^Notes?:/i.test(s)) s = s.replace(/^[\s\S]*?\n\n/, '');
  const rows = parseCsv(s);
  if (!rows.length) return [];
  const [head, ...data] = rows;
  const keys = head.map((h) => h.trim());
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

// ---------------- names ----------------
const SUFFIX = /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|ag|sa|bv|technologies|technology|labs|group|holdings|the)\b/g;
/** "Northwind Traders, Inc." and "northwind traders" meet in the middle. */
export function companyKey(name = '') {
  const base = String(name).toLowerCase().replace(/\.(com|io|ai|co|jobs|org|net|dev|app)\b/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const stripped = base.replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();
  // "Group O" must not become "o": when the suffix rule eats the name, keep the name.
  return stripped.length >= 3 ? stripped : base;
}
/** Two keys name the same company when equal, or when one is the other's first word(s) ("amazon", "amazon web services"). */
export function sameCompany(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 4 && l.startsWith(s + ' ');
}
const RECRUITER = /recruit|talent|sourc|people (partner|ops|operations)|staffing|head ?hunter|acquisition/i;
const HIRING = /hiring manager|engineering manager|head of|director|vp\b|vice president|cto|chief|founder|lead\b|manager/i;
export function roleGuess(title = '') {
  if (RECRUITER.test(title)) return 'recruiter';
  if (HIRING.test(title)) return 'hiring-manager';
  return 'other';
}

// ---------------- reading ----------------
const WANT = {
  connections: ['Connections.csv'],
  messages: ['messages.csv'],
  invitations: ['Invitations.csv'],
  applications: [/^Jobs\/Job Applications(_\d+)?\.csv$/],
  savedJobs: [/^Jobs\/Saved Jobs(_\d+)?\.csv$/],
  preferences: ['Jobs/Job Seeker Preferences.csv'],
  answers: ['Jobs/Job Applicant Saved Answers.csv', /^Job Applicant Saved Screening Question Responses(_\d+)?\.csv$/],
  profile: ['Profile.csv'],
  positions: ['Positions.csv'],
  skills: ['Skills.csv'],
};

/** Open a zip or a folder; returns a reader with the export's file names and a text reader. */
export function openExport(source) {
  const p = path.resolve(source);
  if (!fs.existsSync(p)) throw Object.assign(new Error(`No such file or folder: ${p}`), { status: 400 });
  if (fs.statSync(p).isDirectory()) {
    const names = [];
    const walk = (dir, rel = '') => { for (const f of fs.readdirSync(dir)) { const full = path.join(dir, f); const r = rel ? `${rel}/${f}` : f; if (fs.statSync(full).isDirectory()) walk(full, r); else names.push(r); } };
    walk(p);
    // A folder that holds the export inside one top-level directory (as some unzippers make) still works.
    const prefix = names.includes('Connections.csv') ? '' : (names.find((n) => n.endsWith('/Connections.csv')) || '').replace(/Connections\.csv$/, '');
    return { source: p, kind: 'folder', names: names.filter((n) => n.startsWith(prefix)).map((n) => n.slice(prefix.length)), readText: (n) => fs.readFileSync(path.join(p, prefix + n), 'utf8') };
  }
  const zip = openZip(p);
  const prefix = zip.has('Connections.csv') ? '' : (zip.names.find((n) => n.endsWith('/Connections.csv')) || '').replace(/Connections\.csv$/, '');
  return { source: p, kind: 'zip', names: zip.names.filter((n) => n.startsWith(prefix)).map((n) => n.slice(prefix.length)), readText: (n) => zip.readText(prefix + n) };
}

const matches = (name, pats) => pats.some((q) => (q instanceof RegExp ? q.test(name) : q === name));

/** The export's useful tables, each as an array of row objects; missing files give empty tables. */
export function readExport(source) {
  const ex = openExport(source);
  if (!ex.names.some((n) => matches(n, WANT.connections)) && !ex.names.some((n) => matches(n, WANT.messages))) {
    throw Object.assign(new Error(`${ex.source} does not look like a LinkedIn data export: no Connections.csv or messages.csv. Request the larger archive at linkedin.com/mypreferences/d/download-my-data.`), { status: 400 });
  }
  const out = { source: ex.source, kind: ex.kind, files: [] };
  for (const [key, pats] of Object.entries(WANT)) {
    const names = ex.names.filter((n) => matches(n, pats)).sort();
    out.files.push(...names);
    out[key] = names.flatMap((n) => table(ex.readText(n)));
  }
  return out;
}

// ---------------- the index ----------------
// LinkedIn writes dates in the member's local time ("9/15/26, 8:03 PM", "22 Sep 2026") and messages in UTC; the
// calendar day is taken in this machine's zone, so an evening application does not slip to the next day.
const day = (s) => { const t = new Date(String(s || '').replace(/ (AM|PM)$/i, ' $1')); if (isNaN(t.getTime())) return ''; const p = (n) => String(n).padStart(2, '0'); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const fullName = (r) => `${r['First Name'] || ''} ${r['Last Name'] || ''}`.replace(/\s+/g, ' ').trim();
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/**
 * Everything the app needs later, in one JSON the size of a small spreadsheet: connections with a company key,
 * conversations and invitations since `since`, applications, saved jobs, the saved form answers. Message text is
 * kept only for messages since `since`, clipped, so the file stays about your search and not your history.
 */
export function buildIndex(ex, { since = '', now = new Date() } = {}) {
  const self = ex.profile?.[0] ? fullName(ex.profile[0]) : '';
  const selfKey = self.toLowerCase();
  const connections = (ex.connections || []).filter((r) => fullName(r)).map((r) => ({
    name: fullName(r), url: r.URL || '', email: r['Email Address'] || '', company: r.Company || '', companyKey: companyKey(r.Company), title: r.Position || '', connectedOn: day(r['Connected On']),
  }));
  const byUrl = new Map(connections.filter((c) => c.url).map((c) => [c.url.replace(/\/$/, ''), c]));
  const byName = new Map(connections.map((c) => [c.name.toLowerCase(), c]));
  const look = (name, url) => byUrl.get(String(url || '').replace(/\/$/, '')) || byName.get(String(name || '').toLowerCase()) || null;

  const recent = (d) => !since || (d && d >= since);
  const convs = new Map();
  for (const m of ex.messages || []) {
    const d = day(m.DATE);
    if (!recent(d)) continue;
    const id = m['CONVERSATION ID'] || `${m.FROM}|${m.TO}`;
    const c = convs.get(id) || { id, title: m['CONVERSATION TITLE'] || '', with: new Map(), first: d, last: d, count: 0, messages: [] };
    c.count++; if (d < c.first) c.first = d; if (d > c.last) c.last = d;
    const from = String(m.FROM || '').trim(), fromUrl = String(m['SENDER PROFILE URL'] || '').trim();
    const outgoing = selfKey && from.toLowerCase() === selfKey;
    if (!outgoing && from) c.with.set(fromUrl || from, { name: from, url: fromUrl });
    for (const [n, u] of String(m.TO || '').split(',').map((t, i) => [t.trim(), (String(m['RECIPIENT PROFILE URLS'] || '').split(',')[i] || '').trim()])) { if (n && (!selfKey || n.toLowerCase() !== selfKey)) c.with.set(u || n, { name: n, url: u }); }
    c.messages.push({ date: d, from, outgoing, subject: clip(m.SUBJECT, 120), text: clip(m.CONTENT, 240) });
    convs.set(id, c);
  }
  const threads = [...convs.values()].map((c) => ({ ...c, with: [...c.with.values()].map((w) => ({ ...w, ...(look(w.name, w.url) ? { company: look(w.name, w.url).company, title: look(w.name, w.url).title } : {}) })), messages: c.messages.sort((a, b) => a.date.localeCompare(b.date)) })).sort((a, b) => b.last.localeCompare(a.last));

  const invitations = (ex.invitations || []).map((r) => ({ from: r.From || '', to: r.To || '', sentAt: day(r['Sent At']), direction: r.Direction || '', message: clip(r.Message, 240), url: r.Direction === 'INCOMING' ? (r.inviterProfileUrl || '') : (r.inviteeProfileUrl || '') })).filter((i) => recent(i.sentAt));
  const applications = (ex.applications || []).map((r) => ({ date: day(r['Application Date']), company: r['Company Name'] || '', companyKey: companyKey(r['Company Name']), title: r['Job Title'] || '', url: r['Job Url'] || '', resume: r['Resume Name'] || '' })).filter((a) => a.date).sort((a, b) => b.date.localeCompare(a.date));
  const savedJobs = (ex.savedJobs || []).map((r) => ({ date: day(r['Saved Date']), company: r['Company Name'] || '', title: r['Job Title'] || '', url: r['Job Url'] || '' })).filter((s) => s.date).sort((a, b) => b.date.localeCompare(a.date));
  const seenQ = new Set();
  const answers = (ex.answers || []).map((r) => ({ question: String(r.Question || '').trim(), answer: String(r.Answer || '').trim() })).filter((a) => a.question && a.answer && !seenQ.has(a.question.toLowerCase()) && seenQ.add(a.question.toLowerCase()));
  const pref = ex.preferences?.[0] || {};
  const preferences = pref ? { locations: pref.Locations || '', industries: pref.Industries || '', companySize: pref['Company Employee Count'] || '', jobTypes: pref['Preferred Job Types'] || '', titles: pref['Job Titles'] || '', openToRecruiters: pref['Open To Recruiters'] || '', dreamCompanies: pref['Dream Companies'] || '', startTime: pref['Preferred Start Time Range'] || '' } : {};

  return {
    built: now.toISOString(), since, source: ex.source, self,
    counts: { connections: connections.length, threads: threads.length, invitations: invitations.length, applications: applications.length, savedJobs: savedJobs.length, answers: answers.length },
    connections, threads, invitations, applications, savedJobs, answers, preferences,
  };
}

// ---------------- questions the app asks the index ----------------
/** The connections at one company, by key equality or containment either way ("Vanta" and "Vanta Inc"). */
export function warmPaths(index, company) {
  const k = companyKey(company);
  if (!k || !index?.connections) return { company, count: 0, people: [] };
  const people = index.connections.filter((c) => sameCompany(c.companyKey, k)).sort((a, b) => (roleGuess(a.title) === 'recruiter' ? -1 : 0) - (roleGuess(b.title) === 'recruiter' ? -1 : 0) || b.connectedOn.localeCompare(a.connectedOn));
  return { company, count: people.length, people: people.map((c) => ({ name: c.name, title: c.title, url: c.url, connectedOn: c.connectedOn, role: roleGuess(c.title) })) };
}

/**
 * Who has written to you lately, one entry per person, with what their connection record says they do.
 * These become People notes when the import is asked to write them.
 */
export function peopleCandidates(index, { since = index?.since || '' } = {}) {
  const out = new Map();
  const add = (w, date, via, gist) => {
    if (!w.name || (index.self && w.name.toLowerCase() === index.self.toLowerCase())) return;
    const key = (w.url || w.name).toLowerCase();
    const c = out.get(key) || { name: w.name, url: w.url || '', company: w.company || '', title: w.title || '', role: roleGuess(w.title), first: date, last: date, count: 0, log: [] };
    c.count++; if (date && (!c.first || date < c.first)) c.first = date; if (date && date > c.last) c.last = date;
    if (gist) c.log.push({ date, via, text: gist });
    if (!c.company && w.company) { c.company = w.company; c.title = w.title || c.title; c.role = roleGuess(c.title); }
    out.set(key, c);
  };
  for (const t of index.threads || []) {
    if (since && t.last < since) continue;
    for (const w of t.with) for (const m of t.messages) if (!m.outgoing && m.from === w.name) add(w, m.date, 'linkedin message', m.subject ? `${m.subject}: ${m.text}` : m.text);
  }
  for (const i of index.invitations || []) {
    if (since && i.sentAt < since) continue;
    const who = i.direction === 'INCOMING' ? { name: i.from, url: i.url } : { name: i.to, url: i.url };
    const rec = (index.connections || []).find((c) => (who.url && c.url === who.url) || c.name.toLowerCase() === who.name.toLowerCase());
    add({ ...who, company: rec?.company, title: rec?.title }, i.sentAt, i.direction === 'INCOMING' ? 'linkedin invitation received' : 'linkedin invitation sent', i.message);
  }
  return [...out.values()].map((c) => ({ ...c, log: c.log.sort((a, b) => a.date.localeCompare(b.date)).slice(-8) })).sort((a, b) => b.last.localeCompare(a.last));
}

/** Saved form answers as copy-panel items, minus labels the panel already has. */
export function snippetSuggestions(index, existing = []) {
  const have = new Set(existing.map((s) => String(s.label || '').toLowerCase()));
  const label = (q) => clip(q.replace(/[?:]+$/, ''), 60);
  return (index.answers || []).filter((a) => !/^(yes|no|y|n)$/i.test(a.answer)).map((a) => ({ group: 'From LinkedIn', label: label(a.question), value: a.answer })).filter((s) => !have.has(s.label.toLowerCase()));
}
