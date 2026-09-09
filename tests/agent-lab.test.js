import test from "node:test";
import assert from "node:assert/strict";
import { createLabSteps } from "../lib/agent-lab.js";
import { getTerm } from "../lib/agent-knowledge.js";

test("the loop receives evidence before its second model call answers", () => {
  const steps = createLabSteps();
  assert.equal(steps[2].records.at(-1).kind, "Tool call");
  assert.equal(steps[3].records.at(-1).kind, "Tool result");
  assert.equal(steps[4].node, "context");
  assert.equal(steps[4].modelCalls, 1);
  assert.equal(steps.at(-1).modelCalls, 2);
  assert.equal(steps.at(-1).toolCalls, 1);
  assert.equal(steps.at(-1).turn, 1);
  assert.equal(steps.at(-1).records.length, 4);
});

test("a failed tool call cannot leak the successful scenario's answer", () => {
  const steps = createLabSteps("failure", true);
  assert.equal(steps.length, 6);
  assert.equal(steps[3].records.at(-1).role, "error");
  assert.match(steps.at(-1).records.at(-1).text, /couldn’t check/);
  assert.doesNotMatch(JSON.stringify(steps), /Friday|has shipped/);
});

test("a follow-up retains the exchange and opens a second turn without another tool call", () => {
  const initial = createLabSteps();
  const steps = createLabSteps("success", true);
  assert.deepEqual(steps[6].records.slice(0, 4), initial.at(-1).records);
  assert.equal(steps[6].records.at(-1).turn, 2);
  assert.equal(steps[7].term, "session");
  assert.equal(steps.at(-1).modelCalls, 3);
  assert.equal(steps.at(-1).toolCalls, 1);
  assert.equal(steps.at(-1).records.length, 6);
  for (const step of steps) {
    assert.ok(getTerm(step.term));
    for (const item of step.records) assert.ok(getTerm(item.term));
  }
});
