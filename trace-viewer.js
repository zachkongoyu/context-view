import { findToolLinks, normalizeItem } from "./conversation-model.js";

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function finiteNumber(value) {
  if (value == null || typeof value === "boolean" || (typeof value === "string" && !value.trim())) return undefined;
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
  const duration = finiteNumber(firstDefined(value?.duration_ms, value?.duration, value?.latency_ms, value?.elapsed_ms));
  return {
    relativeStart: finiteNumber(firstDefined(value?.start_ms, value?.offset_ms, value?.start_offset_ms, value?.relative_start_ms)),
    absoluteStart: absoluteTime(firstDefined(value?.started_at, value?.start_time, value?.timestamp, value?.created_at, value?.time)),
    duration: Math.max(0, duration || 0),
    durationReported: duration !== undefined,
  };
}

function normalizeTimings(steps, rootDuration) {
  const absoluteStarts = steps.map((step) => step.timingInput.absoluteStart).filter((value) => value !== undefined);
  const origin = absoluteStarts.length ? Math.min(...absoluteStarts) : undefined;
  let cursor = 0;
  let maxEnd = 0;

  steps.forEach((step) => {
    const { relativeStart, absoluteStart, duration, durationReported } = step.timingInput;
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
    step.timing = { start, end, duration, source, durationReported };
    delete step.timingInput;
  });

  const declaredDuration = Math.max(0, finiteNumber(rootDuration) || 0);
  return Math.max(0, declaredDuration, maxEnd);
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
      reported: finiteNumber(declaredDuration) !== undefined,
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

export { renderTrace } from "./trace-inspector.js";
