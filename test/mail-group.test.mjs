// One application, several emails: the group speaks with its strongest email and confirms once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupItems, reconcile } from '../app/server/mail-check.mjs';

const notes = [{ id: 'Celigo - Design Engineer (1)', company: 'Celigo', title: 'Design Engineer', status: 'new', score: 87 }];
const mail = (o) => ({ company: 'Celigo', role: 'Design Engineer', kind: 'confirmation', date: '2026-09-09', gist: 'g', from: 'x', messageId: 'm' + Math.random().toString(36).slice(2, 8), subject: 's', ...o });

test('emails about the same application collapse to one group led by the strongest kind', () => {
  const items = reconcile([
    mail({ kind: 'confirmation', date: '2026-09-01' }),
    mail({ kind: 'scheduling', date: '2026-09-09' }),
    mail({ kind: 'advance', date: '2026-09-10' }),
    mail({ kind: 'scheduling', date: '2026-09-11' }),
    mail({ company: 'Meta', role: '', kind: 'confirmation', date: '2026-09-16' }),
    mail({ company: 'Meta', role: '', kind: 'confirmation', date: '2026-09-17' }),
    mail({ company: 'Microsoft', role: 'Principal Designer', kind: 'confirmation', date: '2026-09-17' }),
    mail({ company: 'Microsoft', role: 'Principal Designer', kind: 'rejection', date: '2026-09-21' }),
  ], notes);
  const groups = groupItems(items);
  assert.equal(groups.length, 3);
  const [ms, celigo, meta] = groups;   // rejection first, then interview signals, then confirmations
  assert.equal(ms.company, 'Microsoft'); assert.equal(ms.kind, 'rejection'); assert.equal(ms.count, 2); assert.deepEqual(ms.suggestion, { action: 'create', status: 'rejected', appliedOn: '2026-09-21' });
  assert.equal(celigo.company, 'Celigo'); assert.equal(celigo.count, 4); assert.ok(['advance', 'scheduling'].includes(celigo.kind)); assert.equal(celigo.first, '2026-09-01'); assert.equal(celigo.date, '2026-09-11');
  assert.deepEqual(celigo.suggestion, { action: 'status', status: 'interviewing' });
  assert.equal(celigo.match, 'exact');
  assert.equal(meta.count, 2); assert.equal(meta.kind, 'confirmation');
});

test('confirmed and dismissed emails leave the groups', () => {
  const items = reconcile([mail({}), mail({})], notes);
  items[0].state = 'confirmed';
  assert.equal(groupItems(items).length, 1);
  assert.equal(groupItems(items)[0].count, 1);
});
