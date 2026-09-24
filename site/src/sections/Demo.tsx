import { DEMO } from "@/content";

/** One recording: install, interview, first scan, the first Today. Recorded from a real run on the sample resume. */
export function Demo() {
  return (
    <section className="section" id="demo">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">See it run</span>
          <div className="section__head-text">
            <h2 className="title">{DEMO.title}</h2>
            <p className="lead">{DEMO.lead}</p>
          </div>
        </div>
        <div className="demo">
          <div className="demo__frame">
            <video controls playsInline preload="metadata" poster={DEMO.poster} width={1440} height={900} aria-label={DEMO.alt}>
              <source src={DEMO.src} type="video/mp4" />
            </video>
          </div>
          <p className="demo__note">{DEMO.note}</p>
          <details className="demo__transcript">
            <summary>Transcript</summary>
            <ol>
              {DEMO.transcript.map((line) => (
                <li key={line.slice(0, 24)}>{line}</li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </section>
  );
}
