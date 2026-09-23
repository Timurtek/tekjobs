import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocBody } from "@/components/DocBody";
import { allLegal, getLegal } from "@/lib/docs";

export function generateStaticParams() {
  return allLegal().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getLegal((await params).slug);
  return { title: doc ? doc.title : "Legal", description: doc?.summary };
}

/** Terms, privacy, refunds: the same reading layout as the docs, with the other two a click away and the date they last changed. */
export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getLegal(slug);
  if (!doc) notFound();
  const pages = allLegal();
  return (
    <section className="section docs">
      <div className="wrap docs__grid">
        <nav className="docs__nav" aria-label="Legal">
          <span className="eyebrow">Legal</span>
          <ul>
            {pages.map((d) => (
              <li key={d.slug}>
                <a href={`/legal/${d.slug}`} aria-current={d.slug === slug ? "page" : undefined}>{d.title}</a>
              </li>
            ))}
          </ul>
        </nav>
        <article className="docs__article">
          <header className="docs__head">
            <h1 className="title">{doc.title}</h1>
            {doc.summary && <p className="lead">{doc.summary}</p>}
            {doc.updated && <p className="mono muted">Last updated {doc.updated}</p>}
          </header>
          <DocBody text={doc.body} />
          <footer className="docs__foot">
            <span>Questions: <a href="mailto:hello@timurtek.com">hello@timurtek.com</a></span>
            <span>Timurtek LLC, Everett, Washington</span>
          </footer>
        </article>
      </div>
    </section>
  );
}
