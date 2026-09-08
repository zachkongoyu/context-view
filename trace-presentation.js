export function isToolStep(step) {
  return step.parts.some((part) => part.type === "tool_call" || part.type === "tool_result") || /tool|function/.test(step.kind);
}

export function isErrorStep(step) {
  return Boolean(step.error || step.raw?.is_error || step.raw?.isError) || /error|failed|failure/.test(step.kind) || step.parts.some((part) => part.isError) || /^(error|failed|failure)$/i.test(String(step.raw?.status?.code ?? step.raw?.status ?? ""));
}

export function traceEventType(step) {
  if (step.parts.some((part) => part.type === "tool_call")) return "call";
  if (step.parts.some((part) => part.type === "tool_result")) return "result";
  if (step.parts.some((part) => part.type === "reasoning")) return "reasoning";
  if (step.role === "user") return "user";
  if (step.role === "assistant") return "assistant";
  return "context";
}

export function traceEventTitle(step, trace) {
  const call = step.parts.find((part) => part.type === "tool_call");
  if (call) return call.name || "Tool call";
  const result = step.parts.find((part) => part.type === "tool_result");
  if (result) {
    const caller = trace?.steps.find((candidate) => candidate.id === trace.links.calls.get(String(result.callId)));
    const tool = caller?.parts.find((part) => part.type === "tool_call")?.name;
    return tool ? `${tool} result` : "Tool result";
  }
  if (step.raw?.name) return String(step.raw.name);
  if (isErrorStep(step)) return "Error";
  return ({ user: "User message", assistant: "Assistant response", reasoning: "Reasoning", context: "Context" })[traceEventType(step)];
}

export function traceSummary(trace) {
  const usage = trace.metadata.usage || {};
  const input = usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens;
  const output = usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens;
  const tokens = usage.total_tokens ?? usage.totalTokens ?? (input != null && output != null ? Number(input) + Number(output) : null);
  const errors = trace.steps.filter(isErrorStep).length;
  const status = String(trace.metadata.status?.code ?? trace.metadata.status ?? "").toLowerCase();
  return {
    tokens,
    errors,
    calls: trace.steps.reduce((count, step) => count + step.parts.filter((part) => part.type === "tool_call").length, 0),
    status: errors || /error|fail/.test(status) ? "Has errors" : /complete|success|^ok$/.test(status) ? "Completed" : /running|pending|progress/.test(status) ? "In progress" : "Recorded",
    hasTiming: Boolean(trace.timing.reported || trace.steps.some((step) => step.timing.durationReported || step.timing.source !== "inferred")),
    durationKnown: Boolean(trace.timing.reported || (trace.steps.length && trace.steps.every((step) => step.timing.durationReported))),
  };
}

export function matchTraceSteps(trace, { filter = "all", query = "" } = {}) {
  const needle = query.trim().toLowerCase();
  return trace.steps.filter((step) => {
    if (filter === "tools" && !isToolStep(step)) return false;
    if (filter === "errors" && !isErrorStep(step)) return false;
    return !needle || `${traceEventTitle(step, trace)} ${step.role} ${step.kind} ${JSON.stringify(step.raw)}`.toLowerCase().includes(needle);
  });
}

export function formatDuration(value) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0 ms";
  if (value < 1) return `${Math.round(value * 1000)} µs`;
  if (value < 1000) return `${Number(value.toFixed(value < 10 ? 1 : 0))} ms`;
  return `${Number((value / 1000).toFixed(2))} s`;
}
