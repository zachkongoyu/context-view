import test from "node:test";
import assert from "node:assert/strict";
import { promptDisplaySource, readingBlocks } from "../prompt-reader.js";

test("escaped newlines produce paragraphs while retaining original line mapping", () => {
  const source = "Use Traditional Chinese.\\n\\nDelegated scope: reporting drafts.";
  const display = promptDisplaySource(source);
  assert.equal(readingBlocks(display.text).length, 2);
  assert.deepEqual(display.lineMap, [1, 1, 1]);
  assert.equal(promptDisplaySource("a\\r\\nb\nc").text, "a\nb\nc");
});

test("code and escaped backslashes stay literal", () => {
  const source = "`a\\nb`\n```js\nconst s = 'a\\nb';\n```\nA\\\\nB";
  assert.equal(promptDisplaySource(source).text, source);
});
