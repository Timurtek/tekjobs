import { STEPS } from "@/content";

export function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">How it works</span>
          <div className="section__head-text">
            <h2 className="title">Five moments, every day</h2>
            <p className="lead">A scheduled task does the first three before you wake up. The last two are yours, and the app keeps them short.</p>
          </div>
        </div>
        <ol className="cells cells--5">
          {STEPS.map((step) => (
            <li key={step.title} className="cell step">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
