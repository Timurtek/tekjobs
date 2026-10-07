// The mail check's model output is only ever an extraction; what each email means for a note is decided here,
// and that decision is what these pin: which note an email lands on, and what confirming it would do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOutput, reconcile, suggestionFor, prompt } from '../app/server/mail-check.mjs';

const notes = [
  { id: 'Vetcove - Staff Design Engineer (1)', company: 'Vetcove', title: 'Staff Design Engineer', status: 'new', score: 85 },
  { id: 'Vanta - Staff Visual Product Designer, Design Systems (2)', company: 'Vanta', title: 'Staff Visual Product Designer, Design Systems', status: 'applied', score: 128 },
  { id: 'Vanta - Staff Product Designer, Design Systems (3)', company: 'Vanta', title: 'Staff Product Designer, Design Systems', status: 'applied', score: 120 },
  { id: 'Help Scout - Sr. Product Engineer (4)', company: 'Help Scout', title: 'Sr. Product Engineer', status: 'applied', score: 90 },
  { id: 'Help Scout - Design Engineer (5)', company: 'Help Scout', title: 'Design Engineer', status: 'new', score: 95 },
  { id: 'Ashby - Staff Design Engineer - Americas (6)', company: 'Ashby', title: 'Staff Design Engineer - Americas', status: 'applied', score: 110 },
];
const mail = (o) => ({ company: 'X', role: '', kind: 'confirmation', date: '2026-09-21', gist: 'g', from: 'no-reply@ashbyhq.com', messageId: 'm' + Math.random().toString(36).slice(2, 8), subject: 's', ...o });

test('parseOutput takes the array out of whatever surrounds it and drops malformed entries', () => {
  const text = 'Here you go:\n```json\n[{"company":"Vetcove","role":"Staff Design Engineer","kind":"rejection","date":"2026-09-21","gist":"No.","from":"a@b","messageId":"abc","subject":"s"},{"nope":1},{"company":"Odd","messageId":"z","kind":"weird","date":"yesterday"}]\n```';
  const out = parseOutput(text);
  assert.equal(out.length, 2);
  assert.equal(out[0].kind, 'rejection');
  assert.equal(out[1].kind, 'other', 'an unknown kind becomes other');
  assert.equal(out[1].date, '', 'a non-ISO date is dropped');
  assert.throws(() => parseOutput('I could not access the mailbox.'), /no JSON array/);
});

test('an exact role match wins; a same-company match picks the note furthest along and lists the rest', () => {
  const [vanta, helpScout, unknown] = reconcile([
    mail({ company: 'Vanta', role: 'Staff Product Designer, Design Systems' }),
    mail({ company: 'Help Scout', role: 'Sr./Staff Product Engineer, Agents' }),
    mail({ company: 'Whatnot', role: 'Product Designer', kind: 'rejection' }),
  ], notes);
  assert.equal(vanta.match, 'exact');
  assert.equal(vanta.noteId, 'Vanta - Staff Product Designer, Design Systems (3)');
  assert.equal(helpScout.match, 'company-other-role', 'a named role the vault lacks is a different application');
  assert.equal(helpScout.noteId, '', 'so the default is a new note');
  assert.equal(helpScout.suggestion.action, 'create');
  assert.equal(helpScout.candidates[0].id, 'Help Scout - Sr. Product Engineer (4)', 'the company\'s notes are offered, furthest along first');
  assert.equal(helpScout.candidates.length, 2);
  const [noRole] = reconcile([mail({ company: 'Help Scout', role: '' })], notes);
  assert.equal(noRole.match, 'company');
  assert.equal(noRole.noteId, 'Help Scout - Sr. Product Engineer (4)', 'no role named: the note furthest along is the best guess');
  assert.equal(unknown.match, 'none');
  assert.deepEqual(unknown.suggestion, { action: 'create', status: 'rejected', appliedOn: '2026-09-21' });
});

test('company names match through punctuation, suffixes and parentheticals', () => {
  const [a, b] = reconcile([mail({ company: 'Vetcove, Inc.' }), mail({ company: 'Ashby (via Ashby)' })], notes);
  assert.equal(a.noteId, 'Vetcove - Staff Design Engineer (1)');
  assert.equal(b.noteId, 'Ashby - Staff Design Engineer - Americas (6)');
});

test('what confirming does depends on the kind and where the note already is', () => {
  assert.deepEqual(suggestionFor('confirmation', 'new', '2026-09-16'), { action: 'status', status: 'applied', appliedOn: '2026-09-16' });
  assert.deepEqual(suggestionFor('confirmation', 'applied', '2026-09-16'), { action: 'record', appliedOn: '2026-09-16' }, 'already applied: record the date and the mail, change nothing');
  assert.deepEqual(suggestionFor('rejection', 'applied', '2026-09-17'), { action: 'status', status: 'rejected' });
  assert.deepEqual(suggestionFor('rejection', 'rejected', '2026-09-17'), { action: 'record' });
  assert.deepEqual(suggestionFor('advance', 'applied', '2026-09-18'), { action: 'status', status: 'interviewing' });
  assert.deepEqual(suggestionFor('scheduling', 'interviewing', '2026-09-18'), { action: 'record' });
  assert.deepEqual(suggestionFor('info-request', 'new', '2026-09-19'), { action: 'record' });
  assert.deepEqual(suggestionFor('confirmation', '', '2026-09-20'), { action: 'create', status: 'applied', appliedOn: '2026-09-20' });
});

test('the prompt forbids writing, names the window, and only hints at the companies', () => {
  const p = prompt({ sinceDays: 10, companies: ['Vanta', 'Ashby'] });
  assert.match(p, /Do not send, reply, draft, label, forward, trash or modify/);
  assert.match(p, /newer_than:10d/);
  assert.match(p, /Vanta, Ashby/);
  assert.match(p, /others may exist/);
  assert.match(p, /Output ONLY a JSON array/);
});

test('outreach is a lead: a new note at reviewing, or a record on the one that exists; the prompt asks for it and searches the applied companies by name', () => {
  assert.deepEqual(suggestionFor('outreach', '', '2026-10-06'), { action: 'create', status: 'reviewing' });
  assert.deepEqual(suggestionFor('outreach', 'applied', '2026-10-06'), { action: 'record' });
  const p = prompt({ sinceDays: 3, companies: ['Reddit', 'Vanta'] });
  assert.match(p, /kind "outreach"/);
  assert.match(p, /\("Reddit" OR "Vanta"\) newer_than:3d/);
  assert.match(p, /gem\.com/);
  assert.match(p, /"update from"/i);
  const parsed = parseOutput('[{"company":"Eli Lilly","role":"Remote Design Technologist","kind":"outreach","date":"2026-10-06","gist":"Fiona wrote about a role.","from":"Fiona Thompson <inmail-hit-reply@linkedin.com>","fromName":"Fiona Thompson","messageId":"m1","subject":"Remote Design Technologist/Engineer role - Eli Lilly"}]');
  assert.equal(parsed[0].kind, 'outreach');
});

test('every item carries the Gmail link for its message, and a group carries the leading one', () => {
  const items = reconcile(parseOutput('[{"company":"Vanta","role":"Staff Visual Product Designer, Design Systems","kind":"confirmation","date":"2026-09-20","gist":"Received.","from":"no-reply@ashbyhq.com","messageId":"abc123","subject":"Thanks for applying"}]'), notes);
  assert.equal(items[0].link, 'https://mail.google.com/mail/u/0/#all/abc123');
});

test('a posting link or a requisition id in the email picks the note, whatever the role is called', () => {
  const linkedNotes = [
    ...notes,
    { id: 'Vanta - Staff Visual Product Designer, Design Systems (2)', company: 'Vanta', title: 'Staff Visual Product Designer, Design Systems', status: 'applied', score: 128, url: 'https://jobs.ashbyhq.com/vanta/ed632c31-2a66-4c91-8d29-f450bbd4de67', jobId: 'ab:vanta:ed632c31-2a66-4c91-8d29-f450bbd4de67' },
    { id: 'Salesforce - Lead Product Designer, Design Systems (9)', company: 'Salesforce', title: 'Lead Product Designer, Design Systems', status: 'applied', score: 100, url: 'https://salesforce.wd12.myworkdayjobs.com/External_Career_Site/job/x/Lead-Product-Designer--Design-Systems_JR361297', jobId: 'wd:salesforce:JR361297' },
  ];
  const parsed = parseOutput(JSON.stringify([
    { company: 'Vanta', role: 'Designer', kind: 'confirmation', date: '2026-10-01', gist: 'Received.', from: 'no-reply@ashbyhq.com', messageId: 'l1', subject: 'Thanks', postingUrl: 'https://jobs.ashbyhq.com/vanta/ed632c31-2a66-4c91-8d29-f450bbd4de67?utm=mail' },
    { company: 'Salesforce', role: '', kind: 'rejection', date: '2026-10-02', gist: 'No.', from: 'salesforce@myworkday.com', messageId: 'l2', subject: 'Update', reqId: 'JR361297' },
    { company: 'Vanta', role: 'Designer', kind: 'confirmation', date: '2026-10-03', gist: 'x', from: 'a@b.c', messageId: 'l3', subject: 's', postingUrl: 'not a url' },
  ]));
  assert.equal(parsed[0].postingUrl, 'https://jobs.ashbyhq.com/vanta/ed632c31-2a66-4c91-8d29-f450bbd4de67?utm=mail');
  assert.equal(parsed[2].postingUrl, '', 'a non-http value is dropped');
  const r = reconcile(parsed, linkedNotes);
  assert.equal(r[0].match, 'exact');
  assert.equal(r[0].via, 'link');
  assert.equal(r[0].noteId, 'Vanta - Staff Visual Product Designer, Design Systems (2)');
  assert.equal(r[1].match, 'exact');
  assert.equal(r[1].noteId, 'Salesforce - Lead Product Designer, Design Systems (9)');
  assert.equal(r[2].match, 'company-other-role', 'without a usable link the role text decides, as before');
});
