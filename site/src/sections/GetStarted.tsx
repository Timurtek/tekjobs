"use client";
import { Button, CodeBlock } from "@/components/ui";
import { INSTALL, REPO } from "@/content";

export function GetStarted() {
  return (
    <section className="section" id="get-started">
      <div className="wrap start">
        <div className="start__copy">
          <span className="eyebrow">Get started</span>
          <h2 className="title">Clone, import a resume, be interviewed</h2>
          <p>
            The interview runs through the app&apos;s own MCP server in the coding CLI you already have: it reads your resume, asks the few things a resume cannot say, writes your profile and criteria, and runs the first scan.
            After that a scheduled task does the mornings.
          </p>
          <p>Everything after the first scan is in the docs: the profile folder, scoring, mail, people, the copy panel, letters and resumes, and the 39 MCP tools.</p>
          <div className="hero__actions">
            <Button asChild tone="primary">
              <a href={REPO} target="_blank" rel="noreferrer">Open the repository</a>
            </Button>
            <Button asChild variant="ghost">
              <a href="/docs/getting-started">Getting started</a>
            </Button>
          </div>
        </div>
        <CodeBlock code={INSTALL} language="terminal" />
      </div>
    </section>
  );
}
