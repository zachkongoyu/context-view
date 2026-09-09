"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Braces, Check, CornerDownLeft, Database, Layers2, MessageSquare, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { getTerm } from "../../lib/agent-knowledge";
import { createLabSteps } from "../../lib/agent-lab";

const NODES = [
  { id: "context", term: "context", name: "Context", caption: "What the model sees", Icon: Layers2 },
  { id: "tool", term: "tool", name: "Tools", caption: "How it takes action", Icon: Braces },
  { id: "memory", term: "memory", name: "Memory", caption: "What can carry forward", Icon: Database },
  { id: "answer", term: "message", name: "Answer", caption: "Back to the user", Icon: MessageSquare },
];

export function AgentLab() {
  const [scenario, setScenario] = useState("success");
  const [followUp, setFollowUp] = useState(false);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const reduceMotion = useReducedMotion();
  const feedRef = useRef(null);
  const steps = createLabSteps(scenario, followUp);
  const step = steps[position];
  const term = getTerm(selectedTerm || step.term);
  const ended = position === steps.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (ended) { setPlaying(false); return; }
    const timer = setTimeout(() => setPosition((current) => current + 1), 2100);
    return () => clearTimeout(timer);
  }, [playing, position, ended]);

  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior: reduceMotion ? "instant" : "smooth" });
  }, [position, scenario, reduceMotion]);

  function seek(value) {
    setPlaying(false); setPosition(value); setSelectedTerm(null); setSelectedRecord(null);
  }
  function chooseScenario(value) {
    setScenario(value); setFollowUp(false); seek(0);
  }
  function inspect(slug, id = null) {
    setSelectedTerm(slug); setSelectedRecord(id); setPlaying(false);
  }
  function play() {
    if (ended) setPosition(0);
    setSelectedTerm(null); setSelectedRecord(null); setPlaying(!playing);
  }
  function addFollowUp() {
    setFollowUp(true); seek(6);
  }

  return <div className="agent-lab" data-scenario={scenario}>
    <div className="lab-toolbar">
      <div className="lab-scenario" role="group" aria-label="Example scenario"><span>TRY A SCENARIO</span><button type="button" aria-pressed={scenario === "success"} onClick={() => chooseScenario("success")}>Order lookup</button><button type="button" aria-pressed={scenario === "failure"} onClick={() => chooseScenario("failure")}>Tool failure</button></div>
      <button className="lab-play" type="button" onClick={play}>{playing ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}{playing ? "Pause" : ended ? "Replay the run" : position === 0 ? "Run the example" : "Resume"}</button>
    </div>

    <div className="lab-workspace">
      <div className={`lab-canvas ${playing ? "is-playing" : ""}`} data-active={step.node}>
        <div className="lab-canvas-heading"><span><i />INSIDE THE LOOP</span><span>ILLUSTRATIVE SIMULATION</span></div>
        <span className="lab-watermark" aria-hidden="true">0{position + 1}</span>
        <div className="lab-network" aria-label="Agent components">
          <svg className="lab-connections" viewBox="0 0 700 370" fill="none" aria-hidden="true">
            <defs><linearGradient id="lab-wire-gradient"><stop stopColor="#bdacf9" /><stop offset=".5" stopColor="#ffab84" /><stop offset="1" stopColor="#96dadd" /></linearGradient></defs>
            <path className={`lab-wire ${step.node === "context" ? "active" : ""}`} d="M165 125H350" />
            <path className={`lab-wire ${step.node === "tool" || position === 2 ? "active" : ""}`} d="M350 125H535" />
            <path className={`lab-wire ${step.node === "memory" ? "active" : ""}`} d="M165 285H235Q260 285 260 260V190Q260 125 350 125" />
            <path className={`lab-wire ${step.node === "answer" ? "active" : ""}`} d="M350 125Q440 125 440 190V260Q440 285 465 285H535" />
            <path className={`lab-return-wire ${position === 4 ? "active" : ""}`} d="M535 150V205Q535 225 515 225H185Q165 225 165 205V150" />
          </svg>
          <button className={`lab-model ${step.node === "model" ? "active" : ""}`} type="button" onClick={() => inspect("model")} aria-label="Explore the model definition" aria-pressed={selectedTerm === "model"}>
            <span className="lab-orb" aria-hidden="true"><svg viewBox="0 0 180 180"><defs><radialGradient id="lab-orb-fill" cx="30%" cy="20%"><stop stopColor="#fff0cc" /><stop offset=".42" stopColor="#f8a282" /><stop offset=".75" stopColor="#c26072" /><stop offset="1" stopColor="#592946" /></radialGradient><clipPath id="lab-orb-clip"><circle cx="90" cy="90" r="77" /></clipPath></defs><circle cx="90" cy="90" r="77" fill="url(#lab-orb-fill)" /><g clipPath="url(#lab-orb-clip)" fill="none" stroke="#fff4dc" strokeWidth=".65" opacity=".6">{Array.from({length:9}, (_,i) => <ellipse key={i} cx="90" cy="90" rx={12 + i * 8} ry="77" transform="rotate(-28 90 90)" />)}{Array.from({length:7}, (_,i) => <ellipse key={i} cx="90" cy={38 + i * 17} rx="77" ry="18" transform="rotate(-28 90 90)" />)}</g></svg></span>
            <span className="lab-model-label">The model <ArrowUpRight size={12} /></span>
          </button>
          {NODES.map(({ id, name, caption, Icon, term: slug }) => <button key={id} className={`lab-node lab-node-${id} ${step.node === id ? "active" : ""}`} type="button" onClick={() => inspect(slug)} aria-pressed={selectedTerm === slug} aria-label={`Explore ${name.toLowerCase()}`}><span className="lab-node-icon"><Icon size={21} strokeWidth={1.5} /></span><strong>{name}</strong><small>{caption}</small><ArrowUpRight className="lab-node-arrow" size={12} /></button>)}
          <div className="lab-return-label"><CornerDownLeft size={12} />Results become context</div>
        </div>
        <div className="lab-canvas-footer"><span>ONE SYSTEM. DIFFERENT RESPONSIBILITIES.</span><span>Click a piece to look inside <ArrowUpRight size={12} /></span></div>
      </div>

      <div className="lab-records">
        <div className="lab-records-heading"><div><span className="lab-kicker">THE CONVERSATION</span><h3>Watch the records grow<span>.</span></h3></div><span className="lab-record-count">{step.records.length}</span></div>
        <div className="lab-record-feed" ref={feedRef} aria-label="Example records">
          <AnimatePresence initial={false}>{step.records.map((item, index) => <motion.div key={item.id} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .22 }}>
            {(index === 0 || step.records[index - 1].turn !== item.turn) && <button className="lab-turn-boundary" type="button" onClick={() => inspect("turn")}><span />TURN 0{item.turn}<span /></button>}
            <button className={`lab-record lab-record-${item.role} ${selectedRecord === item.id ? "selected" : ""}`} type="button" onClick={() => inspect(item.term, item.id)} aria-pressed={selectedRecord === item.id}><span className="lab-record-meta"><span>{item.role === "error" ? "Tool · error" : item.role === "assistant" ? "Assistant" : item.role === "user" ? "User" : "Tool"}</span><span>{item.kind} <ArrowUpRight size={10} /></span></span><span className="lab-record-text">{item.text}</span></button>
          </motion.div>)}</AnimatePresence>
          {!ended && <div className="lab-next-record"><span>···</span>{playing ? "Following the run…" : "Press play or step forward"}</div>}
          {ended && <div className="lab-run-ended"><Check size={13} />Turn {step.turn} complete{scenario === "success" && !followUp && <button type="button" onClick={addFollowUp}>Ask a follow-up <ArrowRight size={13} /></button>}</div>}
        </div>
        <div className="lab-session"><Database size={12} /><button type="button" onClick={() => inspect("session")}>Session: order-demo</button><span>History retained</span></div>
      </div>
    </div>

    <div className="lab-transport">
      <div className="lab-transport-buttons"><button type="button" onClick={() => seek(0)} aria-label="Restart example"><RotateCcw size={15} /></button><button type="button" disabled={position === 0} onClick={() => seek(position - 1)} aria-label="Previous step"><ArrowLeft size={16} /></button><button type="button" disabled={ended} onClick={() => seek(position + 1)} aria-label="Next step"><ArrowRight size={16} /></button></div>
      <span className="lab-step-count">0{position + 1} <span>/ 0{steps.length}</span></span><input type="range" min="0" max={steps.length - 1} value={position} onChange={(event) => seek(Number(event.target.value))} aria-label="Execution step" aria-valuetext={`Step ${position + 1}: ${step.title}`} />
      <div className="lab-counters"><span><b>{step.modelCalls}</b> model calls</span><span><b>{step.toolCalls}</b> tool calls</span></div>
    </div>
    <div className="lab-explanation" aria-live="polite" aria-atomic="true"><span className="lab-kicker">WHAT’S HAPPENING</span><div><h3>{step.title}</h3><p>{step.text}</p></div></div>

    <div className="lab-definition" aria-live="polite" aria-atomic="true" data-category={term.category}>
      <div className="lab-definition-label"><Sparkles size={16} /><span>IN FOCUS</span></div><div><Link href={`/learn/${term.slug}`}><h3>{term.name}</h3><ArrowUpRight size={17} /></Link><p>{term.summary}</p></div><Link className="lab-definition-link" href={`/learn/${term.slug}`}>Read the definition <ArrowRight size={14} /></Link>
    </div>
    <p className="lab-disclosure">A scripted example, not a live AI response. Playback steps are for teaching; they are not timing measurements. <Link href="/learn/agent-loop">About agent loops <ArrowUpRight size={11} /></Link></p>
  </div>;
}
