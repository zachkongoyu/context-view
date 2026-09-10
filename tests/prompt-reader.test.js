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

 test("XML skill collections expose nested fields with their original line ranges", () => {
  const source = '# Skills\r\n<available_skills>\r\n<skill>\r\n<name>presentations</name>\r\n<description>Create **slides**.\r\nKeep them readable.</description>\r\n</skill>\r\n<skill><name>reports</name></skill>\r\n</available_skills>';
  const blocks = readingBlocks(source);
  const root = blocks[1];
  assert.equal(root.type, 'xml');
  assert.equal(root.name, 'available_skills');
  assert.equal(root.endLine, 9);
  const entries = root.children.filter(b => b.type === 'xml');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].children[0].name, 'name');
  assert.equal(entries[0].children[0].children[0].text, 'presentations');
  assert.equal(entries[0].children[1].line, 5);
  assert.equal(entries[0].children[1].endLine, 6);
  assert.equal(entries[1].line, 8);
 });

 test("XML attributes, mixed content, and self-closing elements retain their structure", () => {
  const [root] = readingBlocks('<file\n path="src/a>b.js" mode="read">\nBefore <reference id="one" /> after.\n</file>');
  assert.equal(root.type, 'xml');
  assert.deepEqual(root.attributes, [{name:'path',value:'src/a>b.js'}, {name:'mode',value:'read'}]);
  assert.equal(root.children[1].name, 'reference');
  assert.equal(root.children[1].selfClosing, true);
  assert.equal(root.children[2].text, ' after.');
 });

 test("Malformed XML stays visible and XML-like text inside fences stays code", () => {
  const malformed = '<skills>\n<skill>text</skills>';
  assert.equal(readingBlocks(malformed)[0].text, malformed);
  const [root] = readingBlocks('<instructions>\n```xml\n<example></instructions>\n```\n</instructions>');
  assert.equal(root.name, 'instructions');
  assert.equal(root.children[0].type, 'code');
  assert.equal(root.children[0].text, '<example></instructions>');
 });
