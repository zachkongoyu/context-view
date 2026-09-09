"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { Button } from "@/components/motion/button/base";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { BookOpen, Braces, CheckCheck, Download, FileText, Layers2, LockKeyhole, ShieldCheck, Upload, X } from "lucide-react";

const MODES = [
  ["prompt", "Prompt"],
  ["trace", "Trace"],
];

export function ContextViewApp() {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false} storageKey="context-view-theme">
      <ContextViewSurface />
    </ThemeProvider>
  );
}

function ContextViewSurface() {
  const controllerRef = useRef(null);
  const modalBodyRef = useRef(null);
  const modalSequence = useRef(0);
  const [mode, setMode] = useState("prompt");
  const [traceSourceOpen, setTraceSourceOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [modalView, setModalView] = useState(null);

  const openModal = useCallback((next) => {
    modalSequence.current += 1;
    setModal(next);
    setModalView(`dialog-${modalSequence.current}`);
  }, []);

  const closeModal = useCallback(() => {
    setModalView(null);
  }, []);

  useEffect(() => {
    if (mode === "trace" && traceSourceOpen) document.getElementById("source-input")?.focus({ preventScroll: true });
  }, [mode, traceSourceOpen]);

  useEffect(() => {
    let disposed = false;
    let controller = null;

    import("../prompt-trace-viewer.js").then(({ mountContextView }) => {
      if (disposed) return;
      controller = mountContextView(document, { openModal, closeModal });
      controllerRef.current = controller;
      if (new URLSearchParams(window.location.search).get("view") === "trace") {
        setMode("trace");
        controller.setMode("trace");
      }
    });

    return () => {
      disposed = true;
      controller?.destroy();
      controllerRef.current = null;
    };
  }, [closeModal, openModal]);

  useEffect(() => {
    if (!modal || !modalBodyRef.current) return;
    modalBodyRef.current.replaceChildren(modal.content);
  }, [modal, modalView]);

  useEffect(() => {
    if (!modalView) return;
    const dismiss = (event) => {
      if (event.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [closeModal, modalView]);

  const changeMode = useCallback((nextMode) => {
    setMode(nextMode);
    controllerRef.current?.setMode(nextMode);
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextMode);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Context View home">
          <span className="brand-mark" aria-hidden="true"><Layers2 size={19} strokeWidth={1.8} /></span>
          <span className="brand-copy"><strong>Context View</strong></span>
        </a>
        <nav className="header-mode-nav" aria-label="Viewer mode">
          <Link href="/learn" className="inspector-learn-link"><BookOpen size={15} />Learn</Link>
          <Tabs value={mode} onValueChange={changeMode} variant="pill">
            <TabsList className="mode-tabs-list grid grid-cols-2 bg-transparent p-0">
              {MODES.map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="mode-tab-trigger rounded-md px-4" indicatorClassName="mode-tab-indicator rounded-md">
                  {value === "prompt" ? <FileText size={15} /> : <Braces size={15} />}{label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </nav>
        <div className="header-tools"><span className="local-status"><span />Runs locally</span><ThemeToggle variant="circle-blur" start="top-right" className="beui-theme-toggle" iconClassName="size-4" /></div>
      </header>

      <div className="app-body">
        <div className="app-main">
          <section className="workbench">
            <div className="workbench-heading">
              <div><h1>{mode === "prompt" ? "Prompt inspector" : "Trace inspector"}</h1><p className="workspace-description">{mode === "prompt" ? "Explore the structure behind your instructions." : "Explore timing, tool calls, and their results."}</p></div>
              <div className="action-group">
                {mode === "trace" ? <Button variant="ghost" size="sm" className="action-button" aria-pressed={traceSourceOpen} onClick={() => setTraceSourceOpen((open) => !open)}><Braces size={15} />{traceSourceOpen ? "Hide source" : "Edit source"}</Button> : null}
                {mode === "trace" ? <Button variant="ghost" size="sm" className="action-button" onClick={() => controllerRef.current?.runAction("sample")}>Example</Button> : null}
                <Button variant="ghost" size="sm" className="action-button" data-action="redact"><ShieldCheck size={15} />Redact</Button>
                <Button variant="ghost" size="sm" className="action-button" data-action="export"><Download size={15} />Export</Button>
                <Button variant="secondary" size="sm" className="action-button primary-action" data-action="import"><Upload size={15} />Open file</Button>
                <input id="source-file" type="file" accept=".txt,.md,.markdown,.json,.jsonl,.xml,.log,text/*,application/json" hidden />
              </div>
            </div>
            <section className="action-bar" aria-label="Source actions">
              <div className="live-insights" aria-label="Live analysis">
                <CheckCheck size={14} /><strong id="token-count">0 tokens</strong>
                <button id="diagnostic-summary" type="button" data-severity="clear">No issues</button>
              </div>
              <div className="action-group">
                <span className="mode-hint" id="mode-hint">Select a section to jump to its content.</span>
              </div>
            </section>

            <main className="workspace" data-trace-source={traceSourceOpen ? "open" : "closed"}>
              <section className="source-pane" aria-labelledby="source-title" hidden={mode === "trace" && !traceSourceOpen}>
                <div className="pane-header">
                  <div className="source-identity">
                    <FileText size={17} />
                    <div><h2 id="source-title">Prompt</h2><span id="source-filename" className="source-filename">Example prompt</span></div>
                  </div>
                  <div className="source-header-tools">
                    {mode === "trace" ? <button type="button" className="icon-button" aria-label="Close source editor" onClick={() => setTraceSourceOpen(false)}><X size={15} /></button> : null}
                    <div id="source-view-controls" className="segmented" aria-label="Source view">
                      <button type="button" data-source-view="read" aria-pressed="true"><BookOpen size={14} />Read</button>
                      <button type="button" data-source-view="edit" aria-pressed="false"><Braces size={14} />Edit</button>
                    </div>
                  </div>
                </div>

                <div id="source-reader" className="source-reader" tabIndex="0" aria-label="Prompt reader" />
                <div id="single-editor" className="editor-wrap" hidden>
                  <label className="sr-only" htmlFor="source-input">Source input</label>
                  <textarea id="source-input" spellCheck="false" autoComplete="off" placeholder="Paste a prompt or trace here" />
                </div>
                <div className="source-footer"><div className="source-meta"><span id="line-count">1 line</span><span id="char-count">0 chars</span></div><span id="source-position">Reading view</span><div className="source-actions"><button type="button" className="quiet-button" data-action="sample">Example</button><button type="button" className="quiet-button danger" data-action="clear" title="Clear source" aria-label="Clear source"><X size={14} /></button></div></div>
              </section>

              <section className="viewer-pane" aria-labelledby="viewer-title">
                <div className="pane-header viewer-header">
                  <div className="analysis-heading"><span className="analysis-mark"><Layers2 size={16} /></span><h2 id="viewer-title">Context overview</h2></div>
                  <span id="analysis-live" className="analysis-live"><span />Live</span>
                  <div id="semantic-controls" className="segmented" aria-label="Trace filter" hidden>
                    <button type="button" data-trace-filter="all" aria-pressed="true">All</button>
                    <button type="button" data-trace-filter="tools" aria-pressed="false">Tools</button>
                    <button type="button" data-trace-filter="errors" aria-pressed="false">Errors</button>
                  </div>
                </div>

                <div id="viewer" className="viewer" tabIndex="-1" />
              </section>
            </main>
          </section>
          <footer className="app-footer"><span><LockKeyhole size={12} />Your source stays in this browser.</span></footer>
        </div>
      </div>

      <MorphingModal viewId={modalView} onClose={closeModal} placement="center" className="context-view-modal max-w-[720px]">
        {modal ? (
          <section className="dialog-shell" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <div className="dialog-header">
              <div>
                <p className="pane-kicker">{modal.kicker}</p>
                <h2 id="dialog-title">{modal.title}</h2>
              </div>
              <Button variant="ghost" size="sm" className="icon-button" onClick={closeModal}>Close</Button>
            </div>
            <div ref={modalBodyRef} className="dialog-body" />
          </section>
        ) : null}
      </MorphingModal>
    </div>
  );
}
