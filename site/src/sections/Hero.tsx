"use client";
import { Button } from "@/components/ui";
import { SCREENS } from "@/content";

/** The facts on the sheet. Each is a number the repository or one real scan log can back. */
const SPEC = [
  ["Boards watched", "356"],
  ["Postings a run", "25k"],
  ["MCP tools", "39"],
  ["Accounts", "0"],
] as const;

export function Hero() {
  const shot = SCREENS[0] ?? { src: "/screens/today.png", alt: "Today", caption: "Today" };
  return (
    <section className="hero" id="top">
      <div className="wrap">
        <div className="hero__grid">
          <div className="hero__copy">
            <span className="eyebrow">Local-first job search</span>
            <h1 className="hero__title">
              Your search. <em>Your notes.</em>
            </h1>
            <p className="hero__consequence">Stop refreshing forty job boards and losing track of what you sent where.</p>
            <p className="lead">
              TekJobs watches hundreds of company boards every morning, scores every posting against criteria you own, and files each match as a markdown note in a folder on your machine.
              It reads your mail for replies, drafts the resume and the letter from your own resume, and stops before anything is sent. The LLM is the coding CLI you already pay for.
            </p>
            <div className="hero__actions">
              <Button asChild tone="primary" size="lg">
                <a href="#get-started">Get started</a>
              </Button>
              <Button asChild variant="soft" size="lg">
                <a href="/docs/getting-started">Read the docs</a>
              </Button>
            </div>
          </div>
          <figure className="shot shot--hero">
            <img src={shot.src} alt={shot.alt} loading="eager" />
          </figure>
        </div>
        <dl className="spec" aria-label="At a glance">
          {SPEC.map(([term, value]) => (
            <div key={term} className="spec__cell">
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
