import test from "node:test";
import assert from "node:assert/strict";
import { redactSource, runDiagnostics } from "../diagnostics.js";
import { normalizeTrace } from "../trace-viewer.js";

const trace = {
  provider: "test-provider",
  model: "test-model",
  run_id: "run-1",
  duration_ms: 42,
  events: [
    { type: "message", role: "user", content: "Read it.", start_ms: 0, duration_ms: 3 },
    { type: "function_call", call_id: "call-1", name: "read", arguments: "{\"path\":\"a.txt\"}", start_ms: 3, duration_ms: 7 },
    { type: "function_call_output", call_id: "call-1", output: "done", start_ms: 10, duration_ms: 25 },
    { type: "message", role: "assistant", content: "Done.", start_ms: 35, duration_ms: 7 },
  ],
};

test("normalizes trace metadata and linked tool events", () => {
  const normalized = normalizeTrace(trace);
  assert.equal(normalized.metadata.provider, "test-provider");
  assert.equal(normalized.metadata.runId, "run-1");
  assert.equal(normalized.steps.length, 4);
  assert.equal(normalized.links.calls.get("call-1"), normalized.steps[1].id);
  assert.equal(normalized.links.results.get("call-1"), normalized.steps[2].id);
  assert.deepEqual(normalized.steps.map((step) => step.timing.start), [0, 3, 10, 35]);
  assert.equal(normalized.timing.duration, 42);
  assert.equal(normalized.timing.inferredSteps, 0);
  assert.deepEqual(normalized.steps.map((step) => step.id), ["event-0", "event-1", "event-2", "event-3"]);
});

test("preserves reasoning text in trace events", () => {
  const normalized = normalizeTrace({ events: [{ type: "reasoning", role: "assistant", content: "Inspect the tool output." }] });
  assert.equal(normalized.steps[0].parts[0].type, "reasoning");
  assert.equal(normalized.steps[0].parts[0].text, "Inspect the tool output.");
});

test("reports malformed tool arguments in traces", () => {
  const malformed = JSON.stringify({ events: [{ type: "function_call", call_id: "call-1", name: "read", arguments: "{" }] });
  assert.ok(runDiagnostics(malformed, "trace").some((item) => item.code === "malformed-tool-arguments"));
});


test("redacts sensitive fields and recognizable secrets", () => {
  const source = JSON.stringify({ api_key: "sk-abcdefghijklmnopqrstuvwxyz", email: "person@example.com" });
  const redacted = redactSource(source);
  assert.equal(redacted.includes("sk-abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(redacted.includes("person@example.com"), false);
  assert.ok(runDiagnostics(source, "trace").some((item) => item.code === "sensitive-field"));
});

