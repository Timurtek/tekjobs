// The slop check must catch the letter the button actually produced on 2026-09-21, and must stay quiet on a
// letter written the way the person writes. The candidate and companies here are fictional.
import test from 'node:test';
import assert from 'node:assert/strict';
import { slopFindings } from '../app/server/cover-letter.mjs';

const FORM_LETTER = `Hello,

You describe the role as "both how it works and how it looks," in a developer tool where speed, interactions, and small details matter. That is the line I have worked on for more than a decade, across Fabrikam, Contoso, and startup product teams.

You ask for "experience with React and TypeScript." At Contoso I created and maintained the Atlas design system in Next.js, React, TypeScript, SASS, Tailwind CSS, and Storybook.

You ask for "experience building end-to-end websites and landing pages." At Northwind I built the marketing platform from the first commit.

You ask for "agentic coding tools as part of the design process." I use Claude Code daily.

My work is at avery.example.

Avery Sample`;

const PLAIN_LETTER = `Hello,

Linear's marketing site has to feel like the product, and the product is fast. Most brand teams ship pages that look right and lag; the ones that hold up treat the animation and the load path as engineering.

At Northwind I built the marketing platform from the first commit, on the same design system I architected for the product, 140 components with accessibility and contrast gates in the merge path. Before that I created and maintained the Atlas design system at Contoso across seven applications and five themes.

I also build alone. Lantern is open source, 12 npm packages, with a rule engine that holds coding agents to the same tokens and components as the people they work beside.

The work is at avery.example. I am available from November 2026.

Avery Sample`;

test('the form letter is caught for the reasons a reader would give', () => {
  const found = slopFindings(FORM_LETTER).join('\n');
  assert.match(found, /decade/);
  assert.match(found, /tag line/);
  assert.match(found, /"You ask for" stanzas/);
  assert.match(found, /quotes the posting 4 times/);
  assert.match(found, /two paragraphs open the same way/);
});

test('a plainly written letter passes', () => {
  assert.deepEqual(slopFindings(PLAIN_LETTER), []);
});
