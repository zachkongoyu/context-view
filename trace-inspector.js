import { formatDuration, isErrorStep, matchTraceSteps, traceEventTitle, traceEventType, traceSummary } from "./trace-presentation.js";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function button(label, className, action) {
  const node = element("button", className, label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function pretty(value) {
  if (typeof value !== "string") return JSON.stringify(value ?? null, null, 2);
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}

function preview(step) {
  const part = step.parts.find((part) => part.type === "text" || part.type === "reasoning") || step.parts[0];
  const value = part?.text ?? part?.arguments ?? part?.result ?? step.error ?? step.kind;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return String(text || "No content recorded").replace(/\s+/g, " ");
}

function eventIcon(step) {
  const type = traceEventType(step);
  const icon = element("span", `event-icon event-${type}${isErrorStep(step) ? " event-error" : ""}`, isErrorStep(step) ? "!" : ({ user: "U", assistant: "A", reasoning: "◇", call: "↗", result: "↙", context: "·" })[type]);
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function eventLabel(step) {
  return ({ call: "Tool call", result: "Tool result", reasoning: "Reasoning", user: "User", assistant: "Assistant", context: "Context" })[traceEventType(step)];
}

function metric(label, value, className = "") {
  const node = element("div", `trace-metric ${className}`);
  node.append(element("span", "trace-metric-label", label), element("strong", "trace-metric-value", value));
  return node;
}

function fact(label, value) {
  const node = element("div", "trace-detail-fact");
  node.append(element("span", "", label), element("strong", "", value));
  return node;
}

export function renderTrace(trace, options = {}) {
  const state = {
    selectedId: options.selectedId,
    view: options.view === "messages" ? "messages" : "timeline",
    query: options.query || "",
    detailTab: ["content", "metadata", "raw"].includes(options.detailTab) ? options.detailTab : "content",
  };
  const summary = traceSummary(trace);
  const notify = () => options.onStateChange?.({ ...state });
  const root = element("div", "trace-inspector");
  const overview = element("section", "trace-overview");
  const identity = element("div", "trace-identity");
  const heading = element("div", "trace-run-heading");
  heading.append(element("span", "trace-eyebrow", "Run overview"), element("h3", "", trace.metadata.runId || "Local trace"));
  const status = element("span", `trace-status ${summary.status === "Has errors" ? "is-error" : ""}`, summary.status);
  identity.append(heading, status);
  const model = element("p", "trace-model", [trace.metadata.provider, trace.metadata.model].filter(Boolean).join(" / ") || "Model not reported");
  const metrics = element("div", "trace-metrics");
  metrics.append(metric(summary.durationKnown ? "Duration" : "Observed span", summary.durationKnown || trace.timing.duration > 0 ? formatDuration(trace.timing.duration) : "—"), metric("Events", trace.steps.length), metric("Tool calls", summary.calls), metric("Errors", summary.errors, summary.errors ? "metric-error" : ""), metric("Tokens", summary.tokens == null ? "—" : Number(summary.tokens).toLocaleString()));
  const slowest = trace.steps.reduce((found, step) => step.timing.duration > (found?.timing.duration || 0) ? step : found, null);
  const insight = element("div", "trace-insight");
  if (slowest) {
    insight.append(element("span", "trace-insight-label", "Longest event"), element("strong", "", traceEventTitle(slowest, trace)), element("span", "", formatDuration(slowest.timing.duration)));
    if (trace.timing.inferredSteps) insight.append(element("span", "trace-timing-note", `${trace.timing.inferredSteps} inferred start${trace.timing.inferredSteps === 1 ? "" : "s"}`));
  } else insight.append(element("span", "", trace.steps.some((step) => step.timing.durationReported) ? "Recorded event durations are 0 ms." : summary.hasTiming ? "Durations were not reported for these events." : "Timing not reported. Events are shown in recorded order."));
  if (summary.hasTiming && !summary.durationKnown) insight.append(element("span", "trace-timing-note", "Some durations are missing"));
  const summaryMain = element("div", "trace-summary-main");
  summaryMain.append(identity, model);
  overview.append(summaryMain, metrics, insight);

  const workspace = element("div", "trace-workspace");
  const explorer = element("section", "trace-explorer");
  explorer.setAttribute("aria-label", "Trace events");
  const toolbar = element("div", "trace-toolbar");
  const views = element("div", "segmented trace-view-switch");
  views.setAttribute("aria-label", "Trace view");
  for (const [value, label] of [["timeline", "Timeline"], ["messages", "Messages"]]) {
    const control = button(label, "", () => {
      state.view = value;
      updateRows();
      notify();
    });
    control.dataset.view = value;
    views.append(control);
  }
  const count = element("span", "trace-visible-count");
  const searchWrap = element("div", "trace-search outline-search");
  const searchIcon = element("span", "search-icon");
  searchIcon.setAttribute("aria-hidden", "true");
  const search = element("input");
  search.type = "search";
  search.placeholder = "Search events and payloads…";
  search.setAttribute("aria-label", "Search trace events");
  search.value = state.query;
  search.addEventListener("input", () => {
    state.query = search.value;
    updateRows();
    notify();
  });
  searchWrap.append(searchIcon, search);
  toolbar.append(views, searchWrap, count);
  const axis = element("div", "trace-axis-row");
  const rows = element("div", "trace-rows");
  rows.setAttribute("aria-label", "Event list");
  const legend = element("div", "trace-legend");
  legend.append(element("span", "legend-user", "User"), element("span", "legend-assistant", "Assistant"), element("span", "legend-call", "Tool"), element("span", "legend-error", "Error"));
  explorer.append(toolbar, axis, rows, legend);
  const detail = element("aside", "trace-detail");
  detail.setAttribute("aria-label", "Event details");
  workspace.append(explorer, detail);
  root.append(overview, workspace);
  let visible = [];

  function choose(id, focusRow = false) {
    state.selectedId = id;
    rows.querySelectorAll("[data-trace-id]").forEach((row) => {
      const selected = row.dataset.traceId === id;
      row.classList.toggle("is-selected", selected);
      row.setAttribute("aria-pressed", String(selected));
      if (selected && focusRow) {
        row.focus({ preventScroll: true });
        row.scrollIntoView({ block: "nearest" });
      }
    });
    updateDetail();
    notify();
  }

  function updateRows() {
    visible = matchTraceSteps(trace, { filter: options.filter, query: state.query });
    if (!visible.some((step) => step.id === state.selectedId)) state.selectedId = visible[0]?.id;
    root.dataset.traceView = state.view;
    for (const control of views.children) control.setAttribute("aria-pressed", String(control.dataset.view === state.view));
    count.textContent = `${visible.length} of ${trace.steps.length} events`;
    axis.replaceChildren(element("span", "", "Event"));
    axis.hidden = state.view !== "timeline";
    const scale = element("div", "waterfall-axis");
    if (summary.hasTiming) [0, .5, 1].forEach((ratio) => scale.append(element("span", "", formatDuration(trace.timing.duration * ratio))));
    else scale.append(element("span", "", "Recorded order"));
    axis.append(scale, element("span", "trace-axis-duration", "Duration"));
    rows.replaceChildren();
    if (!visible.length) {
      const empty = element("div", "trace-filter-empty");
      empty.append(element("strong", "", options.filter === "errors" && !state.query ? "No errors in this trace" : "No matching events"), element("p", "", state.query ? "Try a different search or change the event filter." : "Choose All to return to the complete run."));
      rows.append(empty);
    }
    visible.forEach((step, index) => {
      const row = button("", `trace-row ${isErrorStep(step) ? "has-error" : ""}`, () => {
        choose(step.id);
        if (window.matchMedia("(max-width: 760px)").matches) detail.scrollIntoView({ block: "start" });
      });
      row.dataset.traceId = step.id;
      row.setAttribute("aria-label", `Event ${step.sequence}: ${traceEventTitle(step, trace)}${isErrorStep(step) ? ", error" : ""}`);
      row.addEventListener("keydown", (event) => {
        const target = ({ ArrowDown: Math.min(visible.length - 1, index + 1), ArrowUp: Math.max(0, index - 1), Home: 0, End: visible.length - 1 })[event.key];
        if (target === undefined) return;
        event.preventDefault();
        choose(visible[target].id, true);
      });
      const name = element("span", "trace-event-name");
      const title = element("strong", "", traceEventTitle(step, trace));
      title.title = title.textContent;
      name.append(title, element("small", "", state.view === "messages" ? eventLabel(step) : preview(step)));
      const identity = element("span", "trace-event-identity");
      identity.append(eventIcon(step), name);
      const duration = element("span", "trace-duration", step.timing.durationReported ? formatDuration(step.timing.duration) : "—");
      const track = element("span", "waterfall-track");
      const scaleDuration = trace.timing.duration || 1;
      const start = summary.hasTiming ? Math.min(100, step.timing.start / scaleDuration * 100) : (step.sequence - 1) / Math.max(1, trace.steps.length) * 100;
      const width = summary.hasTiming ? Math.min(100 - start, step.timing.duration / scaleDuration * 100) : 0;
      const bar = element("span", `waterfall-bar event-${traceEventType(step)}${isErrorStep(step) ? " event-error" : ""}${step.timing.source === "inferred" ? " is-inferred" : ""}`);
      bar.style.setProperty("--waterfall-start", `${start}%`);
      bar.style.setProperty("--waterfall-width", `${width}%`);
      track.append(bar);
      track.setAttribute("aria-hidden", "true");
      track.title = summary.hasTiming ? `${formatDuration(step.timing.start)} → ${step.timing.durationReported ? formatDuration(step.timing.end) : "end not reported"}${step.timing.source === "inferred" ? " · inferred start" : ""}` : `Event ${step.sequence}; timing not reported`;
      row.append(identity, track, duration);
      if (state.view === "messages") row.append(element("span", "trace-message-preview", preview(step)));
      rows.append(row);
    });
    choose(state.selectedId);
  }

  function updateDetail() {
    detail.replaceChildren();
    const step = trace.steps.find((step) => step.id === state.selectedId);
    if (!step) {
      const empty = element("div", "trace-detail-empty");
      empty.append(element("span", "detail-empty-icon", "↖"), element("strong", "", "Choose an event"), element("p", "", "Its content, timing, and metadata will appear here."));
      detail.append(empty);
      return;
    }
    const header = element("div", "trace-detail-header");
    const heading = element("div", "");
    const eyebrow = element("span", "trace-detail-eyebrow", `Event ${String(step.sequence).padStart(2, "0")} / ${eventLabel(step)}`);
    heading.append(eyebrow, element("h3", "", traceEventTitle(step, trace)));
    const arrows = element("div", "trace-detail-controls");
    const index = visible.findIndex((candidate) => candidate.id === step.id);
    for (const [offset, text, label] of [[-1, "↑", "Previous event"], [1, "↓", "Next event"]]) {
      const arrow = button(text, "icon-button", () => choose(visible[index + offset].id, true));
      arrow.setAttribute("aria-label", label);
      arrow.title = label;
      arrow.disabled = index < 0 || !visible[index + offset];
      arrows.append(arrow);
    }
    header.append(heading, arrows);
    const facts = element("div", "trace-detail-facts");
    facts.append(fact("Start", summary.hasTiming ? `${formatDuration(step.timing.start)}${step.timing.source === "inferred" ? " · inferred" : ""}` : "Not reported"), fact("Duration", step.timing.durationReported ? formatDuration(step.timing.duration) : "Not reported"));
    const tabs = element("div", "trace-detail-tabs");
    tabs.setAttribute("aria-label", "Event detail view");
    for (const [key, label] of [["content", "Content"], ["metadata", "Metadata"], ["raw", "Raw"]]) {
      const tab = button(label, "", () => { state.detailTab = key; updateDetail(); notify(); });
      tab.setAttribute("aria-pressed", String(state.detailTab === key));
      tabs.append(tab);
    }
    const body = element("div", "trace-detail-body");
    if (isErrorStep(step)) {
      const error = element("div", "trace-detail-error");
      error.append(element("strong", "", "Event reported an error"), element("span", "", step.error ? pretty(step.error) : "Inspect the recorded payload below for the error details."));
      body.append(error);
    }
    if (state.detailTab === "raw") {
      body.append(element("p", "trace-detail-description", "The complete event, exactly as recorded."), element("pre", "trace-detail-code", pretty(step.raw)));
    } else if (state.detailTab === "metadata") {
      const metadata = element("section", "trace-metadata");
      metadata.append(fact("Type", step.kind), fact("Actor", step.role), fact("Model", step.model || "Not reported"), fact("Timing source", step.timing.source === "inferred" ? "Inferred from event order" : step.timing.source === "timestamp" ? "Recorded timestamp" : "Recorded start offset"));
      body.append(metadata);
      if (Object.keys(step.metadata || {}).length) body.append(element("pre", "trace-detail-code", pretty(step.metadata)));
    } else {
      if (!step.parts.length) body.append(element("p", "trace-detail-description", "No content was recorded for this event."));
      for (const part of step.parts) {
        const block = element("section", "trace-content-block");
        const label = part.type === "tool_call" ? "Input · arguments" : part.type === "tool_result" ? "Output · result" : part.type === "reasoning" ? "Reasoning" : "Message";
        block.append(element("h4", "", label));
        if (part.type === "text" || part.type === "reasoning") block.append(element("div", "trace-detail-text", part.text));
        else block.append(element("pre", "trace-detail-code", pretty(part.type === "tool_call" ? part.arguments : part.type === "tool_result" ? part.result : part.value ?? part.raw ?? part)));
        const callId = part.type === "tool_call" ? part.id : part.type === "tool_result" ? part.callId : null;
        if (callId) {
          const linkedId = part.type === "tool_call" ? trace.links.results.get(String(callId)) : trace.links.calls.get(String(callId));
          const relation = element("div", "trace-relation");
          relation.append(element("span", "", `Call ID: ${callId}`));
          if (linkedId) relation.append(button(part.type === "tool_call" ? "View result →" : "← View call", "trace-link", () => {
            // A linked event remains inspectable even if the active filter hides it.
            choose(linkedId, true);
          }));
          else relation.append(element("span", "", "Linked event not present"));
          block.append(relation);
        }
        body.append(block);
      }
    }
    const footer = element("div", "trace-detail-footer");
    footer.append(element("span", "", `Event ${step.sequence} of ${trace.steps.length}`), element("span", "", isErrorStep(step) ? "Error recorded" : "Recorded event"));
    detail.append(header, facts, tabs, body, footer);
  }

  updateRows();
  return root;
}
