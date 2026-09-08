// A deliberately small, text-only Markdown reader. Source HTML is never executed.
export function readingBlocks(source) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  let fence = null;
  lines.forEach((text, index) => {
    const line = index + 1;
    if (fence) {
      fence.endLine = line;
      if (text.trim() === fence.marker) fence = null;
      else fence.text += `${fence.text ? "\n" : ""}${text}`;
      return;
    }
    const marker = text.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (marker) {
      fence = { type: "code", text: "", language: marker[2].trim(), marker: marker[1], line, endLine: line };
      blocks.push(fence);
      return;
    }
    if (!text.trim()) return;
    const heading = text.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    const bullet = text.match(/^\s*(?:[-+*]|(\d+)[.)])\s+(.+)$/);
    const type = heading ? "heading" : bullet ? "list-item" : text.startsWith("> ") ? "quote" : "paragraph";
    const previous = blocks.at(-1);
    if (type === "paragraph" && previous?.type === type && previous.endLine === line - 1) {
      previous.text += `\n${text}`;
      previous.endLine = line;
    } else blocks.push({ type, text: heading?.[2] ?? bullet?.[2] ?? (type === "quote" ? text.slice(2) : text), level: heading?.[1].length, number: bullet?.[1], line, endLine: line });
  });
  return blocks;
}

export function sourceRange(source, startLine, endLine = startLine) {
  const starts = [0];
  for (const match of source.matchAll(/\r?\n/g)) starts.push(match.index + match[0].length);
  const start = starts[Math.max(0, startLine - 1)] ?? source.length;
  let end = starts[endLine] ?? source.length;
  while (end > start && /[\r\n]/.test(source[end - 1])) end -= 1;
  return { start, end };
}

function appendInline(node, text) {
  const pattern = /(`+)([^`]+?)\1|\*\*(.+?)\*\*/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    node.append(document.createTextNode(text.slice(cursor, match.index)));
    const inline = document.createElement(match[2] ? "code" : "strong");
    inline.textContent = match[2] ?? match[3];
    node.append(inline);
    cursor = match.index + match[0].length;
  }
  node.append(document.createTextNode(text.slice(cursor)));
}

export function renderPromptReader(source) {
  const article = document.createElement("article");
  article.className = "prompt-document";
  let list = null;
  let previousLine = 0;
  for (const block of readingBlocks(source)) {
    const tag = block.type === "heading" ? `h${Math.min(6, block.level + 1)}` : block.type === "code" ? "pre" : block.type === "list-item" ? "li" : block.type === "quote" ? "blockquote" : "p";
    const node = document.createElement(tag);
    node.dataset.sourceLine = block.line;
    node.dataset.sourceEnd = block.endLine;
    if (block.type === "heading") node.dataset.headingLevel = block.level;
    if (block.type === "code") node.textContent = block.text;
    else appendInline(node, block.text);
    if (tag === "li") {
      const listTag = block.number ? "OL" : "UL";
      if (!list || list.tagName !== listTag || block.line !== previousLine + 1) {
        list = document.createElement(listTag.toLowerCase());
        if (block.number) list.start = Number(block.number);
        article.append(list);
      }
      list.append(node);
    } else {
      list = null;
      article.append(node);
    }
    previousLine = block.endLine;
  }
  return article;
}
