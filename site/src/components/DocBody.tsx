"use client";
import { Markdown } from "@/components/ui";

/** The system's Markdown renderer, which needs the client for its tables and code blocks. */
export function DocBody({ text }: { text: string }) {
  return (
    <div className="doc">
      <Markdown text={text} />
    </div>
  );
}
