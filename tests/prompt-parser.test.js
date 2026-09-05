import test from "node:test";
import assert from "node:assert/strict";
import { annotateTokens, parsePrompt } from "../prompt-parser.js";

test("builds headings, XML boundaries, and fences at their structural depth", () => {
  const root = parsePrompt(`# Input

<repository_context>
## Nested
<file path="src/parser.js">
\`\`\`js
const value = 1;
\`\`\`
</file>
</repository_context>

# Output
Done.`);

  assert.deepEqual(root.children.filter((node) => node.type === "heading").map((node) => node.title), ["Input", "Output"]);
  const input = root.children[0];
  const repository = input.children.find((node) => node.type === "xml");
  assert.equal(repository.tag, "repository_context");
  const nested = repository.children.find((node) => node.type === "heading");
  assert.equal(nested.title, "Nested");
  const file = nested.children.find((node) => node.type === "xml");
  assert.deepEqual(file.attrs, { path: "src/parser.js" });
  const fence = file.children.find((node) => node.type === "fence");
  assert.equal(fence.lang, "js");
  assert.equal(fence.text, "const value = 1;");
  assert.equal(fence.line, 6);
  assert.equal(fence.endLine, 8);
});

test("separates direct token cost from descendant subtree cost", () => {
  const root = annotateTokens(parsePrompt(`# Input
direct words
<context>
deep descendant words
</context>`));
  const input = root.children[0];
  const boundary = input.children.find((node) => node.type === "xml");

  assert.ok(input.selfTokens > 0);
  assert.ok(boundary.subtreeTokens > 0);
  assert.equal(input.subtreeTokens, input.selfTokens + boundary.subtreeTokens);
  assert.equal(root.subtreeTokens, input.subtreeTokens);
  assert.equal(input.share, 1);
  assert.equal(boundary.share, boundary.subtreeTokens / root.subtreeTokens);
});

test("keeps an unclosed XML boundary without throwing", () => {
  const root = parsePrompt(`# Input
<context>
content`);
  const input = root.children[0];
  const boundary = input.children.find((node) => node.type === "xml");

  assert.equal(boundary.tag, "context");
  assert.equal(boundary.endLine, 3);
  assert.ok(root.warnings.some((warning) => warning.message.includes("Unclosed tag <context>")));
});

test("treats headings and tags inside fences as code text", () => {
  const root = parsePrompt(`# Input
\`\`\`md
# Not a heading
<context>not a boundary</context>
\`\`\``);
  const input = root.children[0];
  const fence = input.children.find((node) => node.type === "fence");

  assert.equal(input.children.filter((node) => node.type === "heading").length, 0);
  assert.equal(input.children.filter((node) => node.type === "xml").length, 0);
  assert.equal(fence.text, "# Not a heading\n<context>not a boundary</context>");
});
