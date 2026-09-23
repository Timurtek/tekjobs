import { CodeBlock as UiCodeBlock } from "@/components/ui";

/** The system's CodeBlock, with the page's older `title` name kept for the label. */
export function CodeBlock({ title, wrap = false, children }: { title?: string; wrap?: boolean; children: string }) {
  return <UiCodeBlock code={children} language={title} wrap={wrap} />;
}
