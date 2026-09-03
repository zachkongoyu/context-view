import { findToolLinks, groupRounds, groupTurns, normalizeItem } from "./conversation-model.js";

function firstDefined(...values) { return values.find((value) => value !== undefined && value !== null); }

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

export function normalizeTrace(root) {
  const values = traceRoot(root);
  const steps = values.map((value, index) => {
    const item = normalizeItem(value, index);
    const kind = String(firstDefined(value?.event, value?.type, value?.kind, item.kind, "event")).toLowerCase();
    return {
      ...item,
      kind,
      sequence: index + 1,
      duration: firstDefined(value?.duration_ms, value?.duration, value?.latency_ms),
      error: firstDefined(value?.error, value?.exception),
      provider: firstDefined(value?.provider, root?.provider),
      model: firstDefined(value?.model, root?.model),
    };
  });
  return {
    steps,
    links: findToolLinks(steps),
    metadata: {
      provider: root?.provider,
      model: root?.model,
      runId: firstDefined(root?.run_id, root?.id, root?.request_id),
      duration: firstDefined(root?.duration_ms, root?.duration, root?.latency),
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

function appendPart(container, part, links) {
  if (part.type === "text" || part.type === "reasoning") container.append(element("div", "text-part", part.text));
  else if (part.type === "tool_call") {
    const block = element("div", "stack");
    block.append(element("div", "meta-line", `Call ${part.id || "without ID"} | ${part.name || "unnamed tool"}`));
    block.append(element("pre", "", typeof part.arguments === "string" ? part.arguments : JSON.stringify(part.arguments, null, 2)));
    const resultId = part.id ? links.results.get(String(part.id)) : null;
    if (resultId) { const button = element("button", "link-button", "Jump to result"); button.type = "button"; button.addEventListener("click", () => document.getElementById(`trace-${resultId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })); block.append(button); }
    container.append(block);
  } else if (part.type === "tool_result") {
    const block = element("div", "stack");
    block.append(element("div", "meta-line", `Result for ${part.callId || "unknown call"}`));
    block.append(element("pre", "", typeof part.result === "string" ? part.result : JSON.stringify(part.result, null, 2)));
    const callId = part.callId ? links.calls.get(String(part.callId)) : null;
    if (callId) { const button = element("button", "link-button", "Jump to call"); button.type = "button"; button.addEventListener("click", () => document.getElementById(`trace-${callId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })); block.append(button); }
    container.append(block);
  } else container.append(element("pre", "", JSON.stringify(part.value ?? part.raw ?? part, null, 2)));
}

function renderStep(step, links) {
  const row = element("article", `timeline-item role-${step.role}`);
  row.id = `trace-${step.id}`;
  row.append(element("div", "timeline-index", step.sequence));
  const content = element("div", "timeline-content");
  const head = element("div", "timeline-head");
  head.append(element("span", "timeline-role", step.role), element("span", "timeline-kind", step.kind));
  if (step.duration !== undefined) head.append(element("span", "timeline-meta", `${step.duration} ms`));
  content.append(head);
  const parts = element("div", "content-parts");
  step.parts.forEach((part) => appendPart(parts, part, links));
  if (step.error) parts.append(element("div", "validation-item error", typeof step.error === "string" ? step.error : JSON.stringify(step.error)));
  if (!step.parts.length && !step.error) parts.append(element("pre", "", JSON.stringify(step.raw, null, 2)));
  content.append(parts);
  row.append(content);
  return row;
}

function traceGroup(title, steps, links) {
  const group = element("section", "group-block");
  group.append(element("div", "group-title", title));
  const timeline = element("div", "group-content timeline");
  steps.forEach((step) => timeline.append(renderStep(step, links)));
  group.append(timeline);
  return group;
}

export function renderTrace(trace, grouping = "items") {
  const root = element("div", "section-stack");
  const summary = element("div", "summary-grid");
  const usage = trace.metadata.usage || {};
  [["Provider", trace.metadata.provider || "Unknown"], ["Model", trace.metadata.model || "Unknown"], ["Run ID", trace.metadata.runId || "Unknown"], ["Duration", trace.metadata.duration ? `${trace.metadata.duration} ms` : "Unknown"], ["Steps", trace.steps.length], ["Tokens", firstDefined(usage.total_tokens, usage.totalTokens, usage.input_tokens && usage.output_tokens ? usage.input_tokens + usage.output_tokens : undefined, "Unknown")]].forEach(([label, value]) => { const metric = element("div", "metric"); metric.append(element("span", "metric-label", label), element("span", "metric-value", value)); summary.append(metric); });
  root.append(summary);

  if (grouping === "items") {
    const timeline = element("div", "timeline");
    trace.steps.forEach((step) => timeline.append(renderStep(step, trace.links)));
    root.append(timeline);
    return root;
  }

  const turns = groupTurns(trace.steps);
  if (grouping === "turns") {
    turns.forEach((turn, index) => root.append(traceGroup(`${turn.context ? "Context" : "INFERRED turn"} ${index + 1} | ${turn.actor}`, turn.items, trace.links)));
    return root;
  }

  const grouped = groupRounds(turns);
  if (grouped.context.length) root.append(traceGroup("Context", grouped.context.flatMap((turn) => turn.items), trace.links));
  grouped.rounds.forEach((round, index) => root.append(traceGroup(`INFERRED round ${index + 1}`, round.turns.flatMap((turn) => turn.items), trace.links)));
  return root;
}
