import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoundsTrace } from "../rounds-trace.js";

test("round traces use nested timing and preserve tool observations without inventing durations", () => {
  const trace = normalizeRoundsTrace({ steps: [], elapsedMs: 100, rounds: [{ round: 1, request: { messages: [] }, response: { toolCalls: [{ id: "a", name: "lookup", arguments: "{}" }] }, steps: [{ type: "model", startMs: 10, durationMs: 50, outcome: "ok" }, { type: "tool", callId: "a", outcome: "failed", observation: "missing" }] }] });
  assert.equal(trace.steps.length, 2);
  assert.equal(trace.steps[0].timing.start, 10);
  assert.equal(trace.steps[0].timing.duration, 50);
  assert.equal(trace.steps[1].timing.durationReported, false);
  assert.equal(trace.steps[1].parts[0].name, "lookup");
  assert.equal(trace.steps[1].parts[1].result, "missing");
  assert.ok(trace.steps[1].error);
});
