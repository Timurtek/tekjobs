import fs from "node:fs";
import path from "node:path";

/**
 * The docs are markdown files in content/docs, one page each, with a small frontmatter: title, order, and a
 * one-line summary. Read at build time; the site has no CMS and needs none.
 */
export type Doc = { slug: string; title: string; order: number; summary: string; body: string };

const DIR = path.join(process.cwd(), "content", "docs");

function parse(slug: string, text: string): Doc {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm: Record<string, string> = {};
  if (m) for (const line of m[1]!.split(/\r?\n/)) { const i = line.indexOf(":"); if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, ""); }
  const body = m ? text.slice(m[0].length) : text;
  return { slug, title: fm.title || slug, order: Number(fm.order || 999), summary: fm.summary || "", body };
}

export function allDocs(): Doc[] {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).map((f) => parse(f.replace(/\.md$/, ""), fs.readFileSync(path.join(DIR, f), "utf8"))).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function getDoc(slug: string): Doc | null {
  const file = path.join(DIR, `${path.basename(slug)}.md`);
  return fs.existsSync(file) ? parse(slug, fs.readFileSync(file, "utf8")) : null;
}
