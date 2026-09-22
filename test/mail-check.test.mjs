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
