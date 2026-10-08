"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { HERO, SHOWREEL } from "@/content";

/**
 * The first screen: the claim on the left, the showreel on the right. The reel plays muted while it is on
 * screen and pauses when it leaves; a visitor who asks for reduced motion gets the poster and the controls.
 */
export function Hero() {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) void v.play().catch(() => {}); else v.pause(); }, { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <section className="hero" id="top">
      <div className="wrap">
        <div className="hero__grid">
          <div className="hero__copy">
            <span className="eyebrow">{HERO.eyebrow}</span>
            {/* The accent span is styled as its own line, and some screen readers join adjacent inline boxes without a
                space; the label carries the whole sentence so it is read as one. */}
            <h1 className="hero__title" aria-label={`${HERO.title} ${HERO.titleEm}`}>
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
          <figure className="shot shot--hero" id="showreel">
            <div className="demo__frame">
              <video ref={video} controls muted loop playsInline preload="metadata" poster={SHOWREEL.poster} width={1920} height={1080} aria-label={SHOWREEL.alt}>
                <source src={SHOWREEL.src} type="video/mp4" />
              </video>
            </div>
            <figcaption>
              {SHOWREEL.title}. Sharing it? A <a href={SHOWREEL.vertical}>vertical cut</a> and a <a href={SHOWREEL.square}>square cut</a>.
            </figcaption>
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
