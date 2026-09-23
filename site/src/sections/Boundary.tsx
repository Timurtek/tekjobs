import { BOUNDARY } from "@/content";

export function Boundary() {
  return (
    <section className="section" id="boundary">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">The boundary</span>
          <div className="section__head-text">
            <h2 className="title">What it will not do</h2>
            <p className="lead">A job search is a series of claims about things that happened to you. The software drafts and files; the claims stay yours.</p>
          </div>
        </div>
        <div className="cells cells--2">
          {BOUNDARY.map((b) => (
            <div key={b.title} className="cell">
              <h3 className="cell__title">{b.title}</h3>
              <p className="cell__body">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
