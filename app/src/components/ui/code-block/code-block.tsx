/* zengin-owned CodeBlock, forked from @zenginui/ui@0.1.0, sha 01f473b3ec57 */
import { forwardRef, useState, type HTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { Button } from "../button/button";

export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  code: string;
  /** Shown in the header; no highlighting is applied, so it is a label, not a mode. */
  language?: string;
  /** A copy button in the header. Default true. */
  showCopy?: boolean;
  /** Wrap long lines instead of scrolling: for commands and prose-like snippets in narrow places. */
  wrap?: boolean;
}

/** Code as a model or a document presents it: monospace, scrollable, a language label, one-click copy. */
export const CodeBlock = forwardRef<HTMLDivElement, CodeBlockProps>(function CodeBlock({ code, language, showCopy = true, wrap = false, className, ...rest }, ref) {
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the button simply does nothing visible.
    }
  };
  return (
    <div ref={ref} className={cx("z-codeblock", className)} data-wrap={wrap || undefined} {...rest}>
      {(language || showCopy) && (
        <div className="z-codeblock__head">
          <span className="z-codeblock__language">{language ?? ""}</span>
          {showCopy && (
            <Button variant="ghost" size="sm" className="z-codeblock__copy" onClick={copy} aria-live="polite">
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </div>
      )}
      <pre className="z-codeblock__pre">
        <code>{code}</code>
      </pre>
    </div>
  );
});
