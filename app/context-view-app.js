"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Button } from "@/components/motion/button/base";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { ThemeToggle } from "@/components/motion/theme-toggle";

const MODES = [
  ["prompt", "Prompt"],
  ["trace", "Trace"],
];

export function ContextViewApp() {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false} storageKey="context-view-theme">
      <ContextViewSurface />
    </ThemeProvider>
  );
}

function ContextViewSurface() {
  const controllerRef = useRef(null);
  const modalBodyRef = useRef(null);
  const modalSequence = useRef(0);
  const [mode, setMode] = useState("prompt");
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
    let disposed = false;
    let controller = null;

    import("../prompt-trace-viewer.js").then(({ mountContextView }) => {
      if (disposed) return;
      controller = mountContextView(document, { openModal, closeModal });
      controllerRef.current = controller;
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
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Context View home">
          <span className="brand-mark" aria-hidden="true">CV</span>
          <span className="brand-copy"><strong>Context View</strong></span>
        </a>
        <nav className="header-mode-nav" aria-label="Viewer mode">
          <Tabs value={mode} onValueChange={changeMode} variant="pill">
            <TabsList className="mode-tabs-list grid grid-cols-2 bg-transparent p-0">
              {MODES.map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="mode-tab-trigger rounded-md px-4" indicatorClassName="mode-tab-indicator rounded-md">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </nav>
        <ThemeToggle variant="circle-blur" start="top-right" className="beui-theme-toggle" iconClassName="size-4" />
      </header>

      <div className="app-body">
        <div className="app-main">
          <section className="workbench">
            <section className="action-bar" aria-label="Source actions">
              <div className="live-insights" aria-label="Live analysis">
                <strong id="token-count">0 tokens</strong>
                <button id="diagnostic-summary" type="button" data-severity="clear">No issues</button>
              </div>
              <div className="action-group">
                <Button variant="ghost" size="sm" className="action-button primary-action" data-action="validate">Validate</Button>
                <Button variant="ghost" size="sm" className="action-button" data-action="redact">Redact</Button>
                <Button variant="ghost" size="sm" className="action-button" data-action="export">Export</Button>
              </div>
            </section>

            <main className="workspace">
              <section className="source-pane" aria-labelledby="source-title">
                <div className="pane-header">
                  <div>
                    <p className="pane-kicker">Editable source</p>
                    <h1 id="source-title">Prompt</h1>
                  </div>
                  <div className="source-header-tools">
                    <div className="source-meta" aria-live="polite">
                      <span id="line-count">1 line</span>
                      <span id="char-count">0 chars</span>
                    </div>
                    <div className="source-actions">
                      <Button variant="ghost" size="sm" className="quiet-button" data-action="sample">Reset example</Button>
                      <Button variant="ghost" size="sm" className="quiet-button danger" data-action="clear">Clear</Button>
                    </div>
                  </div>
                  <p className="mode-hint" id="mode-hint">See which sections consume the context window.</p>
                </div>

                <div id="single-editor" className="editor-wrap">
                  <label className="sr-only" htmlFor="source-input">Source input</label>
                  <textarea id="source-input" spellCheck="false" autoComplete="off" placeholder="Paste a prompt or trace here" />
                </div>

              </section>

              <section className="viewer-pane" aria-labelledby="viewer-title">
                <div className="pane-header viewer-header">
                  <div>
                    <p className="pane-kicker">Analysis</p>
                    <h2 id="viewer-title">Token weight</h2>
                  </div>
                  <div id="semantic-controls" className="segmented" aria-label="Trace filter" hidden>
                    <button type="button" data-trace-filter="all" aria-pressed="true">All</button>
                    <button type="button" data-trace-filter="tools" aria-pressed="false">Tools</button>
                    <button type="button" data-trace-filter="errors" aria-pressed="false">Errors</button>
                  </div>
                </div>

                <div id="viewer" className="viewer" tabIndex="-1" aria-live="polite" />
              </section>
            </main>
          </section>

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
