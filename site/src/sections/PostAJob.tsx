"use client";
import { Badge, Button } from "@/components/ui";
import { POSTING } from "@/content";

/**
 * For employers: what a posting is here, and what it is not. The same four steps the Post a job page walks
 * through, with the price in the open and the honest note that it is not on sale yet when it is not.
 */
export function PostAJob({ open }: { open: boolean }) {
  return (
    <section className="section" id="post">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">For employers</span>
          <div className="section__head-text">
            <h2 className="title">Post a job where the reader runs the search</h2>
            <p className="lead">
              TekJobs users do not browse a board. Their software reads hundreds of them every morning and scores each posting against criteria they wrote. A posting here is one more source in that scan: no inbox blast, no promoted slot, no list of who looked. The people it fits find it, with the reasons.
            </p>
          </div>
        </div>
        <ol className="cells cells--4">
          {POSTING.steps.map((s) => (
            <li key={s.title} className="cell step">
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="posting">
          <div className="posting__offer">
            <span className="posting__price"><span className="num">{POSTING.price}</span> <small>for {POSTING.term}</small></span>
            <p className="muted">One posting, paid once. It runs for {POSTING.term} or until you close it.</p>
            <div className="hero__actions">
              <Button asChild tone="primary" size="lg">
                <a href="/post-a-job">Post a job</a>
              </Button>
              <Button asChild variant="ghost">
                <a href="/legal/terms#3-job-postings">The posting rules</a>
              </Button>
              {!open && <Badge tone="neutral" variant="outline">Opening soon</Badge>}
            </div>
          </div>
          <div className="posting__tips">
            <span className="eyebrow">What scores well here</span>
            <ul className="posting__list">
              {POSTING.scoresWell.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
