import { normalizeTrace, renderTrace } from "./trace-viewer.js";

export function isAttemptBundle(value) {
  return Array.isArray(value?.attempts) && value.attempts.some((a) => Array.isArray(a?.record?.events));
}

export function normalizeAttempt(attempt) {
  const record = attempt.record;
  const turns = record.turns?.length ? record.turns : [{ events: record.events }];
  const events = [];
  turns.forEach((turn, index) => {
    const source = turn.events || [];
    const prefix = `Turn ${index + 1}`;
    const correlation = (id) => `${index}:${id}`;
    source.forEach((event) => {
      if (event.type === "provider_timing") {
        const completion = source.find((e) => e.type === "completion" && (event.requestId ? e.requestId === event.requestId : e.round === event.round));
        events.push({ ...event, name: `${prefix} · ${event.phase === "gate_wait" ? "Gate wait" : `Model call ${event.round}`}`, role: "assistant", started_at: event.startedAt, duration_ms: event.ms, content: event.phase === "provider_attempt" ? completion?.reasoning || "Model call" : "Provider gate wait", completion, error: event.outcome !== "ok" ? event.outcome : undefined });
      } else if (event.type === "tool") {
        const result = source.find((e) => e.type === "tool_result" && e.id === event.id);
        events.push({ ...event, type: "function_call", call_id: correlation(event.id), name: event.tool, arguments: event.args, turn: index + 1, result });
      } else if (event.type === "tool_result") {
        events.push({ ...event, type: "function_call_output", call_id: correlation(event.id), name: `${prefix} · ${event.tool} result`, output: event.preview ?? event.detail, error: event.ok === false ? event.detail || "Tool failed" : undefined });
      } else if (event.type === "say" || event.type === "context") {
        events.push({ ...event, name: `${prefix} · ${event.type === "say" ? "Assistant message" : "Context"}`, role: event.type === "say" ? "assistant" : "context", content: event.text ?? event });
      }
    });
  });
  return normalizeTrace({ events, id: attempt.id, model: record.model?.model, provider: record.model?.provider, status: record.status, duration_ms: record.elapsedMs, usage: { inputTokens: record.inputTokens, outputTokens: record.outputTokens } });
}

export function renderAttemptBundle(bundle, options = {}) {
  const root = document.createElement("div");
  root.className = "attempt-trace-bundle";
  const toolbar = document.createElement("div");
  toolbar.className = "trace-toolbar";
  const label = document.createElement("label");
  label.textContent = "Attempt ";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Select attempt");
  const attempts = bundle.attempts.filter((a) => Array.isArray(a?.record?.events));
  attempts.forEach((a, i) => {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `${i + 1}. ${a.caseTitle || a.id} · v${a.version ?? "?"} · Trial ${a.trial ?? "?"}`;
    select.append(option);
  });
  select.value = String(Math.min(options.attemptIndex || 0, attempts.length - 1));
  label.append(select);
  toolbar.append(label);
  const note = document.createElement("p");
  note.className = "trace-timing-note";
  note.textContent = "Model bars use recorded timestamps. Untimed events use inferred positions; tool durations and exact turn boundaries were not recorded. Timeline starts at the first recorded provider event.";
  const content = document.createElement("div");
  const draw = () => {
    const attemptIndex = Number(select.value);
    content.replaceChildren(renderTrace(normalizeAttempt(attempts[attemptIndex]), { ...options, selectedId: undefined, onStateChange: (state) => options.onStateChange?.({ ...state, attemptIndex }) }));
  };
  select.addEventListener("change", draw);
  root.append(toolbar, note, content);
  draw();
  return root;
}
