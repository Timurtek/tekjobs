// A tailored resume may reorder, prune and tighten. It may not add. The check has to tell the difference
// between a reworded bullet and an invented one, and must notice a new number, date or employer.
// The candidate, employers and products here are fictional.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAgainst, demote, promote } from '../app/server/tailored-resume.mjs';

test('a resume survives storage inside a note section: headings demote and promote losslessly', () => {
  const md = '# Name\n**Title**\n\n## Summary\ntext\n\n## Experience\n### Co | Role\nDates\n- bullet with # in text\n\n#### deep';
  const stored = demote(md);
  assert.ok(!/^## /m.test(stored), 'no line may start with "## " once stored, or the note section ends there');
  assert.equal(promote(stored), md);
});

const SOURCE = `
AVERY SAMPLE
Design Engineer & AI Product Builder
Portland, OR | 555.010.0199 | avery@example.com | avery.example | LinkedIn | GitHub
EXPERIENCE
Northwind | Lead Design Technologist + AI Systems
October 2024 - Present | Remote
- Architected a 140-component design system with accessibility and contrast gates wired into the merge path, plus the operating routine that keeps it adopted.
- Run 15 scheduled pipelines and a knowledge system that turns meetings into a queryable organizational record.
Contoso - Contoso Streaming | Mid-Senior UX/UI Web Engineer
December 2022 - October 2024 | Remote
- Built features, components, patterns, and templates for the Atlas design system in React, TypeScript, SASS, and Storybook.
SELECTED INDEPENDENT PRODUCTS
Lantern | Open-source design-system infrastructure
- Published 12 npm packages that give product teams a reusable, code-native system.
`;

const wrap = (body) => `# Avery Sample\n**Design Engineer & AI Product Builder**\nPortland, OR | 555.010.0199 | avery@example.com | avery.example | LinkedIn | GitHub\n\n## Summary\nDesign engineer.\n\n## Experience\n${body}\n\n## Education\nPortland Community College`;

const hard = (r) => r.warnings.filter((w) => ['trace', 'claim', 'header', 'date'].includes(w.kind)).map((w) => w.kind + ': ' + w.text);

test('a reworded, tightened bullet traces to the source', () => {
  const r = checkAgainst(wrap(`### Northwind | Lead Design Technologist + AI Systems\nOctober 2024 - Present | Remote\n- Architected a 140-component design system with accessibility and contrast gates in the merge path.\n- Run 15 scheduled pipelines and a knowledge system that turns meetings into a queryable record.`), SOURCE);
  assert.deepEqual(hard(r), []);
});

test('an invented bullet is flagged', () => {
  const r = checkAgainst(wrap(`### Northwind | Lead Design Technologist + AI Systems\nOctober 2024 - Present | Remote\n- Managed a team of six engineers and cut release time in half.`), SOURCE);
  assert.ok(hard(r).some((w) => w.startsWith('trace:')), hard(r).join('\n'));
  assert.ok(hard(r).some((w) => w.startsWith('claim:') && w.includes('six engineers')), hard(r).join('\n'));
});

test('a changed number is flagged even when the bullet otherwise traces', () => {
  const r = checkAgainst(wrap(`### Northwind | Lead Design Technologist + AI Systems\nOctober 2024 - Present | Remote\n- Architected a 200-component design system with accessibility and contrast gates in the merge path.`), SOURCE);
  assert.ok(hard(r).some((w) => w.startsWith('claim:') && w.includes('200')), hard(r).join('\n'));
});

test('a new date range or employer is flagged', () => {
  const r = checkAgainst(wrap(`### Northwind | Lead Design Technologist + AI Systems\nJanuary 2023 - Present | Remote\n- Run 15 scheduled pipelines and a knowledge system.\n### Fabrikam | Staff Design Engineer\nJanuary 2020 - March 2022 | Remote\n- Built features, components, patterns, and templates for the Atlas design system in React.`), SOURCE);
  const h = hard(r);
  assert.ok(h.some((w) => w.startsWith('date:') && w.includes('January 2023')), h.join('\n'));
  assert.ok(h.some((w) => w.startsWith('header:') && w.includes('fabrikam')), h.join('\n'));
});

test('capability lines and products are not treated as invented bullets', () => {
  const r = checkAgainst(wrap(`### Contoso - Contoso Streaming | Mid-Senior UX/UI Web Engineer\nDecember 2022 - October 2024 | Remote\n- Built components, patterns and templates for the Atlas design system in React, TypeScript, SASS and Storybook.`) + `\n\n## Capabilities\n- **Engineering:** TypeScript, React\n\n## Selected independent products\n### Lantern | Open-source design-system infrastructure\n- Published 12 npm packages that give product teams a reusable, code-native system.`, SOURCE);
  assert.deepEqual(hard(r), []);
});
