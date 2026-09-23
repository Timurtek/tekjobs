import { SCREENS } from "@/content";

/** The app as it runs on one real vault. Screenshots, not mockups. */
export function Screens() {
  return (
    <section className="section" id="screens">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">The app</span>
          <div className="section__head-text">
            <h2 className="title">Built to be read at a glance</h2>
            <p className="lead">Dark by default, one accent used sparingly, every number in mono. Filters are chips, views are links, and the sheet says why a job scored what it scored.</p>
          </div>
        </div>
        <div className="shots">
          {SCREENS.slice(1).map((s) => (
            <figure key={s.src} className="shot">
              <img src={s.src} alt={s.alt} loading="lazy" />
              <figcaption>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
