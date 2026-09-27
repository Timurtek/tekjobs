"use client";
import { useEffect, useRef } from "react";
import { SHOWREEL } from "@/content";

/**
 * The showreel: 45 seconds of motion graphics, framed like the demo. It plays muted while it is on screen and
 * pauses when it leaves; visitors who ask for reduced motion get the poster and the controls, nothing moves.
 */
export function Showreel() {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.5 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <section className="section" id="showreel">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Showreel</span>
          <div className="section__head-text">
            <h2 className="title">{SHOWREEL.title}</h2>
            <p className="lead">{SHOWREEL.lead}</p>
          </div>
        </div>
        <div className="demo">
          <div className="demo__frame">
            <video ref={video} controls muted loop playsInline preload="metadata" poster={SHOWREEL.poster} width={1920} height={1080} aria-label={SHOWREEL.alt}>
              <source src={SHOWREEL.src} type="video/mp4" />
            </video>
          </div>
          <p className="demo__note">
            {SHOWREEL.note} Sharing it? There is a <a href={SHOWREEL.vertical}>vertical cut</a> and a <a href={SHOWREEL.square}>square cut</a>.
          </p>
          <details className="demo__transcript">
            <summary>Transcript</summary>
            <ol>
              {SHOWREEL.transcript.map((line) => (
                <li key={line.slice(0, 24)}>{line}</li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </section>
  );
}
