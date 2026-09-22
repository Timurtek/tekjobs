// People come from the humans who write, never the machines; and a job note's People lines must read back
// the way they were written. Pure functions only; the note writes need a vault.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromMail, parseAddress, parsePeopleLines, personId } from '../app/server/people.mjs';

test('an address with a display name splits; a bare address makes a name from the local part', () => {
  assert.deepEqual(parseAddress('Jane Doe <jane.doe@northwind.com>'), { name: 'Jane Doe', email: 'jane.doe@northwind.com' });
  assert.deepEqual(parseAddress('"Doe, Jane" <JANE@northwind.com>'), { name: 'Doe, Jane', email: 'jane@northwind.com' });
  assert.deepEqual(parseAddress('sam.lee@contoso.io'), { name: 'Sam Lee', email: 'sam.lee@contoso.io' });
  assert.equal(parseAddress('not an address').email, '');
});

test('a human sender becomes a person; automated and ATS senders do not', () => {
  const human = fromMail({ from: 'Jane Doe <jane@northwind.com>', company: 'Northwind', kind: 'scheduling' });
  assert.deepEqual(human, { name: 'Jane Doe', email: 'jane@northwind.com', role: 'recruiter', company: 'Northwind' });
  assert.equal(fromMail({ from: 'Northwind Careers <no-reply@northwind.com>', company: 'Northwind' }), null);
  assert.equal(fromMail({ from: 'Ashby <notifications@ashbyhq.com>', company: 'Northwind' }), null);
  assert.equal(fromMail({ from: 'Northwind <no-reply@us.greenhouse-mail.io>', company: 'Northwind' }), null);
  assert.equal(fromMail({ from: 'recruiting@contoso.com', company: 'Contoso' }), null, 'a role mailbox is not a person');
  assert.equal(fromMail({ from: 'sam.lee@contoso.io', fromName: 'Sam Lee', company: 'Contoso' }).name, 'Sam Lee', 'the model\'s name wins when it gave one');
});

test('People lines read back with name, role, email and context, whatever the order', () => {
  const lines = parsePeopleLines([
    '- [[People/Jane Doe (Northwind)|Jane Doe]] · recruiter · jane@northwind.com · scheduling, 2026-09-20',
    '- [[People/Sam Lee]] · hiring-manager',
    '- Pat Q · referral · knows the team',
    'not a bullet',
  ].join('\n'));
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0], { id: 'Jane Doe (Northwind)', name: 'Jane Doe', role: 'recruiter', email: 'jane@northwind.com', context: 'scheduling, 2026-09-20' });
  assert.deepEqual(lines[1], { id: 'Sam Lee', name: 'Sam Lee', role: 'hiring-manager', email: '', context: '' });
  assert.equal(lines[2].id, '', 'a hand-written line without a link still shows');
  assert.equal(lines[2].context, 'knows the team');
});

test('a person id is a safe filename and carries the company', () => {
  assert.equal(personId('Jane Doe', 'Northwind'), 'Jane Doe (Northwind)');
  assert.equal(personId('A/B: C?', ''), 'A B C');
});
