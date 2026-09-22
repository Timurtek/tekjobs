/* zengin-owned Markdown, forked from @zenginui/ui@0.1.0, sha d4a41bf2842a */
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { parseMarkdown, type Block, type Inline } from "@/lib/markdown";
import { CodeBlock } from "../code-block/code-block";
import { Table } from "../table/table";

export interface MarkdownProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Markdown source, as a model writes it. Parsed on every render, which is cheap for message-sized text. */
  text: string;
  /** Show a cursor at the end while the text is still arriving. */
  streaming?: boolean;
}

/**
 * Assistant text: the markdown subset models produce (paragraphs, headings, lists, fenced code, quotes,
 * inline code, bold, italic, links), rendered with the system's type. Never raw HTML.
 */
export const Markdown = forwardRef<HTMLDivElement, MarkdownProps>(function Markdown({ text, streaming = false, className, ...rest }, ref) {
  const blocks = parseMarkdown(text);
  return (
    <div ref={ref} className={cx("z-markdown", className)} data-streaming={streaming || undefined} {...rest}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} last={i === blocks.length - 1} streaming={streaming} />
      ))}
      {streaming && blocks.length === 0 && <span className="z-markdown__cursor" aria-hidden="true" />}
    </div>
  );
});

function BlockView({ block, last, streaming }: { block: Block; last: boolean; streaming: boolean }) {
  const cursor = last && streaming ? <span className="z-markdown__cursor" aria-hidden="true" /> : null;
  switch (block.kind) {
    case "paragraph":
      return (
        <p>
          <InlineView nodes={block.children} />
          {cursor}
        </p>
      );
    case "heading": {
      const Tag = `h${block.level}` as "h1";
      return (
        <Tag>
          <InlineView nodes={block.children} />
          {cursor}
        </Tag>
      );
    }
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag>
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineView nodes={item} />
              {i === block.items.length - 1 ? cursor : null}
            </li>
          ))}
        </Tag>
      );
    }
    case "code":
      return (
        <>
          <CodeBlock code={block.code} language={block.language || undefined} />
          {cursor}
        </>
      );
    case "quote":
      return (
        <blockquote>
          <InlineView nodes={block.children} />
          {cursor}
        </blockquote>
      );
    case "table":
      return (
        <Table density="sm">
          <Table.Head>
            <Table.Row>
              {block.header.map((cell, i) => (
                <Table.HeadCell key={i}>
                  <InlineView nodes={cell} />
                </Table.HeadCell>
              ))}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {block.rows.map((row, r) => (
              <Table.Row key={r}>
                {row.map((cell, c) => (
                  <Table.Cell key={c}>
                    <InlineView nodes={cell} />
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      );
    case "rule":
      return <hr />;
  }
}

function InlineView({ nodes }: { nodes: Inline[] }): ReactNode {
  return nodes.map((n, i) => {
    switch (n.kind) {
      case "text":
        return n.text;
      case "code":
        return <code key={i}>{n.text}</code>;
      case "strong":
        return (
          <strong key={i}>
            <InlineView nodes={n.children} />
          </strong>
        );
      case "em":
        return (
          <em key={i}>
            <InlineView nodes={n.children} />
          </em>
        );
      case "link":
        return (
          <a key={i} href={n.href} target={n.href.startsWith("http") ? "_blank" : undefined} rel={n.href.startsWith("http") ? "noreferrer" : undefined}>
            <InlineView nodes={n.children} />
          </a>
        );
    }
  });
}
