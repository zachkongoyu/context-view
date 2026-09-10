import test from "node:test";
import assert from "node:assert/strict";
import { isAttemptBundle, normalizeAttempt } from "../attempt-trace.js";

test("attempt import preserves measured model timing and scopes tool links to turns", () => {
  const events = (startedAt) => [
    { type: "provider_timing", phase: "provider_attempt", round: 1, startedAt, ms: 25, outcome: "ok", requestId: String(startedAt) },
    { type: "completion", round: 1, requestId: String(startedAt), reasoning: "Inspect result", usage: { inputTokens: 10 } },
    { type: "tool", id: "r1c0", tool: "lookup", args: "{}" },
    { type: "tool_result", id: "r1c0", tool: "lookup", ok: false, detail: "Unavailable" },
  ];
  const attempt = { id: "one", record: { events: events(1788969499073), turns: [{ events: events(1788969499073) }, { events: events(1788969499173) }], elapsedMs: 150 } };
  assert.equal(isAttemptBundle({ attempts: [attempt] }), true);
  const trace = normalizeAttempt(attempt);
  assert.equal(trace.steps.length, 6);
  assert.equal(trace.steps[3].timing.start, 100);
  assert.equal(trace.steps[0].timing.duration, 25);
  assert.equal(trace.steps[0].raw.completion.reasoning, "Inspect result");
  assert.equal(trace.steps[1].timing.durationReported, false);
  assert.notEqual(trace.steps[1].toolCallId, trace.steps[4].toolCallId);
  assert.equal(trace.links.calls.size, 2);
  assert.equal(trace.steps.filter(s => s.error).length, 2);
});
