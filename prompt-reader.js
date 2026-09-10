// A text-only Markdown and XML reader. Source tags are never inserted as HTML.
export function readingBlocks(source, firstLine = 1, allowXml = true) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index];
    const line = firstLine + index;
    if (fence) {
      fence.endLine = line;
      if (text.trim() === fence.marker) fence = null;
      else fence.text += `${fence.text ? "\n" : ""}${text}`;
      continue;
    }
    const marker = text.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (marker) {
      fence = { type: "code", text: "", language: marker[2].trim(), marker: marker[1], line, endLine: line };
      blocks.push(fence);
      continue;
    }
    if (!text.trim()) continue;
    if (allowXml && /^\s*<[A-Za-z_]/.test(text)) {
      const remaining = lines.slice(index).join("\n");
      const xml = parseXml(remaining, line);
      if (xml && !remaining.slice(xml.end).split("\n")[0].trim()) {
        blocks.push(xml.block);
        index += remaining.slice(0, xml.end).split("\n").length - 1;
        continue;
      }
    }
    const heading = text.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    const bullet = text.match(/^\s*(?:[-+*]|(\d+)[.)])\s+(.+)$/);
    const type = heading ? "heading" : bullet ? "list-item" : text.startsWith("> ") ? "quote" : "paragraph";
    const previous = blocks.at(-1);
    if (type === "paragraph" && previous?.type === type && previous.endLine === line - 1) {
      previous.text += `\n${text}`;
      previous.endLine = line;
    } else blocks.push({ type, text: heading?.[2] ?? bullet?.[2] ?? (type === "quote" ? text.slice(2) : text), level: heading?.[1].length, number: bullet?.[1], line, endLine: line });
  }
  return blocks;
}

// Parse only balanced elements with quoted attributes. Incomplete markup falls
// back to the original text. Comments, CDATA, and fenced code cannot close tags.
function parseXml(source, firstLine) {
  const tokens = /^\s*(`{3,}|~{3,})[^\n]*$|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[A-Za-z_][\w:.-]*(?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"]*"|'[^']*'))*\s*\/?>/gm;
  const stack = [];
  let cursor = 0;
  let line = firstLine;
  let fence = null;
  const countLines = (text) => (text.match(/\n/g) || []).length;
  function appendText(end) {
    const text = source.slice(cursor, end);
    if (stack.length && text.trim()) stack.at(-1).children.push(...readingBlocks(text, line, false));
    line += countLines(text);
    cursor = end;
  }
  for (const match of source.matchAll(tokens)) {
    const token = match[0];
    if (match[1]) {
      if (!fence) fence = match[1];
      else if (token.trim() === fence) fence = null;
      continue;
    }
    if (fence) continue;
    if (token.startsWith('<!')) continue;
    if (!stack.length && source.slice(0, match.index).trim()) return null;
    appendText(match.index);
    const closing = token.startsWith('</');
    const name = token.match(/^<\/?([\w:.-]+)/)[1];
    if (closing) {
      if (!stack.length || stack.at(-1).name !== name || !/^<\/[\w:.-]+\s*>$/.test(token)) return null;
      const block = stack.pop();
      block.endLine = line + countLines(token);
      cursor = match.index + token.length;
      line = block.endLine;
      if (!stack.length) return { block, end: cursor };
    } else {
      if (stack.length >= 128) return null;
      const attributes = [...token.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => ({ name: m[1], value: m[2] ?? m[3] }));
      const block = { type: 'xml', name, attributes, children: [], selfClosing: /\/\s*>$/.test(token), line, endLine: line + countLines(token) };
      if (stack.length) stack.at(-1).children.push(block);
      cursor = match.index + token.length;
      line = block.endLine;
      if (!block.selfClosing) stack.push(block);
      else if (!stack.length) return { block, end: cursor };
    }
  }
  return null;
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
  appendBlocks(article, readingBlocks(source));
  return article;
}

function appendBlocks(article, blocks) {
  let list = null;
  let previousLine = 0;
  for (const block of blocks) {
    if (block.type === "xml") {
      article.append(renderXml(block));
      list = null;
      previousLine = block.endLine;
      continue;
    }
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

function renderXml(block) {
  const node = document.createElement("section");
  const grouped = block.children.some(child => child.type === "xml");
  node.className = `xml-node ${grouped ? "xml-group" : "xml-field"}`;
  node.setAttribute("aria-label", `${block.name} XML element`);
  node.dataset.sourceLine = block.line;
  node.dataset.sourceEnd = block.endLine;
  const header = document.createElement("div");
  header.className = "xml-header";
  const name = document.createElement("span");
  name.className = "xml-name";
  name.textContent = block.name;
  header.append(name);
  for (const attribute of block.attributes) {
    const badge = document.createElement("span");
    badge.className = "xml-attribute";
    badge.textContent = `${attribute.name}="${attribute.value}"`;
    header.append(badge);
  }
  if (grouped || !block.children.length) {
    const info = document.createElement("span");
    info.className = "xml-info";
    const count = block.children.filter(child => child.type === "xml").length;
    info.textContent = grouped ? `${count} ${count === 1 ? "element" : "elements"}` : block.selfClosing ? "Self-closing" : "Empty";
    header.append(info);
  }
  node.append(header);
  if (block.children.length) {
    const body = document.createElement("div");
    body.className = "xml-body";
    appendBlocks(body, block.children);
    node.append(body);
  }
  return node;
}
