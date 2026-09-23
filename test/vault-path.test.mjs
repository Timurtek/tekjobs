// A note's filename is built from the company, the title and the tail of the job id. The tail must never carry
// a character the filesystem reads as structure; a link id ends in a URL, and URLs end in slashes.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { jobNotePath } from '../scraper/vault.mjs';

test('a link id ending in a URL gives a clean filename tail', () => {
  const p = jobNotePath({ company: 'Meta', title: 'Product Designer, Human Interface', id: 'link:https://www.metacareers.com/profile/job_details/2153803492149585/' });
  assert.equal(path.basename(p), 'Meta - Product Designer, Human Interface (92149585).md');
});

test('board ids and odd characters in titles are tidied the same way', () => {
  assert.equal(path.basename(jobNotePath({ company: 'Acme', title: 'Lead: Design/Systems?', id: 'gh:acme:4321' })), 'Acme - Lead Design Systems (4321).md');
  assert.equal(path.basename(jobNotePath({ company: 'X', title: 'Y', id: 'link:https://example.com/' })), 'X - Y (amplecom).md');
});
