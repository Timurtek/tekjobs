"use client";
import { Button, CodeBlock } from "@/components/ui";
import { COUNTS, INSTALL, NPM } from "@/content";

export function GetStarted() {
  return (
    <section className="section" id="get-started">
      <div className="wrap start">
        <div className="start__copy">
          <span className="eyebrow">Get started</span>
          <h2 className="title">Install, import a resume, be interviewed</h2>
          <p>
            One command creates your profile folder and imports the resume. The interview then runs inside the AI client you already have: it reads the resume, asks the few things a resume cannot say, writes your profile and criteria, and runs the first scan.
            After that a scheduled task does the mornings.
          </p>
          <p>
            About twenty-five minutes end to end on a fresh machine, most of it the interview. Not ready to use your own resume? The repository ships a fictional profile folder to look around in first.
          </p>
          <p>Everything after the first scan is in the docs: the profile folder, scoring, mail, people, the copy panel, letters and resumes, and the {COUNTS.tools} MCP tools.</p>
          <div className="hero__actions">
            <Button asChild tone="primary">
              <a href="/docs/ai-clients">Connect your AI client</a>
            </Button>
            <Button asChild variant="soft">
              <a href="/docs/getting-started#a-look-before-you-commit">Look at the sample first</a>
            </Button>
            <Button asChild variant="ghost">
              <a href={NPM} target="_blank" rel="noreferrer">On npm</a>
            </Button>
          </div>
        </div>
        <CodeBlock code={INSTALL} language="terminal" />
      </div>
    </section>
  );
}
