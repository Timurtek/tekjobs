"use client";
import { Button } from "@/components/ui";
import { HERO, SCREENS } from "@/content";

export function Hero() {
  const shot = SCREENS[0] ?? { src: "/screens/today.png", alt: "Today", caption: "Today" };
  return (
    <section className="hero" id="top">
      <div className="wrap">
        <div className="hero__grid">
          <div className="hero__copy">
            <span className="eyebrow">{HERO.eyebrow}</span>
            <h1 className="hero__title">
              {HERO.title} <em>{HERO.titleEm}</em>
            </h1>
            <p className="hero__consequence">{HERO.consequence}</p>
            <p className="lead">{HERO.lead}</p>
            <p className="hero__coda">{HERO.coda}</p>
            <div className="hero__actions">
              <Button asChild tone="primary" size="lg">
                <a href="#get-started">Install TekJobs</a>
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
          {HERO.spec.map(([term, value]) => (
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
