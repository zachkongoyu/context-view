import test from "node:test";
import assert from "node:assert/strict";
import { findToolLinks, normalizeConversation } from "../conversation-model.js";
import { compareSources } from "../compare-viewer.js";
import { redactSource, runDiagnostics } from "../diagnostics.js";
import { convertPayload } from "../provider-converter.js";
import { normalizeRag } from "../rag-viewer.js";
import { validateSchema } from "../schema-validator.js";

const payload = {
  model: "test-model",
  messages: [
    { role: "system", content: "Stay concise." },
    { role: "user", content: "Read it." },
    { role: "assistant", tool_calls: [{ id: "call-1", type: "function", function: { name: "read", arguments: "{\"path\":\"a.txt\"}" } }] },
    { role: "tool", tool_call_id: "call-1", content: "done" },
    { role: "assistant", content: "Done." },
  ],
};

test("normalizes context, turns, rounds, and tool links", () => {
  const conversation = normalizeConversation(payload);
  assert.equal(conversation.items.length, 5);
  assert.equal(conversation.items[0].role, "context");
  assert.equal(conversation.turns.length, 5);
  assert.equal(conversation.rounds.context.length, 1);
  assert.equal(conversation.rounds.rounds.length, 1);
  const links = findToolLinks(conversation.items);
  assert.equal(links.calls.get("call-1"), conversation.items[2].id);
  assert.equal(links.results.get("call-1"), conversation.items[3].id);
});

test("maps Anthropic user tool results to tool turns", () => {
  const conversation = normalizeConversation([{ role: "user", content: [{ type: "tool_result", tool_use_id: "tool-7", content: "ok" }] }]);
  assert.equal(conversation.items[0].role, "tool");
  assert.equal(conversation.items[0].parts[0].callId, "tool-7");
});

test("validates nested object and conditional constraints", () => {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["kind", "value"],
    properties: {
      kind: { enum: ["text", "count"] },
      value: {},
    },
    if: { properties: { kind: { const: "count" } }, required: ["kind"] },
    then: { properties: { value: { type: "integer", minimum: 1 } } },
    else: { properties: { value: { type: "string", minLength: 2 } } },
  };
  assert.equal(validateSchema({ kind: "count", value: 2 }, schema).valid, true);
  const invalid = validateSchema({ kind: "count", value: 0, extra: true }, schema);
  assert.equal(invalid.valid, false);
  assert.deepEqual(new Set(invalid.errors.map((error) => error.keyword)), new Set(["minimum", "additionalProperties"]));
});

test("compares JSON by leaf path", () => {
  const result = compareSources('{"a":1,"b":2}', '{"a":1,"b":3,"c":4}');
  assert.equal(result.type, "json");
  assert.equal(result.rows.find((row) => row.path === "$.b").status, "changed");
  assert.equal(result.rows.find((row) => row.path === "$.c").status, "added");
});

test("redacts sensitive fields and recognizable secrets", () => {
  const source = JSON.stringify({ api_key: "sk-abcdefghijklmnopqrstuvwxyz", email: "person@example.com" });
  const redacted = redactSource(source);
  assert.equal(redacted.includes("sk-abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(redacted.includes("person@example.com"), false);
  assert.ok(runDiagnostics(source, "payload").some((item) => item.code === "sensitive-field"));
});

test("converts normalized messages without a provider runtime", () => {
  const anthropic = convertPayload(payload, "anthropic");
  assert.equal(anthropic.payload.system, "Stay concise.");
  assert.equal(anthropic.payload.messages.some((message) => message.content.some((part) => part.type === "tool_use")), true);
  const openai = convertPayload(payload, "openai");
  assert.equal(openai.payload.messages.some((message) => message.role === "tool" && message.tool_call_id === "call-1"), true);
});

test("normalizes and ranks retrieved chunks", () => {
  const chunks = normalizeRag({ results: [{ rank: 2, content: "second", metadata: { source: "b" } }, { rank: 1, text: "first", source: "a" }] });
  assert.deepEqual(chunks.map((chunk) => chunk.rank), [1, 2]);
  assert.deepEqual(chunks.map((chunk) => chunk.source), ["a", "b"]);
});
