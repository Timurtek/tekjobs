// The two numbers the README and the site print about the code, counted from the files that define them.
// `npm run counts` writes site/src/counts.json; test/counts.test.mjs fails when that file, the README or the
// MCP doc disagree with the code, so a new tool or a new board cannot leave a stale number behind.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'site', 'src', 'counts.json');

export function counts() {
  const mcp = fs.readFileSync(path.join(ROOT, 'app', 'server', 'mcp.mjs'), 'utf8');
  const tools = (mcp.match(/^  \{ name: '[a-z_]+'/gm) || []).length;
  const table = fs.readFileSync(path.join(ROOT, 'scraper', 'starter', 'companies-table.md'), 'utf8');
  // Data rows only: not the separator, not a header row.
  const boards = table
    .split(/\r?\n/)
    .filter((line) => /^\|/.test(line) && !/^\|\s*-/.test(line) && !/^\|\s*company\s*\|/i.test(line)).length;
  return { tools, boards };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const c = counts();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(c, null, 2) + '\n');
  console.log(`${c.tools} MCP tools, ${c.boards} boards in the starter registry -> ${path.relative(ROOT, OUT)}`);
}
