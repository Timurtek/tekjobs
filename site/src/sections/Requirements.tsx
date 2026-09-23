import { REQUIREMENTS } from "@/content";

export function Requirements() {
  return (
    <section className="section" id="requirements">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Requirements</span>
          <div className="section__head-text">
            <h2 className="title">What it needs from you</h2>
            <p className="lead">Nothing personal lives in the repository. Your profile folder, criteria, notes and mail state are outside it; the repository is the code and the starter notes.</p>
          </div>
        </div>
        <dl className="reqs">
          {REQUIREMENTS.map(([term, body]) => (
            <div key={term} className="reqs__row">
              <dt>{term}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
