import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTrace } from "../trace-viewer.js";
import { formatDuration, isErrorStep, matchTraceSteps, traceEventTitle, traceSummary } from "../trace-presentation.js";

test("missing timing stays distinct from an explicitly recorded zero", () => {
  const missing = normalizeTrace({ events: [{ role: "user", content: "Hello" }] });
  assert.equal(missing.timing.duration, 0);
  assert.equal(missing.steps[0].timing.durationReported, false);
  assert.equal(traceSummary(missing).hasTiming, false);
  assert.equal(traceSummary(missing).durationKnown, false);

  const zero = normalizeTrace({ duration_ms: 0, events: [{ start_ms: 0, duration_ms: 0 }] });
  assert.equal(zero.timing.duration, 0);
  assert.equal(zero.steps[0].timing.durationReported, true);
  assert.equal(traceSummary(zero).durationKnown, true);
  assert.equal(formatDuration(zero.timing.duration), "0 ms");

  for (const value of [null, "", " ", false, "invalid"]) {
    const invalid = normalizeTrace({ duration_ms: value, events: [{ duration_ms: value, start_ms: value }] });
    assert.equal(traceSummary(invalid).hasTiming, false, `Invalid timing: ${String(value)}`);
  }
});

test("partial timing is an observed span, with inferred starts disclosed", () => {
  const trace = normalizeTrace({ events: [
    { start_ms: 10, duration_ms: 5 },
    { content: "No duration" },
    { duration_ms: 20 },
  ] });
  assert.deepEqual(trace.steps.map((step) => step.timing.start), [10, 15, 15]);
  assert.equal(trace.timing.duration, 35);
  assert.equal(trace.timing.inferredSteps, 2);
  assert.equal(traceSummary(trace).durationKnown, false);
  assert.equal(traceSummary(trace).hasTiming, true);
});

const toolTrace = () => normalizeTrace({ status: "completed", events: [
  { role: "user", content: "Check inventory" },
  { type: "function_call", call_id: "lookup-1", name: "lookup_inventory", arguments: { sku: "chair-42" } },
  { type: "function_call_output", call_id: "lookup-1", is_error: true, output: { error: { message: "Warehouse unavailable" } } },
  { role: "assistant", content: "Please try again" },
] });

test("tool results keep the caller's name without counting a second call", () => {
  const trace = toolTrace();
  assert.equal(traceSummary(trace).calls, 1);
  assert.equal(traceEventTitle(trace.steps[2], trace), "lookup_inventory result");
  assert.equal(matchTraceSteps(trace, { filter: "tools" }).length, 2);
});

test("event errors take precedence over a completed run status", () => {
  const trace = toolTrace();
  assert.equal(traceSummary(trace).status, "Has errors");
  assert.equal(traceSummary(trace).errors, 1);
  assert.equal(isErrorStep(trace.steps[2]), true);
  const nested = normalizeTrace({ events: [
    { role: "user", content: [{ type: "tool_result", tool_use_id: "id", is_error: true, content: "failed" }] },
    { type: "error", error: "timeout" },
    { status: { code: "ERROR" } },
  ] });
  assert.equal(traceSummary(nested).errors, 3);
  assert.equal(traceSummary(normalizeTrace({ events: [{}] })).status, "Recorded");
});

test("search includes nested payloads and intersects the active event filter", () => {
  const trace = toolTrace();
  assert.deepEqual(matchTraceSteps(trace, { query: " WAREHOUSE " }).map((step) => step.sequence), [3]);
  assert.deepEqual(matchTraceSteps(trace, { filter: "errors", query: "lookup_inventory" }).map((step) => step.sequence), [3]);
  assert.equal(matchTraceSteps(trace, { filter: "tools", query: "Please try" }).length, 0);
  assert.equal(matchTraceSteps(trace, { query: "no-such-text" }).length, 0);
});

test("reported token usage supports aliases and numeric strings", () => {
  for (const usage of [
    { input_tokens: 12, output_tokens: 8 },
    { prompt_tokens: "12", completion_tokens: "8" },
    { inputTokens: 12, outputTokens: 8 },
    { total_tokens: 20 },
    { totalTokens: 20 },
  ]) assert.equal(traceSummary(normalizeTrace({ usage })).tokens, 20);
  assert.equal(traceSummary(normalizeTrace({ usage: { input_tokens: 12 } })).tokens, null);
});

test("sub-millisecond timing is preserved", () => {
  const trace = normalizeTrace({ events: [{ start_ms: "0", duration_ms: "0.25" }] });
  assert.equal(trace.timing.duration, .25);
  assert.equal(formatDuration(trace.timing.duration), "250 µs");
  assert.equal(formatDuration(1250), "1.25 s");
  assert.equal(formatDuration(undefined), "—");
});
