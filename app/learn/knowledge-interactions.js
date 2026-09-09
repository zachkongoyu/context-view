"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Search, X } from "lucide-react";
import { CATEGORIES, TERMS, searchTerms } from "../../lib/agent-knowledge";

const CHAPTERS = [
  ["agent-loop", "The loop"], ["boundaries", "The layers"], ["vocabulary", "Vocabulary"], ["distinctions", "Distinctions"], ["about", "Sources"],
];

export function GuideNavigation() {
  const [active, setActive] = useState("agent-loop");
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, { rootMargin: "-15% 0px -65% 0px" });
    CHAPTERS.forEach(([id]) => { const section = document.getElementById(id); if (section) observer.observe(section); });
    return () => observer.disconnect();
  }, []);
  return <nav className="guide-chapters" aria-label="Guide chapters"><span>EXPLORE THE GUIDE</span><div>{CHAPTERS.map(([id, label], index) => <a href={`#${id}`} key={id} aria-current={active === id ? "location" : undefined} onClick={() => setActive(id)}><span>0{index + 1}</span>{label}</a>)}</div><a className="guide-top" href="#learn-main" aria-label="Back to top">↑</a></nav>;
}

export function Glossary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const matches = searchTerms(query, category);
  return <div className="glossary">
    <div className="glossary-toolbar">
      <div className="glossary-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search agent concepts" placeholder="Search a concept or an alias…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear concept search" onClick={() => setQuery("")}><X size={15} /></button>}</div>
      <span className="glossary-count" aria-live="polite">{matches.length} of {TERMS.length} concepts</span>
    </div>
    <div className="glossary-filters" role="group" aria-label="Concept categories">
      {[{ id: "all", name: "All concepts" }, ...CATEGORIES].map((group) => <button type="button" key={group.id} aria-pressed={category === group.id} onClick={() => setCategory(group.id)}>{group.name}</button>)}
    </div>
    {!matches.length && <div className="glossary-empty"><Search size={25} /><h3>No matching concepts</h3><p>Try another term or choose All concepts to search every category.</p><button type="button" className="learn-button" onClick={() => { setQuery(""); setCategory("all"); }}>Show all concepts</button></div>}
    {CATEGORIES.map((group) => {
      const items = matches.filter((term) => term.category === group.id);
      if (!items.length) return null;
      return <section className="glossary-group" key={group.id} aria-labelledby={`category-${group.id}`}>
        <div className="glossary-group-heading"><span>{group.number}</span><h3 id={`category-${group.id}`}>{group.name}</h3><p>{group.caption}</p></div>
        <div className="glossary-grid">{items.map((term) => <Link className="concept-card" key={term.slug} href={`/learn/${term.slug}`}>
          <div><h4>{term.name}</h4><ArrowUpRight size={16} aria-hidden="true" /></div><p>{term.summary}</p><span className="concept-card-note">{term.varying ? "Meaning varies by framework" : `Related: ${term.related.slice(0, 2).map((id) => TERMS.find((t) => t.slug === id).name.toLowerCase()).join(" · ")}`}</span>
        </Link>)}</div>
      </section>;
    })}
  </div>;
}

export function CopyConceptLink({ url }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(url); setStatus("Link copied"); }
    catch { setStatus("Copy the URL from your address bar"); }
  }
  return <div className="concept-share"><button type="button" className="learn-copy" onClick={copy}>{status === "Link copied" ? <Check size={14} /> : <Copy size={14} />}Copy link</button><span role="status">{status}</span></div>;
}
