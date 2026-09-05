import { findToolLinks, normalizeItem } from "./conversation-model.js";

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function finiteNumber(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function traceRoot(root) {
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== "object") return [];
  if (Array.isArray(root.events)) return root.events;
  if (Array.isArray(root.steps)) return root.steps;
  if (Array.isArray(root.trace)) return root.trace;
  if (Array.isArray(root.output)) return root.output;
  if (Array.isArray(root.choices)) return root.choices.map((choice) => choice.message || choice);
  if (Array.isArray(root.content)) return root.content;
  if (root.response) return [...(Array.isArray(root.input) ? root.input : []), ...traceRoot(root.response)];
  return [];
}

function absoluteTime(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1e12) return value;
    if (value >= 1e9) return value * 1000;
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function timingFor(value) {
  return {
    relativeStart: finiteNumber(firstDefined(value?.start_ms, value?.offset_ms, value?.start_offset_ms, value?.relative_start_ms)),
    absoluteStart: absoluteTime(firstDefined(value?.started_at, value?.start_time, value?.timestamp, value?.created_at, value?.time)),
    duration: Math.max(0, finiteNumber(firstDefined(value?.duration_ms, value?.duration, value?.latency_ms, value?.elapsed_ms)) || 0),
  };
}

function normalizeTimings(steps, rootDuration) {
  const absoluteStarts = steps.map((step) => step.timingInput.absoluteStart).filter((value) => value !== undefined);
  const origin = absoluteStarts.length ? Math.min(...absoluteStarts) : undefined;
  let cursor = 0;
  let maxEnd = 0;

  steps.forEach((step) => {
    const { relativeStart, absoluteStart, duration } = step.timingInput;
    let start;
    let source;
    if (relativeStart !== undefined) {
      start = Math.max(0, relativeStart);
      source = "explicit";
    } else if (absoluteStart !== undefined && origin !== undefined) {
      start = Math.max(0, absoluteStart - origin);
      source = "timestamp";
    } else {
      start = cursor;
      source = "inferred";
    }
    const end = start + duration;
    cursor = Math.max(cursor, end);
    maxEnd = Math.max(maxEnd, end);
    step.timing = { start, end, duration, source };
    delete step.timingInput;
  });

  const declaredDuration = Math.max(0, finiteNumber(rootDuration) || 0);
  return Math.max(1, declaredDuration, maxEnd);
}

export function normalizeTrace(root) {
  const values = traceRoot(root);
  const steps = values.map((value, index) => {
    const item = normalizeItem(value, index);
    const kind = String(firstDefined(value?.event, value?.type, value?.kind, item.kind, "event")).toLowerCase();
    return {
      ...item,
      id: `event-${index}`,
      correlationId: item.id,
      kind,
      sequence: index + 1,
      error: firstDefined(value?.error, value?.exception),
      provider: firstDefined(value?.provider, root?.provider),
      model: firstDefined(value?.model, root?.model),
      timingInput: timingFor(value),
    };
  });
  const declaredDuration = firstDefined(root?.duration_ms, root?.duration, root?.latency_ms, root?.latency);
  const duration = normalizeTimings(steps, declaredDuration);
  return {
    steps,
    links: findToolLinks(steps),
    timing: {
      duration,
      explicitSteps: steps.filter((step) => step.timing.source !== "inferred").length,
      inferredSteps: steps.filter((step) => step.timing.source === "inferred").length,
    },
    metadata: {
      provider: root?.provider,
      model: root?.model,
      runId: firstDefined(root?.run_id, root?.id, root?.request_id),
      duration,
      usage: firstDefined(root?.usage, root?.token_usage),
      status: root?.status,
    },
  };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function formatDuration(value) {
  if (!Number.isFinite(value)) return "—";
  if (value < 1) return `${Math.round(value * 1000)} µs`;
  if (value < 1000) return `${Number(value.toFixed(value < 10 ? 1 : 0))} ms`;
  return `${Number((value / 1000).toFixed(2))} s`;
}

function textPreview(step) {
  const text = step.parts.find((part) => part.type === "text" || part.type === "reasoning")?.text?.trim();
  if (!text) return "";
  const singleLine = text.replace(/\s+/g, " ");
  return singleLine.length > 84 ? `${singleLine.slice(0, 81)}…` : singleLine;
}

function toolPart(step) {
  return step.parts.find((part) => part.type === "tool_call" || part.type === "tool_result");
}

function eventTitle(step) {
  const part = toolPart(step);
  if (part?.type === "tool_call") return part.name || "Tool call";
  if (part?.type === "tool_result") return `Result · ${part.callId || "unknown call"}`;
  if (step.error) return "Error";
  return textPreview(step) || step.kind.replaceAll("_", " ");
}

function isToolStep(step) {
  return Boolean(toolPart(step)) || step.kind.includes("tool") || step.kind.includes("function");
}

function isErrorStep(step) {
  return Boolean(step.error) || step.kind.includes("error") || step.parts.some((part) => part.isError);
}

function filteredSteps(steps, filter) {
  if (filter === "tools") return steps.filter(isToolStep);
  if (filter === "errors") return steps.filter(isErrorStep);
  return steps;
}

function metric(label, value) {
  const node = element("div", "trace-metric");
  node.append(element("span", "trace-metric-label", label), element("strong", "trace-metric-value", value));
  return node;
}

function renderSession(trace) {
  const bar = element("div", "trace-session");
  const identity = element("div", "trace-session-id");
  identity.append(
    element("span", "trace-status-dot"),
    element("strong", "", trace.metadata.runId || "Local trace"),
    element("span", "", [trace.metadata.provider, trace.metadata.model].filter(Boolean).join(" · ") || "Unknown runtime"),
  );
  const usage = trace.metadata.usage || {};
  const tokens = firstDefined(
    usage.total_tokens,
    usage.totalTokens,
    usage.input_tokens !== undefined && usage.output_tokens !== undefined ? usage.input_tokens + usage.output_tokens : undefined,
    "—",
  );
  const toolCount = trace.steps.filter(isToolStep).length;
  const errorCount = trace.steps.filter(isErrorStep).length;
  const metrics = element("div", "trace-metrics");
  metrics.append(
    metric("Duration", formatDuration(trace.timing.duration)),
    metric("Events", trace.steps.length),
    metric("Tools", toolCount),
    metric("Errors", errorCount),
    metric("Tokens", tokens),
  );
  bar.append(identity, metrics);
  return bar;
}

function renderInsight(trace) {
  const timed = trace.steps.filter((step) => step.timing.duration > 0);
  const insight = element("div", "trace-insight");
  if (!timed.length) {
    insight.append(element("strong", "", "Timing unavailable"), element("span", "", "Waterfall positions are inferred from event order."));
    return insight;
  }
  const slowest = timed.reduce((current, step) => step.timing.duration > current.timing.duration ? step : current);
  const share = trace.timing.duration ? Math.round((slowest.timing.duration / trace.timing.duration) * 100) : 0;
  insight.append(
    element("strong", "", `Slowest · ${eventTitle(slowest)}`),
    element("span", "", `${formatDuration(slowest.timing.duration)} · ${share}% of trace`),
  );
  if (trace.timing.inferredSteps) insight.append(element("span", "trace-timing-note", `${trace.timing.inferredSteps} inferred start${trace.timing.inferredSteps === 1 ? "" : "s"}`));
  return insight;
}

function renderAxis(duration) {
  const axis = element("div", "waterfall-axis");
  [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => axis.append(element("span", "", formatDuration(duration * ratio))));
  return axis;
}

function renderWaterfall(step, totalDuration) {
  const cell = element("div", "waterfall-cell");
  const track = element("div", "waterfall-track");
  const start = Math.min(100, (step.timing.start / totalDuration) * 100);
  const available = Math.max(0, 100 - start);
  const width = Math.min(available, (step.timing.duration / totalDuration) * 100);
  const bar = element("span", `waterfall-bar role-${step.role}${isErrorStep(step) ? " is-error" : ""}`);
  bar.style.setProperty("--waterfall-start", `${start}%`);
  bar.style.setProperty("--waterfall-width", `${width}%`);
  bar.title = `${formatDuration(step.timing.start)} → ${formatDuration(step.timing.end)}${step.timing.source === "inferred" ? " · inferred start" : ""}`;
  track.append(bar);
  cell.append(track);
  return cell;
}

function renderRow(step, totalDuration, selectedId, onSelect) {
  const row = element("button", `trace-row${step.id === selectedId ? " is-selected" : ""}${isErrorStep(step) ? " has-error" : ""}`);
  row.type = "button";
  row.dataset.traceId = step.id;
  row.setAttribute("aria-selected", String(step.id === selectedId));
  row.addEventListener("click", () => onSelect?.(step.id));

  const name = element("span", "trace-event-name");
  name.append(element("strong", "", eventTitle(step)));
  const preview = toolPart(step) ? textPreview(step) : "";
  if (preview) name.append(element("small", "", preview));
  const kind = element("span", "trace-event-kind", step.kind.replaceAll("_", " "));
  const actor = element("span", `trace-actor role-${step.role}`, step.role);
  const start = element("span", "trace-number", formatDuration(step.timing.start));
  if (step.timing.source === "inferred") start.title = "Start inferred from preceding events";
  const duration = element("span", "trace-number", step.timing.duration ? formatDuration(step.timing.duration) : "—");
  row.append(element("span", "trace-sequence", step.sequence), name, kind, actor, start, duration, renderWaterfall(step, totalDuration));
  return row;
}

function appendPartDetail(container, part) {
  if (part.type === "text" || part.type === "reasoning") {
    container.append(element("div", "trace-detail-text", part.text));
    return;
  }
  const value = part.type === "tool_call" ? part.arguments : part.type === "tool_result" ? part.result : part.value ?? part.raw ?? part;
  container.append(element("pre", "trace-detail-code", typeof value === "string" ? value : JSON.stringify(value, null, 2)));
}

function fact(label, value) {
  const row = element("div", "trace-detail-fact");
  row.append(element("span", "", label), element("strong", "", value ?? "—"));
  return row;
}

function linkedStepId(step, links) {
  const part = toolPart(step);
  if (part?.type === "tool_call" && part.id) return links.results.get(String(part.id));
  if (part?.type === "tool_result" && part.callId) return links.calls.get(String(part.callId));
  return undefined;
}

function renderDetail(step, trace, onSelect) {
  if (!step) return null;
  const panel = element("aside", "trace-detail");
  panel.setAttribute("aria-label", "Event details");

  const header = element("div", "trace-detail-header");
  const heading = element("div", "");
  heading.append(element("span", "trace-detail-eyebrow", `Event ${step.sequence}`), element("h3", "", eventTitle(step)));
  const controls = element("div", "trace-detail-controls");
  controls.append(element("span", `trace-detail-role role-${step.role}`, step.role));
  const close = element("button", "trace-detail-close", "Close");
  close.type = "button";
  close.addEventListener("click", () => onSelect?.(step.id));
  controls.append(close);
  header.append(heading, controls);
  const facts = element("div", "trace-detail-facts");
  facts.append(
    fact("Type", step.kind.replaceAll("_", " ")),
    fact("Start", `${formatDuration(step.timing.start)}${step.timing.source === "inferred" ? " · inferred" : ""}`),
    fact("Duration", step.timing.duration ? formatDuration(step.timing.duration) : "Not reported"),
    fact("End", formatDuration(step.timing.end)),
  );
  const part = toolPart(step);
  if (part?.type === "tool_call") facts.append(fact("Call ID", part.id || "Not reported"), fact("Tool", part.name || "Unnamed"));
  if (part?.type === "tool_result") facts.append(fact("Call ID", part.callId || "Not reported"));

  const content = element("section", "trace-detail-section");
  content.append(element("h4", "", "Content"));
  if (step.parts.length) step.parts.forEach((item) => appendPartDetail(content, item));
  else content.append(element("div", "trace-detail-empty", "No normalized content."));
  if (step.error) content.append(element("div", "trace-detail-error", typeof step.error === "string" ? step.error : JSON.stringify(step.error, null, 2)));

  const linkedId = linkedStepId(step, trace.links);
  if (linkedId) {
    const link = element("button", "trace-link", part?.type === "tool_call" ? "Inspect result" : "Inspect call");
    link.type = "button";
    link.addEventListener("click", () => onSelect?.(linkedId));
    content.append(link);
  }

  const raw = element("details", "trace-raw");
  raw.append(element("summary", "", "Raw event"), element("pre", "trace-detail-code", JSON.stringify(step.raw, null, 2)));
  panel.append(header, facts, content, raw);
  return panel;
}

export function renderTrace(trace, options = {}) {
  const filter = options.filter || "all";
  const onSelect = options.onSelect;
  const visible = filteredSteps(trace.steps, filter);
  const selected = options.selectedId ? visible.find((step) => step.id === options.selectedId) : null;
  const root = element("div", "trace-devtool");
  root.append(renderSession(trace), renderInsight(trace));

  const workspace = element("div", `trace-workspace${selected ? " has-detail" : ""}`);
  const table = element("section", "trace-table");
  const tableHead = element("div", "trace-table-head");
  tableHead.append(
    element("span", "", "#"),
    element("span", "", "Event"),
    element("span", "", "Type"),
    element("span", "", "Actor"),
    element("span", "", "Start"),
    element("span", "", "Time"),
    renderAxis(trace.timing.duration),
  );
  const rows = element("div", "trace-rows");
  if (visible.length) visible.forEach((step) => rows.append(renderRow(step, trace.timing.duration, selected?.id, onSelect)));
  else rows.append(element("div", "trace-filter-empty", filter === "errors" ? "No errors in this trace." : "No matching events."));
  table.append(tableHead, rows);
  workspace.append(table);
  if (selected) workspace.append(renderDetail(selected, trace, onSelect));
  root.append(workspace);
  return root;
}
