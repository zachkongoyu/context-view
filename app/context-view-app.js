"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Button } from "@/components/motion/button/base";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { ThemeToggle } from "@/components/motion/theme-toggle";

const MODES = [
  ["prompt", "Prompt"],
  ["payload", "Payload"],
  ["trace", "Trace"],
  ["schema", "Schema"],
  ["compare", "Compare"],
  ["rag", "RAG"],
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

    import("../payload-viewer.js").then(({ mountPromptLens }) => {
      if (disposed) return;
      controller = mountPromptLens(document, { openModal, closeModal });
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
        <div className="header-actions">
          <div className="privacy-state" title="No source data leaves this browser">Local only</div>
          <ThemeToggle
            variant="circle-blur"
            start="top-right"
            className="beui-theme-toggle"
            iconClassName="size-4"
          />
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar" aria-label="Inspector modes">
          <p className="sidebar-heading">Inspect</p>
          <nav className="mode-nav" aria-label="Inspector mode">
            <Tabs value={mode} onValueChange={changeMode} variant="pill" className="w-full">
              <TabsList className="mode-tabs-list grid w-full gap-1 bg-transparent p-0">
                {MODES.map(([value, label]) => (
                  <TabsTrigger key={value} value={value} className="mode-tab-trigger w-full justify-start rounded-md px-3 py-2" indicatorClassName="mode-tab-indicator rounded-md">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </nav>
          <div className="sidebar-note">
            <strong>Browser only</strong>
            <span>Your source never leaves this device.</span>
          </div>
        </aside>

        <div className="app-main">
          <section className="workbench">
            <section className="action-bar" aria-label="Source actions">
              <div className="action-group">
                <Button variant="secondary" size="sm" className="action-button" data-action="tokens">Tokens</Button>
                <Button variant="primary" size="sm" className="action-button primary-action" data-action="validate" ripple>Validate</Button>
                <Button variant="secondary" size="sm" className="action-button" data-action="convert" hidden>Convert</Button>
                <Button variant="secondary" size="sm" className="action-button" data-action="redact">Redact</Button>
                <Button variant="secondary" size="sm" className="action-button" data-action="export">Export</Button>
                <Button variant="ghost" size="sm" className="action-button" data-action="guide">How it works</Button>
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
                  <p className="mode-hint" id="mode-hint">Markdown for instructions. XML for data boundaries.</p>
                </div>

                <div id="single-editor" className="editor-wrap">
                  <label className="sr-only" htmlFor="source-input">Source input</label>
                  <textarea id="source-input" spellCheck="false" autoComplete="off" placeholder="Paste a prompt or payload here" />
                </div>

                <div id="compare-editors" className="compare-editors" hidden>
                  <div className="compare-source">
                    <label htmlFor="compare-a">Version A</label>
                    <textarea id="compare-a" spellCheck="false" autoComplete="off" placeholder="Paste version A" />
                  </div>
                  <div className="compare-source">
                    <label htmlFor="compare-b">Version B</label>
                    <textarea id="compare-b" spellCheck="false" autoComplete="off" placeholder="Paste version B" />
                  </div>
                </div>
              </section>

              <section className="viewer-pane" aria-labelledby="viewer-title">
                <div className="pane-header viewer-header">
                  <div>
                    <p className="pane-kicker">Visual interpretation</p>
                    <h2 id="viewer-title">Hierarchy</h2>
                  </div>
                  <div id="semantic-controls" className="segmented" aria-label="Semantic grouping" hidden>
                    <button type="button" data-grouping="items" aria-pressed="true">Items</button>
                    <button type="button" data-grouping="turns" aria-pressed="false">Turns</button>
                    <button type="button" data-grouping="rounds" aria-pressed="false">Rounds</button>
                  </div>
                </div>

                <div id="diagnostic-strip" className="diagnostic-strip" hidden />
                <div id="viewer" className="viewer" tabIndex="-1" aria-live="polite" />
              </section>
            </main>
          </section>

          <footer className="status-bar">
            <span id="status-message">Ready. Nothing leaves this browser.</span>
            <span id="mode-summary">Prompt hierarchy</span>
          </footer>
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
