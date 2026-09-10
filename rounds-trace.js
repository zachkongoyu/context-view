import { normalizeTrace } from "./trace-viewer.js";

export function isRoundsTrace(value) {
  return Array.isArray(value?.rounds);
}

export function normalizeRoundsTrace(root) {
  const events = [];
  for (const [index, round] of root.rounds.entries()) {
    const number = round.round ?? index + 1;
    const response = round.response || {};
    const calls = response.toolCalls || [];
    for (const step of round.steps || []) {
      const base = { ...step, start_ms: step.startMs, duration_ms: step.durationMs, round: number };
      if (step.type === "model" || step.type === "gate_wait") {
        events.push({ ...base, phase: step.type === "gate_wait" ? "gate_wait" : "provider_attempt", name: `Round ${number} · ${step.type === "model" ? "Model call" : "Gate wait"}`, role: "assistant", content: step.type === "model" ? response.content || response.reasoning || "Model call" : "Provider gate wait", request: round.request, response: step.type === "model" ? response : undefined, error: /fail|error/.test(step.outcome || "") ? step.reason || step.outcome : undefined });
      } else if (step.type === "tool") {
        const call = calls.find(c => (c.id ?? c.callId) === step.callId) || calls[step.callIndex] || {};
        const name = call.name || call.function?.name || step.tool || "Tool";
        const callId = `${index}:${step.callId ?? step.callIndex}`;
        events.push({ ...base, type: "function_call", name, call_id: callId, arguments: call.arguments ?? call.args ?? call.input ?? call.function?.arguments, observation: step.observation, error: step.outcome === "failed" ? step.reason || "Tool failed" : undefined, content: [{ type: "tool_result", call_id: callId, result: step.observation }] });
      } else events.push({ ...base, content: step });
    }
  }
  const usage = root.rounds.reduce((sum, r) => {
    const u = r.response?.usage;
    if (u?.inputTokens != null) sum.inputTokens = (sum.inputTokens || 0) + u.inputTokens;
    if (u?.outputTokens != null) sum.outputTokens = (sum.outputTokens || 0) + u.outputTokens;
    return sum;
  }, {});
  const trace = normalizeTrace({ events, duration_ms: root.elapsedMs, status: root.stopReason, model: root.rounds[0]?.response?.model, provider: root.rounds[0]?.response?.provider, usage });
  trace.runData = { input: root.input, answer: root.answer, state: root.state };
  for (const step of trace.steps) {
    if (step.kind === "function_call") step.parts.push({ type: "tool_result", result: step.raw.observation });
  }
  return trace;
}
