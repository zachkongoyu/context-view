import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen } from "lucide-react";
import { CATEGORIES, SITE_URL, SOURCES, TERMS, getTerm } from "../../../lib/agent-knowledge";
import { CopyConceptLink } from "../knowledge-interactions";

export function generateStaticParams() { return TERMS.map((term) => ({ slug: term.slug })); }
export const dynamicParams = false;

export async function generateMetadata({ params }) {
  const term = getTerm((await params).slug);
  if (!term) return {};
  return { title: `${term.name} — Agent field guide · Context View`, description: term.summary, alternates: { canonical: `${SITE_URL}/learn/${term.slug}` }, openGraph: { title: `${term.name} explained`, description: term.summary, url: `${SITE_URL}/learn/${term.slug}`, type: "article" } };
}

export default async function ConceptPage({ params }) {
  const term = getTerm((await params).slug);
  if (!term) notFound();
  const category = CATEGORIES.find((item) => item.id === term.category);
  const index = TERMS.indexOf(term);
  const next = TERMS[index + 1];
  const previous = TERMS[index - 1];
  return <div className="knowledge-layout concept-layout">
    <aside className="learn-sidebar concept-sidebar" aria-label="Concept navigation">
      <Link className="learn-back-link" href="/learn#vocabulary"><ArrowLeft size={14} />All concepts</Link>
      <nav>{CATEGORIES.map((group) => <div className="concept-nav-group" key={group.id}><span>{group.number} / {group.name}</span>{TERMS.filter((item) => item.category === group.id).map((item) => <Link href={`/learn/${item.slug}`} key={item.slug} aria-current={term.slug === item.slug ? "page" : undefined}>{item.name}</Link>)}</div>)}</nav>
    </aside>
    <main id="learn-main" className="knowledge-main concept-main">
      <nav className="learn-breadcrumbs" aria-label="Breadcrumb"><Link href="/learn">Learn</Link><span>/</span><Link href="/learn#vocabulary">{category.name}</Link><span>/</span><span aria-current="page">{term.name}</span></nav>
      <article>
        <header className="concept-heading"><div className="learn-eyebrow">{category.number} / {category.name}{term.varying && <span className="concept-varies">Meaning varies</span>}</div><h1>{term.name}<span>.</span></h1><p className="concept-summary">{term.summary}</p><div className="concept-heading-footer"><span>Agent foundations · Concept reference</span><CopyConceptLink url={`${SITE_URL}/learn/${term.slug}`} /></div></header>
        <div className="concept-article-content">
          <section aria-labelledby="definition"><h2 id="definition">Working definition</h2><p>{term.definition}</p></section>
          <section className="concept-example" aria-labelledby="example"><div><span className="learn-eyebrow">In practice</span><h2 id="example">A concrete example</h2></div>{term.code ? <pre>{term.example}</pre> : <p>{term.example}</p>}<small>Illustrative example · field names may differ across APIs</small></section>
          <section className="concept-boundary" aria-labelledby="boundary"><span className="concept-boundary-mark" aria-hidden="true">↔</span><div><h2 id="boundary">Keep the boundary clear</h2><p>{term.boundary}</p></div></section>
          <section aria-labelledby="aliases"><h2 id="aliases">Names you may encounter</h2><div className="concept-aliases">{term.aliases.map((alias) => <span key={alias}>{alias}</span>)}</div><p className="concept-caption">Related labels in use. These are not guaranteed to mean exactly the same thing in every framework.</p></section>
          <section aria-labelledby="related"><h2 id="related">Connected concepts</h2><div className="concept-related">{term.related.map((id) => { const related = getTerm(id); return <Link href={`/learn/${id}`} key={id}><strong>{related.name}<ArrowUpRight size={15} /></strong><span>{related.summary}</span></Link>; })}</div></section>
          <section className="concept-references" aria-labelledby="references"><h2 id="references">Sources & terminology</h2><p>Context View's definition is an editorial synthesis. These primary references describe the underlying concepts and framework-specific behavior.</p>{term.sources.map((id) => <a key={id} href={SOURCES[id].url} target="_blank" rel="noreferrer"><BookOpen size={16} /><div><strong>{SOURCES[id].title}</strong><span>{SOURCES[id].publisher}</span></div><ArrowUpRight size={15} /></a>)}<small>Reviewed 9 September 2026 · <Link href="/learn#about">About this vocabulary</Link></small></section>
        </div>
      </article>
      <nav className="concept-pagination" aria-label="Continue learning">{previous ? <Link href={`/learn/${previous.slug}`}><span><ArrowLeft size={13} />Previous concept</span><strong>{previous.name}</strong></Link> : <span />}{next ? <Link href={`/learn/${next.slug}`}><span>Next concept<ArrowRight size={13} /></span><strong>{next.name}</strong></Link> : <Link href="/learn"><span>Back to the guide<ArrowRight size={13} /></span><strong>Agent foundations</strong></Link>}</nav>
    </main>
  </div>;
}
