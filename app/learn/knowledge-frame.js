"use client";

import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { BookOpen, Braces, FileText, Layers2 } from "lucide-react";
import { ThemeToggle } from "@/components/motion/theme-toggle";

export function KnowledgeFrame({ children }) {
  return <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false} storageKey="context-view-theme">
    <div className="knowledge-shell">
      <a className="learn-skip" href="#learn-main">Skip to content</a>
      <header className="knowledge-header">
        <Link className="brand" href="/" aria-label="Context View home"><span className="brand-mark"><Layers2 size={19} strokeWidth={1.8} /></span><span className="brand-copy"><strong>Context View</strong></span></Link>
        <nav className="knowledge-nav" aria-label="Main navigation">
          <Link href="/learn" aria-current="page"><BookOpen size={15} />Learn</Link>
          <Link href="/?view=prompt"><FileText size={15} />Prompt</Link>
          <Link href="/?view=trace"><Braces size={15} />Trace</Link>
        </nav>
        <div className="knowledge-header-end"><span>Agent field guide</span><ThemeToggle className="beui-theme-toggle" iconClassName="size-4" /></div>
      </header>
      {children}
      <footer className="knowledge-footer"><span>Context View <span aria-hidden="true">/</span> A field guide to agent systems</span><Link href="/learn#about">About this vocabulary <span aria-hidden="true">↗</span></Link></footer>
    </div>
  </ThemeProvider>;
}
