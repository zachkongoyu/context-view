import Link from "next/link";
import { ArrowRight, ArrowUpRight, CircleHelp } from "lucide-react";
import { CATEGORIES, COMPARISONS, SITE_URL, SOURCES, TERMS, getTerm } from "../../lib/agent-knowledge";
import { Glossary, GuideNavigation, LoopExplorer } from "./knowledge-interactions";
import { AgentBlueprint, LearningPaths } from "./agent-blueprint";

export const metadata = {
  title: "Agent foundations — Context View",
  description: "An illustrated field guide to agent loops, messages, turns, sessions, conversations, components, and traces. Clear definitions with examples and primary sources.",
  alternates: { canonical: `${SITE_URL}/learn` },
  openGraph: { title: "The anatomy of an agent", description: "A shared vocabulary for understanding agent systems.", url: `${SITE_URL}/learn`, type: "website" },
};

export default function LearnPage() {
  return <div className="knowledge-layout guide-layout">
    <main id="learn-main" className="knowledge-main">
      <section className="learn-hero">
        <div className="learn-hero-copy">
        <div className="learn-eyebrow"><span className="learn-status-dot" />The field guide <span className="learn-eyebrow-separator">/</span> Agent foundations</div>
        <h1>The anatomy<br />of an <span>agent<span className="hero-period">.</span></span></h1>
        <p>A shared vocabulary for the pieces, boundaries, and loops behind agent systems. Start with what happens, then put a name to each part.</p>
        <div className="learn-hero-actions"><a className="learn-button" href="#agent-loop">Explore the loop <ArrowRight size={16} /></a><a className="learn-text-link" href="#vocabulary">Browse {TERMS.length} concepts <ArrowDownIcon /></a></div>
        <div className="learn-hero-meta"><span>{TERMS.length} concepts</span><span>{CATEGORIES.length} connected layers</span><span>Built on primary sources</span></div>
        </div>
        <AgentBlueprint />
      </section>

      <LearningPaths count={TERMS.length} />
      <GuideNavigation />

      <section id="agent-loop" className="learn-section">
        <div className="learn-section-heading"><div><span className="learn-eyebrow">01 / Follow the work</span><h2>The loop at the center.</h2></div><span className="learn-interactive-badge">Interactive</span></div>
        <p className="learn-section-intro">An agent connects a model's decisions to actions and feedback. Explore a simple order-status request, one stage at a time.</p>
        <LoopExplorer />
      </section>

      <section id="boundaries" className="learn-section">
        <div className="learn-section-heading"><div><span className="learn-eyebrow">02 / Keep the boundaries clear</span><h2>One request. Several layers.</h2></div></div>
        <p className="learn-section-intro">These describe different views of the same work. They do not form a universal nesting hierarchy.</p>
        <div className="boundary-example">
          <div className="boundary-conversation"><span className="learn-eyebrow">Conversation / Order A104</span><span>Continues across follow-up questions</span></div>
          <div className="boundary-turn"><div className="boundary-turn-label"><Link href="/learn/turn">User-facing turn 1 <ArrowUpRight size={12} /></Link><span>One run in this example</span></div>
            <ol className="boundary-records"><li><span className="record-role role-user">User</span><p>Has order A104 shipped?</p><small>Message</small></li><li><span className="record-role role-assistant">Model</span><p>Request <code>lookup_order("A104")</code></p><small>Model call 1 → tool call</small></li><li><span className="record-role role-tool">Tool</span><p>Status: shipped</p><small>Tool result</small></li><li><span className="record-role role-assistant">Model</span><p>Yes, order A104 has shipped.</p><small>Model call 2 → message</small></li></ol>
          </div>
          <div className="boundary-follow-up"><span>Turn 2</span><p>“When will it arrive?”</p><small>The same conversation continues</small></div>
          <div className="boundary-note"><CircleHelp size={17} /><p>A <Link href="/learn/session">session</Link> can carry continuity between these requests. A <Link href="/learn/trace">trace</Link> records how each execution unfolded. Their exact scopes depend on the application. <a href={SOURCES.running.url} target="_blank" rel="noreferrer">Runtime reference ↗</a></p></div>
        </div>
      </section>

      <section id="vocabulary" className="learn-section">
        <div className="learn-section-heading"><div><span className="learn-eyebrow">03 / Name the pieces</span><h2>The agent vocabulary.</h2></div><span className="learn-section-number">{TERMS.length} concepts</span></div>
        <p className="learn-section-intro">From small records to complete systems. Every concept has a definition, example, boundary note, and related reading.</p>
        <Glossary />
      </section>

      <section id="distinctions" className="learn-section">
        <div className="learn-section-heading"><div><span className="learn-eyebrow">04 / Often confused</span><h2>Similar words. Different questions.</h2></div></div>
        <div className="comparison-grid">{COMPARISONS.map((item) => <article className="comparison-card" key={item.title}><h3>{item.title}</h3><p>{item.text}</p><div><Link href={`/learn/${item.left}`}>{getTerm(item.left).name} <ArrowUpRight size={13} /></Link><Link href={`/learn/${item.right}`}>{getTerm(item.right).name} <ArrowUpRight size={13} /></Link></div></article>)}</div>
      </section>

      <section id="about" className="learn-section learn-about">
        <span className="learn-eyebrow">05 / How to read this guide</span><h2>A common language, with the differences visible.</h2>
        <p>These are Context View's working definitions, synthesized from primary documentation. There is no single vocabulary shared by every agent framework. Notes on each page identify important differences, especially around turns, runs, threads, and sessions.</p>
        <p>“Atoms” is our learning label for small records. “Component” describes a responsibility; “module” describes a packaged implementation. These categories organize the guide and do not prescribe how every agent must be built.</p>
        <div className="learn-review-date">Reviewed 9 September 2026 <span>•</span> Examples are illustrative, not provider-specific API contracts.</div>
        <div className="learn-sources">{Object.entries(SOURCES).map(([id, source]) => <a key={id} href={source.url} target="_blank" rel="noreferrer"><span>{source.publisher}</span><strong>{source.title}</strong><ArrowUpRight size={14} /></a>)}</div>
      </section>
    </main>
  </div>;
}

function ArrowDownIcon() { return <span aria-hidden="true">↓</span>; }
