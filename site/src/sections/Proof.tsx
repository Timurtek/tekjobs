import { PROOF, REPO } from "@/content";

export function Proof() {
  return (
    <section className="section" id="proof">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Numbers</span>
          <div className="section__head-text">
            <h2 className="title">From one real search</h2>
            <p className="lead">
              The author's own vault, on 22 September 2026. The board registry that produces the first two numbers is in the repository as{" "}
              <a href={`${REPO}/blob/main/src/starter/companies-table.md`} target="_blank" rel="noreferrer">a markdown table</a>, and pull requests to it are the most useful contribution.
            </p>
          </div>
        </div>
        <div className="cells cells--4">
          {PROOF.map((p) => (
            <div key={p.title} className="cell proof__item">
              <span className="proof__figure">{p.figure}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
