import { WHO } from "@/content";

/** Who should install it and who should not, so a reader can rule themselves out before the install. */
export function WhoFor() {
  return (
    <section className="section" id="who">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Who it is for</span>
          <div className="section__head-text">
            <h2 className="title">{WHO.title}</h2>
            <p className="lead">{WHO.lead}</p>
          </div>
        </div>
        <div className="cells cells--2">
          <div className="cell">
            <h3 className="cell__title">{WHO.forTitle}</h3>
            <ul className="cell__list">
              {WHO.for.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="cell">
            <h3 className="cell__title">{WHO.notTitle}</h3>
            <ul className="cell__list">
              {WHO.not.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
