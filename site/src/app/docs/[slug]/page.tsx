import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocBody } from "@/components/DocBody";
import { allDocs, getDoc } from "@/lib/docs";
import { REPO } from "@/content";

export function generateStaticParams() {
  return allDocs().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getDoc((await params).slug);
  return { title: doc ? doc.title : "Docs", description: doc?.summary };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  const docs = allDocs();
  const i = docs.findIndex((d) => d.slug === slug);
  const prev = i > 0 ? docs[i - 1] : null;
  const next = i >= 0 && i < docs.length - 1 ? docs[i + 1] : null;
  return (
    <section className="section docs">
      <div className="wrap docs__grid">
        <nav className="docs__nav" aria-label="Docs">
          <span className="eyebrow">Docs</span>
          <ul>
            {docs.map((d) => (
              <li key={d.slug}>
                <a href={`/docs/${d.slug}`} aria-current={d.slug === slug ? "page" : undefined}>{d.title}</a>
              </li>
            ))}
          </ul>
        </nav>
        <article className="docs__article">
          <header className="docs__head">
            <h1 className="title">{doc.title}</h1>
            {doc.summary && <p className="lead">{doc.summary}</p>}
          </header>
          <DocBody text={doc.body} />
          <footer className="docs__foot">
            <span>{prev ? <a href={`/docs/${prev.slug}`}>← {prev.title}</a> : null}</span>
            <a href={`${REPO}/edit/main/site/content/docs/${slug}.md`} target="_blank" rel="noreferrer">Edit this page</a>
            <span>{next ? <a href={`/docs/${next.slug}`}>{next.title} →</a> : null}</span>
          </footer>
        </article>
      </div>
    </section>
  );
}
