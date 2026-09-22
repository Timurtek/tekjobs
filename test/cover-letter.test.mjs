// The letter check exists for one failure above all: a model that invents a figure to sound convincing.
// It must see small numbers (the resume differ deliberately does not), and must not nag about prose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { letterClaims } from '../app/server/cover-letter.mjs';

test('small invented numbers are claims', () => {
  assert.deepEqual(letterClaims('I led a team of 40 engineers.'), ['40 engineers']);
  assert.deepEqual(letterClaims('With 8 years in design engineering.'), ['8 years']);
  assert.ok(letterClaims('Published as 12 npm packages.').includes('12 npm'));
});

test('number words count, except the pronoun "one"', () => {
  assert.deepEqual(letterClaims('It supported seven applications across five themes.'), ['seven applications', 'five themes']);
  assert.deepEqual(letterClaims('That gap is one I have worked on directly.'), []);
  assert.deepEqual(letterClaims('It is the one that matters.'), []);
});

test('dates are not claims', () => {
  assert.deepEqual(letterClaims('I am available from November 2026.'), []);
  assert.deepEqual(letterClaims('We spoke on March 3 about the role.'), []);
  assert.deepEqual(letterClaims('Since 2019 I have shipped design systems.'), []);
});

test('percentages and large figures are claims', () => {
  assert.deepEqual(letterClaims('I grew revenue 300 percent with 500 components.'), ['300 percent', '500 components']);
  assert.deepEqual(letterClaims('Trusted by 29,000 companies.'), ['29000 companies'], 'a grouped number is one number');
});
