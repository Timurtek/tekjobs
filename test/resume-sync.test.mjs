// The stale-claim check runs before an application goes out. Two ways to fail: flag a claim that was only
// reworded (the person stops trusting it), or miss a claim that is really gone or whose number changed
// (the person sends something untrue). Both are tested here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { _internals } from '../src/resume-sync.mjs';

const { claims, claimKey, stillClaimed } = _internals;

const NEW_RESUME = `
- Architected a 175-component design system with accessibility and contrast gates wired into the merge path.
- Built a retrieval-backed knowledge product on a 55-article corpus with an evaluation harness.
- Run 15 scheduled pipelines and a knowledge system that turns meetings into a queryable organizational record.
- Published 12 npm packages that give product teams a reusable, code-native system.
- Owned interface design for Elsa and the seven applications it supported across five themes.
`;

test('extracts a figure or number word with the word it counts', () => {
  assert.deepEqual(claims('Architected the design system: 175 components, gates in the merge path'), ['175 components']);
  assert.deepEqual(claims('Run fifteen scheduled operational pipelines'), ['fifteen scheduled']);
  assert.ok(claims('Twelve packages published on npm, MIT licensed').includes('twelve packages'));
});

test('dates are not claims', () => {
  assert.deepEqual(claims('March 2019 - November 2019 | Culver City, CA'), []);
});

test('a reworded claim is still claimed: plural, hyphenation, word vs digit, a word in between', () => {
  assert.equal(stillClaimed('175 components', NEW_RESUME), true, '175 components → "175-component design system"');
  assert.equal(stillClaimed('fifteen scheduled', NEW_RESUME), true, 'fifteen scheduled → "15 scheduled pipelines"');
  assert.equal(stillClaimed('twelve packages', NEW_RESUME), true, 'twelve packages → "12 npm packages"');
  assert.equal(stillClaimed('five themes', NEW_RESUME), true);
  assert.equal(stillClaimed('7 applications', NEW_RESUME), true, 'digit in the packet, word on the resume');
});

test('a claim that is gone is reported', () => {
  assert.equal(stillClaimed('three five', NEW_RESUME), false);
  assert.equal(stillClaimed('five evals', NEW_RESUME), false, '"five" survives elsewhere, but not with evals');
  assert.equal(stillClaimed('10 teams', NEW_RESUME), false);
});

test('a changed number is reported, even though the noun is still there', () => {
  assert.equal(stillClaimed('200 components', NEW_RESUME), false);
  assert.equal(stillClaimed('twenty scheduled', NEW_RESUME), false);
  assert.equal(stillClaimed('55 packages', NEW_RESUME), false, 'number and noun both exist, but never in the same line');
});

test('packet and resume phrasing compare equal on the key', () => {
  assert.equal(claimKey('fifteen scheduled'), claimKey('15 scheduled'));
  assert.equal(claimKey('175 components'), claimKey('175 component'));
  assert.equal(claimKey('twelve packages'), claimKey('12 package'));
  assert.notEqual(claimKey('175 components'), claimKey('176 components'));
});
