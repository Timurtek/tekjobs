// The weights fingerprint is what tells an already-rescored note from an untouched one, and what says whether
// a criteria preset is the same set as the active one. It has to move when any weight moves, and only then.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weightsFingerprint } from '../scraper/rescore.mjs';

const base = { minScore: 45, titleTerms: { 'design engineer': 40, 'ux engineer': 40 }, titleExclude: ['mechanical'], salary: { minAnnual: 220000, stretchAnnual: 180000 }, location: { requireRemote: true, notRemotePenalty: -60 }, recency: { days7: 15 } };

test('a nested weight change changes the fingerprint', () => {
  const a = weightsFingerprint(base);
  assert.notEqual(a, weightsFingerprint({ ...base, salary: { ...base.salary, minAnnual: 180000 } }), 'pay floor');
  assert.notEqual(a, weightsFingerprint({ ...base, titleTerms: { ...base.titleTerms, 'ux engineer': 30 } }), 'a title weight');
  assert.notEqual(a, weightsFingerprint({ ...base, location: { ...base.location, requireRemote: false } }), 'remote rule');
  assert.notEqual(a, weightsFingerprint({ ...base, titleExclude: [] }), 'an exclusion');
});

test('key order and keys outside the weights do not change it', () => {
  const a = weightsFingerprint(base);
  const reordered = { recency: base.recency, location: { notRemotePenalty: -60, requireRemote: true }, salary: { stretchAnnual: 180000, minAnnual: 220000 }, titleExclude: base.titleExclude, titleTerms: { 'ux engineer': 40, 'design engineer': 40 }, minScore: 45 };
  assert.equal(a, weightsFingerprint(reordered));
  assert.equal(a, weightsFingerprint({ ...base, minScore: 60, openSources: { wellfound: true }, maxDescriptionChars: 9000 }), 'the bar and the sources are not weights');
  assert.match(a, /^[0-9a-f]{8}$/);
});
