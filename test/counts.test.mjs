import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { counts, OUT, ROOT } from '../tools/counts.mjs';

test('the numbers the README and the site print are the numbers in the code', () => {
  const live = counts();
  assert.ok(live.tools >= 40, `counted ${live.tools} MCP tools; the pattern in tools/counts.mjs no longer matches mcp.mjs`);
  assert.ok(live.boards >= 250, `counted ${live.boards} boards; the pattern in tools/counts.mjs no longer matches the registry`);

  const written = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  assert.deepEqual(written, live, 'site/src/counts.json is stale: run `npm run counts` and commit it');

  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(readme.includes(`${live.tools} tools`), `README.md should say "${live.tools} tools"`);
  assert.ok(!/\b(39|41|43) (MCP )?tools\b/.test(readme), 'README.md carries a stale tool count');

  const mcpDoc = fs.readFileSync(path.join(ROOT, 'site', 'content', 'docs', 'mcp.md'), 'utf8');
  assert.ok(mcpDoc.includes(`${live.tools} tools`), `docs/mcp.md should say "${live.tools} tools"`);
});
