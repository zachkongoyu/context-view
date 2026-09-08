import test from "node:test";
import assert from "node:assert/strict";
import { readingBlocks, sourceRange } from "../prompt-reader.js";

test("section selection preserves CRLF offsets and the final character", () => {
  const source = "# First\r\nEnglish and 中文\r\n\r\n# Last\r\nKeep this final character!";
  const first = sourceRange(source, 1, 3);
  const last = sourceRange(source, 4, 5);
  assert.equal(source.slice(first.start, first.end), "# First\r\nEnglish and 中文");
  assert.equal(source.slice(last.start, last.end), "# Last\r\nKeep this final character!");
});

test("reader maps paragraphs and ordered steps to their original source lines", () => {
  const blocks = readingBlocks("# Workflow\n\nKeep this\ncontinued text.\n\n3. Calculate\n4. Save");
  assert.deepEqual(blocks.map(({ type, line, endLine }) => ({ type, line, endLine })), [
    { type: "heading", line: 1, endLine: 1 },
    { type: "paragraph", line: 3, endLine: 4 },
    { type: "list-item", line: 6, endLine: 6 },
    { type: "list-item", line: 7, endLine: 7 },
  ]);
  assert.equal(blocks[2].number, "3");
});

test("reader keeps markup and apparent headings in code fences as literal content", () => {
  const blocks = readingBlocks("```html\n# Not a section\n<script>alert(1)</script>\n```\n# Real heading");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, "code");
  assert.equal(blocks[0].text, "# Not a section\n<script>alert(1)</script>");
  assert.equal(blocks[0].endLine, 4);
  assert.equal(blocks[1].line, 5);
  assert.equal(readingBlocks("<img src=x onerror=alert(1)>")[0].text, "<img src=x onerror=alert(1)>");
});
