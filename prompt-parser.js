import { estimateTokens } from "./token-estimator.js";

const OWN_TEXT = Symbol("promptOwnText");

function setOwnText(node, text) {
  Object.defineProperty(node, OWN_TEXT, { value: String(text || ""), writable: true });
  return node;
}

function appendOwnText(node, text) {
  node[OWN_TEXT] = [node[OWN_TEXT], text].filter(Boolean).join("\n");
}

function parseAttributes(tagSource) {
  const attrs = {};
  const body = tagSource
    .replace(/^<\/?\s*[A-Za-z][\w:.-]*/, "")
    .replace(/\/?>\s*$/, "");
  const pattern = /([A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of body.matchAll(pattern)) attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
  return attrs;
}

function closeEntry(entry, endLine) {
  entry.node.endLine = Math.max(entry.node.line, endLine);
}

export function parsePrompt(source) {
  const text = String(source || "");
  const lines = text.split(/\r?\n/);
  const promptRoot = setOwnText({ type: "root", title: "Prompt", children: [], line: 1 }, "");
  const stack = [{ node: promptRoot, kind: "root", xmlDepth: 0 }];
  const warnings = [];
  let fence = null;

  const parent = () => stack.at(-1).node;
  const add = (node) => parent().children.push(node);
  const addText = (value, line) => {
    if (!value) return;
    const children = parent().children;
    const previous = children.at(-1);
    if (previous?.type === "text" && previous.endLine === line - 1) {
      previous.text += `\n${value}`;
      previous.endLine = line;
      appendOwnText(previous, value);
      return;
    }
    children.push(setOwnText({ type: "text", text: value, line, endLine: line }, value));
  };
  const closeHeadings = (level, xmlDepth, endLine) => {
    while (stack.length > 1) {
      const top = stack.at(-1);
      if (top.kind !== "heading" || top.xmlDepth !== xmlDepth || top.level < level) break;
      closeEntry(stack.pop(), endLine);
    }
  };
  const closeXml = (tag, lineNumber, rawTag) => {
    let matchIndex = -1;
    for (let index = stack.length - 1; index > 0; index -= 1) {
      if (stack[index].kind === "xml" && stack[index].tag.toLowerCase() === tag.toLowerCase()) {
        matchIndex = index;
        break;
      }
    }
    if (matchIndex < 0) {
      warnings.push({ severity: "warning", message: `Unmatched closing tag </${tag}>.`, line: lineNumber });
      addText(rawTag, lineNumber);
      return;
    }
    while (stack.length - 1 > matchIndex) {
      const entry = stack.pop();
      closeEntry(entry, lineNumber - 1);
      if (entry.kind === "xml") warnings.push({ severity: "warning", message: `Unclosed tag <${entry.tag}> before </${tag}>.`, line: lineNumber });
    }
    const entry = stack.pop();
    closeEntry(entry, lineNumber);
    appendOwnText(entry.node, rawTag);
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (fence) {
      fence.raw.push(line);
      fence.endLine = lineNumber;
      const closePattern = new RegExp(`^\\s*${fence.marker.replace(/[`~]/g, "\\$&")}\\s*$`);
      if (closePattern.test(line)) {
        const node = setOwnText({
          type: "fence",
          title: fence.info || "Code",
          lang: fence.lang,
          text: fence.body.join("\n"),
          line: fence.line,
          endLine: lineNumber,
          children: [],
        }, fence.raw.join("\n"));
        add(node);
        fence = null;
      } else fence.body.push(line);
      return;
    }

    const fenceMatch = line.match(/^\s*(```|~~~)(.*)$/);
    if (fenceMatch) {
      const info = fenceMatch[2].trim();
      fence = {
        marker: fenceMatch[1],
        info,
        lang: info.split(/\s+/, 1)[0]?.toLowerCase() || "",
        body: [],
        raw: [line],
        line: lineNumber,
        endLine: lineNumber,
      };
      return;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const xmlDepth = stack.filter((entry) => entry.kind === "xml").length;
      closeHeadings(level, xmlDepth, lineNumber - 1);
      const node = setOwnText({ type: "heading", level, title: heading[2], line: lineNumber, endLine: lineNumber, children: [] }, line);
      add(node);
      stack.push({ node, kind: "heading", level, xmlDepth });
      return;
    }

    const tagPattern = /<\/?[A-Za-z][^>]*>/g;
    let cursor = 0;
    let matched = false;
    for (const match of line.matchAll(tagPattern)) {
      matched = true;
      if (match.index > cursor) addText(line.slice(cursor, match.index), lineNumber);
      const rawTag = match[0];
      const closing = /^<\//.test(rawTag);
      const selfClosing = /\/\s*>$/.test(rawTag);
      const name = rawTag.match(/^<\/?\s*([A-Za-z][\w:.-]*)/)?.[1];
      if (!name) {
        addText(rawTag, lineNumber);
      } else if (closing) {
        closeXml(name, lineNumber, rawTag);
      } else {
        const node = setOwnText({
          type: "xml",
          tag: name,
          attrs: parseAttributes(rawTag),
          title: rawTag,
          line: lineNumber,
          endLine: lineNumber,
          children: [],
        }, rawTag);
        add(node);
        if (!selfClosing) {
          const xmlDepth = stack.filter((entry) => entry.kind === "xml").length + 1;
          stack.push({ node, kind: "xml", tag: name, xmlDepth });
        }
      }
      cursor = match.index + rawTag.length;
    }
    if (!matched) addText(line, lineNumber);
    else if (cursor < line.length) addText(line.slice(cursor), lineNumber);
  });

  if (fence) {
    const node = setOwnText({
      type: "fence",
      title: fence.info || "Code",
      lang: fence.lang,
      text: fence.body.join("\n"),
      line: fence.line,
      endLine: lines.length,
      children: [],
    }, fence.raw.join("\n"));
    add(node);
    warnings.push({ severity: "warning", message: "Unclosed code fence.", line: fence.line });
  }

  while (stack.length > 1) {
    const entry = stack.pop();
    closeEntry(entry, lines.length);
    if (entry.kind === "xml") warnings.push({ severity: "warning", message: `Unclosed tag <${entry.tag}>.`, line: entry.node.line });
  }
  promptRoot.endLine = Math.max(1, lines.length);
  promptRoot.warnings = warnings;
  Object.defineProperty(promptRoot, "source", { value: text });
  return promptRoot;
}

export function assignPromptIds(root) {
  const visit = (node, path) => {
    node.id = path;
    (node.children || []).forEach((child, index) => visit(child, path ? `${path}.${index}` : String(index)));
  };
  visit(root, "root");
  return root;
}

export function annotateTokens(root) {
  const visit = (node) => {
    const children = Array.isArray(node.children) ? node.children : [];
    let structuralTokens = 0;
    let directContentTokens = 0;
    for (const child of children) {
      visit(child);
      if (child.type === "text" || child.type === "fence") directContentTokens += child.subtreeTokens;
      else structuralTokens += child.subtreeTokens;
    }
    const ownTokens = node.type === "root" ? 0 : estimateTokens(node[OWN_TEXT] || "");
    node.selfTokens = ownTokens + directContentTokens;
    node.subtreeTokens = node.selfTokens + structuralTokens;
    return node.subtreeTokens;
  };

  const total = visit(root);
  const setShares = (node) => {
    node.share = total ? node.subtreeTokens / total : 0;
    for (const child of node.children || []) setShares(child);
  };
  setShares(root);
  assignPromptIds(root);
  return root;
}
