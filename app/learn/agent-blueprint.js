import Link from "next/link";
import { ArrowUpRight, Braces, Cpu, Database, Layers2, Orbit } from "lucide-react";

export function AgentBlueprint() {
  return <div className="agent-blueprint" aria-label="Agent building blocks: explore a connected concept">
    <div className="blueprint-caption"><span><i />SYSTEM MAP</span><span>FIG. 001</span></div>
    <div className="blueprint-field">
      <svg className="blueprint-wires" viewBox="0 0 500 360" fill="none" aria-hidden="true">
        <circle cx="250" cy="180" r="124" className="blueprint-orbit" />
        <circle cx="250" cy="180" r="91" className="blueprint-orbit inner" />
        <path className="wire" d="M108 85H185Q205 85 205 105V155Q205 180 230 180H270Q295 180 295 155V105Q295 85 315 85H392M108 275H185Q205 275 205 255V205Q205 180 230 180H270Q295 180 295 205V255Q295 275 315 275H392" />
        <path className="wire-signal" d="M108 85H185Q205 85 205 105V155Q205 180 230 180H270Q295 180 295 205V255Q295 275 315 275H392" />
        <path d="M250 30V50M240 40H260M250 310V330M240 320H260M42 180H62M52 170V190M438 180H458M448 170V190" className="blueprint-cross" />
      </svg>
      <Link href="/learn/agent-loop" className="blueprint-core"><span><Orbit size={32} strokeWidth={1.2} /></span><strong>Agent loop</strong><small>decide · act · observe</small><ArrowUpRight className="blueprint-core-arrow" size={13} /></Link>
      <Link href="/learn/context" className="blueprint-node blueprint-context"><Layers2 size={19} /><span><small>INPUT</small><strong>Context</strong></span><ArrowUpRight size={12} /></Link>
      <Link href="/learn/model" className="blueprint-node blueprint-model"><Cpu size={19} /><span><small>INFERENCE</small><strong>Model</strong></span><ArrowUpRight size={12} /></Link>
      <Link href="/learn/memory" className="blueprint-node blueprint-memory"><Database size={19} /><span><small>CONTINUITY</small><strong>Memory</strong></span><ArrowUpRight size={12} /></Link>
      <Link href="/learn/tool" className="blueprint-node blueprint-tool"><Braces size={19} /><span><small>ACTION</small><strong>Tools</strong></span><ArrowUpRight size={12} /></Link>
    </div>
    <div className="blueprint-bottom"><span>Connected concepts, made visible.</span><span>Choose a node <ArrowUpRight size={12} /></span></div>
  </div>;
}

export function LearningPaths({ count }) {
  return <div className="learning-paths" aria-label="Ways to explore">
    <a className="learning-path path-vocabulary" href="#vocabulary">
      <div className="path-top"><span>01 / THE BUILDING BLOCKS</span><ArrowUpRight size={19} /></div>
      <div className="path-art vocabulary-art" aria-hidden="true"><span>{count}</span><div><b>message</b><b>turn</b><b>session</b></div></div>
      <h2>Learn the language.</h2><p>Clear definitions for the pieces of an agent.</p>
    </a>
    <a className="learning-path path-loop" href="#agent-loop">
      <div className="path-top"><span>02 / THE PROCESS</span><ArrowUpRight size={19} /></div>
      <div className="path-art process-art" aria-hidden="true"><i /><span /><i /><span /><i /><span /><i /></div>
      <h2>Follow the loop.</h2><p>Move through a request, one decision at a time.</p>
    </a>
    <Link className="learning-path path-trace" href="/?view=trace">
      <div className="path-top"><span>03 / THE EVIDENCE</span><ArrowUpRight size={19} /></div>
      <div className="path-art trace-art" aria-hidden="true"><i /><i /><i /><i /><span>trace →</span></div>
      <h2>Look inside a run.</h2><p>Open the inspector and explore real event data.</p>
    </Link>
  </div>;
}
