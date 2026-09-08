"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Copy, CornerDownLeft, Search, X } from "lucide-react";
import { CATEGORIES, LOOP_STAGES, SOURCES, TERMS, searchTerms } from "../../lib/agent-knowledge";

export function LoopExplorer() {
  const [selected, setSelected] = useState("model");
  const stage = LOOP_STAGES.find((item) => item.id === selected);
  return <div className="loop-explorer">
    <div className="loop-canvas">
      <div className="loop-start"><span className="learn-status-dot" />A request arrives</div>
      <div className="loop-flow" aria-label="Explore the agent loop">
        {LOOP_STAGES.slice(0, 4).map((item, index) => <div className="loop-node-wrap" key={item.id}>
          <button className="loop-node" type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
            <span className="loop-node-number">0{index + 1}</span><strong>{item.name}</strong><small>{item.actor}</small>
          </button>
          {index < 3 && <ArrowRight className="loop-next-arrow" size={17} aria-hidden="true" />}
        </div>)}
      </div>
      <div className="loop-return"><CornerDownLeft size={16} aria-hidden="true" /><span>Results return to context for the next model call</span></div>
      <div className="loop-exit"><span>From the model, when ready</span><ArrowDown size={15} aria-hidden="true" /><button type="button" aria-pressed={selected === "finish"} onClick={() => setSelected("finish")}><Check size={15} />Return an answer</button></div>
    </div>
    <div className="loop-explanation" aria-live="polite" aria-atomic="true">
      <div><span className="learn-eyebrow">{stage.actor}</span><h3>{stage.name}</h3><p>{stage.description}</p><Link className="learn-text-link" href={`/learn/${stage.term}`}>Explore the definition <ArrowUpRight size={14} /></Link></div>
      <div className="loop-example"><span>Order assistant · illustrative example</span><pre>{stage.example}</pre></div>
    </div>
    <div className="loop-footnote">Select a stage to explore it. This shows a common tool-using loop; runtimes can also branch, pause, or run work in parallel. <a href={SOURCES.tools.url} target="_blank" rel="noreferrer">Tool-use reference ↗</a></div>
  </div>;
}

export function Glossary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const matches = searchTerms(query, category);
  return <div className="glossary">
    <div className="glossary-toolbar">
      <label className="glossary-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search agent concepts</span><input type="search" placeholder="Search a concept or an alias…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear concept search" onClick={() => setQuery("")}><X size={15} /></button>}</label>
      <span className="glossary-count" aria-live="polite">{matches.length} of {TERMS.length} concepts</span>
    </div>
    <div className="glossary-filters" role="group" aria-label="Concept categories">
      {[{ id: "all", name: "All concepts" }, ...CATEGORIES].map((group) => <button type="button" key={group.id} aria-pressed={category === group.id} onClick={() => setCategory(group.id)}>{group.name}</button>)}
    </div>
    {!matches.length && <div className="glossary-empty"><Search size={25} /><h3>No matching concepts</h3><p>Try “message,” “session,” or an alias such as “LLM.”</p><button type="button" className="learn-button" onClick={() => { setQuery(""); setCategory("all"); }}>Show all concepts</button></div>}
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
