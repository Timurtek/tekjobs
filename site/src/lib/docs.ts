import fs from "node:fs";
import path from "node:path";

/**
 * Pages are markdown files under content/<collection>, one page each, with a small frontmatter: title, order,
 * a one-line summary, and for legal pages an updated date. Read at build time; the site has no CMS and needs none.
 */
export type Doc = { slug: string; title: string; order: number; summary: string; updated: string; body: string };

const dir = (collection: string) => path.join(process.cwd(), "content", collection);

function parse(slug: string, text: string): Doc {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm: Record<string, string> = {};
  if (m) for (const line of m[1]!.split(/\r?\n/)) { const i = line.indexOf(":"); if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, ""); }
  const body = m ? text.slice(m[0].length) : text;
  return { slug, title: fm.title || slug, order: Number(fm.order || 999), summary: fm.summary || "", updated: fm.updated || "", body };
}

export function allPages(collection: string): Doc[] {
  const d = dir(collection);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith(".md")).map((f) => parse(f.replace(/\.md$/, ""), fs.readFileSync(path.join(d, f), "utf8"))).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function getPage(collection: string, slug: string): Doc | null {
  const file = path.join(dir(collection), `${path.basename(slug)}.md`);
  return fs.existsSync(file) ? parse(slug, fs.readFileSync(file, "utf8")) : null;
}

export const allDocs = () => allPages("docs");
export const getDoc = (slug: string) => getPage("docs", slug);
export const allLegal = () => allPages("legal");
export const getLegal = (slug: string) => getPage("legal", slug);
