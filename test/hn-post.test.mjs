import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHNHeader } from '../scraper/sources.mjs';

// First lines in the shapes "Who is hiring" posts actually take, including the body glued onto the header.

test('a header whose body runs straight on: the role is the role, the pay stops at the range', () => {
  const h = parseHNHeader('GC AI | Member of Technical Staff, Applied AI | REMOTE (US/Canada) | $180K–$430K + equityGC AI is building an AI platform for in-house legal teams, helping lawyers draft, review, and analyze legal documents');
  assert.equal(h.company, 'GC AI');
  assert.equal(h.title, 'Member of Technical Staff, Applied AI');
  assert.equal(h.salary, '$180K–$430K + equity');
  assert.equal(h.remote, true);
  assert.match(h.location, /REMOTE \(US\/Canada\)/);
  assert.ok(!h.location.includes('$'));
});

test('a header with a plain-English pay segment and a city', () => {
  const h = parseHNHeader('Fredrin | Forward Deployed Engineers | Los Angeles, CA | REMOTE | $150k-$250k annual salaryFredrin is an AI software factory for engineering teams: run many coding agents in parallel');
  assert.equal(h.title, 'Forward Deployed Engineers');
  assert.equal(h.salary, '$150k-$250k');
  assert.match(h.location, /Los Angeles, CA; REMOTE/);
});

test('a header that ends with a sentence, and one with no role segment at all, keep working', () => {
  const h = parseHNHeader('Hercules | Senior Software Engineer, Frontend | Remote (US) | Full-time | $100k-$300k. We build tools for hospitals.');
  assert.equal(h.title, 'Senior Software Engineer, Frontend');
  assert.equal(h.salary, '$100k-$300k');
  const bare = parseHNHeader('Northwind Traders | Remote | $150k-$200k');
  assert.equal(bare.company, 'Northwind Traders');
  assert.equal(bare.title, 'Northwind Traders | Remote | $150k-$200k', 'with no role segment the header stands in');
  const none = parseHNHeader('');
  assert.equal(none.company, 'HN post');
  assert.equal(none.salary, '');
});
