/**
 * A small markdown parser for assistant output: paragraphs, headings, ordered and unordered lists, fenced
 * code, block quotes, and inline code, bold, italic and links. It is deliberately not CommonMark; it is the
 * subset models produce, parsed predictably, with no HTML passthrough.
 */

export type Inline = { kind: "text"; text: string } | { kind: "code"; text: string } | { kind: "strong"; children: Inline[] } | { kind: "em"; children: Inline[] } | { kind: "link"; href: string; children: Inline[] };

export type Block =
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "code"; language: string; code: string }
  | { kind: "quote"; children: Inline[] }
  | { kind: "table"; header: Inline[][]; rows: Inline[][][] }
  | { kind: "rule" };

/** A pipe-table row into cells; leading and trailing pipes are optional. */
function tableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

const isTableRow = (line: string): boolean => /^\s*\|.*\|\s*$/.test(line);
const isTableRule = (line: string): boolean => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = /^```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const language = fence[1] ?? "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) buf.push(lines[i++]!);
      i++; // closing fence, or end of input while streaming
      blocks.push({ kind: "code", language, code: buf.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1]!.length as 1 | 2 | 3 | 4 | 5 | 6, children: parseInline(heading[2]!) });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }
    // A pipe table: a header row, a rule row, then body rows until a line that is not a row.
    if (isTableRow(line) && i + 1 < lines.length && isTableRule(lines[i + 1]!)) {
      const header = tableCells(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && isTableRow(lines[i]!)) rows.push(tableCells(lines[i++]!).map(parseInline));
      blocks.push({ kind: "table", header, rows });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) buf.push(lines[i++]!.replace(/^>\s?/, ""));
      blocks.push({ kind: "quote", children: parseInline(buf.join(" ")) });
      continue;
    }
    const bullet = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
    if (bullet) {
      const ordered = /\d/.test(bullet[1]!);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]!);
        if (!m) break;
        let text = m[2]!;
        i++;
        // Continuation lines indented under the item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]!) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]!)) text += " " + lines[i++]!.trim();
        items.push(parseInline(text));
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^```/.test(lines[i]!) &&
      !/^(#{1,6})\s/.test(lines[i]!) &&
      !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]!) &&
      !/^>\s?/.test(lines[i]!) &&
      !(isTableRow(lines[i]!) && i + 1 < lines.length && isTableRule(lines[i + 1]!))
    ) {
      buf.push(lines[i++]!.trim());
    }
    blocks.push({ kind: "paragraph", children: parseInline(buf.join(" ")) });
  }
  return blocks;
}

/** Inline markup: code spans first (they hide everything else), then links, bold, italic. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let rest = src;
  const push = (node: Inline) => {
    const last = out[out.length - 1];
    if (node.kind === "text" && last?.kind === "text") last.text += node.text;
    else out.push(node);
  };
  while (rest.length) {
    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      push({ kind: "code", text: code[1]! });
      rest = rest.slice(code[0].length);
      continue;
    }
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|#[^\s)]*)\)/.exec(rest);
    if (link) {
      push({ kind: "link", href: link[2]!, children: parseInline(link[1]!) });
      rest = rest.slice(link[0].length);
      continue;
    }
    const strong = /^(\*\*|__)(.+?)\1/.exec(rest);
    if (strong) {
      push({ kind: "strong", children: parseInline(strong[2]!) });
      rest = rest.slice(strong[0].length);
      continue;
    }
    const em = /^(\*|_)([^*_]+?)\1/.exec(rest);
    if (em) {
      push({ kind: "em", children: parseInline(em[2]!) });
      rest = rest.slice(em[0].length);
      continue;
    }
    // Plain text up to the next marker.
    const next = rest.slice(1).search(/[`*_[]/);
    const take = next === -1 ? rest.length : next + 1;
    push({ kind: "text", text: rest.slice(0, take) });
    rest = rest.slice(take);
  }
  return out;
}

/** The plain text of inline nodes, for labels and tests. */
export function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => (n.kind === "text" || n.kind === "code" ? n.text : inlineText(n.children))).join("");
}
