import { countToolCalls, normalizeConversation, parseJson } from "./conversation-model.js";
import { estimateTokens } from "./token-estimator.js";

function flatten(value, path = "$", output = new Map()) {
  if (value === null || typeof value !== "object") {
    output.set(path, value);
    return output;
  }
  const entries = Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
  if (!entries.length) output.set(path, Array.isArray(value) ? [] : {});
  entries.forEach(([key, child]) => flatten(child, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, output));
  return output;
}

function stable(value) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function jsonDiff(a, b) {
  const left = flatten(a);
  const right = flatten(b);
  return [...new Set([...left.keys(), ...right.keys()])].sort().map((path) => {
    const hasA = left.has(path);
    const hasB = right.has(path);
    const valueA = left.get(path);
    const valueB = right.get(path);
    const status = !hasA ? "added" : !hasB ? "removed" : Object.is(stable(valueA), stable(valueB)) ? "unchanged" : "changed";
    return { path, a: hasA ? valueA : undefined, b: hasB ? valueB : undefined, status };
  });
}

function lcsDiff(a, b) {
  const left = a.split(/\r?\n/);
  const right = b.split(/\r?\n/);
  if (left.length * right.length > 1_000_000) {
    const length = Math.max(left.length, right.length);
    return Array.from({ length }, (_, index) => ({ path: `line ${index + 1}`, a: left[index], b: right[index], status: left[index] === undefined ? "added" : right[index] === undefined ? "removed" : left[index] === right[index] ? "unchanged" : "changed" }));
  }
  const table = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i -= 1) for (let j = right.length - 1; j >= 0; j -= 1) table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const rows = [];
  let i = 0;
  let j = 0;
  let line = 1;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) { rows.push({ path: `line ${line}`, a: left[i], b: right[j], status: "unchanged" }); i += 1; j += 1; }
    else if (j < right.length && (i === left.length || table[i][j + 1] >= table[i + 1][j])) { rows.push({ path: `line ${line}`, a: undefined, b: right[j], status: "added" }); j += 1; }
    else { rows.push({ path: `line ${line}`, a: left[i], b: undefined, status: "removed" }); i += 1; }
    line += 1;
  }
  return rows;
}

export function compareSources(sourceA, sourceB) {
  const parsedA = parseJson(sourceA);
  const parsedB = parseJson(sourceB);
  const json = parsedA.ok && parsedB.ok;
  const rows = json ? jsonDiff(parsedA.value, parsedB.value) : lcsDiff(sourceA, sourceB);
  const conversationA = parsedA.ok ? normalizeConversation(parsedA.value) : { items: [] };
  const conversationB = parsedB.ok ? normalizeConversation(parsedB.value) : { items: [] };
  return {
    type: json ? "json" : "text",
    rows,
    metrics: {
      tokensA: estimateTokens(sourceA),
      tokensB: estimateTokens(sourceB),
      itemsA: conversationA.items.length,
      itemsB: conversationB.items.length,
      toolsA: countToolCalls(conversationA.items),
      toolsB: countToolCalls(conversationB.items),
      latencyA: parsedA.ok ? Number(parsedA.value?.latency ?? parsedA.value?.duration_ms ?? 0) : 0,
      latencyB: parsedB.ok ? Number(parsedB.value?.latency ?? parsedB.value?.duration_ms ?? 0) : 0,
    },
  };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function displayValue(value) {
  return value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
}

export function renderComparison(result, { showUnchanged = false } = {}) {
  const root = element("div", "section-stack");
  const summary = element("div", "summary-grid");
  const metrics = [
    ["Tokens", `${result.metrics.tokensA} / ${result.metrics.tokensB}`],
    ["Items", `${result.metrics.itemsA} / ${result.metrics.itemsB}`],
    ["Tool calls", `${result.metrics.toolsA} / ${result.metrics.toolsB}`],
    ["Latency delta", `${result.metrics.latencyB - result.metrics.latencyA} ms`],
  ];
  metrics.forEach(([label, value]) => { const metric = element("div", "metric"); metric.append(element("span", "metric-label", label), element("span", "metric-value", value)); summary.append(metric); });
  root.append(summary);

  const table = element("div", "diff-table");
  const rows = result.rows.filter((row) => showUnchanged || row.status !== "unchanged");
  if (!rows.length) table.append(element("div", "empty-state", "No differences."));
  rows.forEach((row) => {
    const line = element("div", `diff-row diff-${row.status}`);
    line.append(element("div", "diff-cell diff-path", `${row.status}: ${row.path}`), element("div", "diff-cell", displayValue(row.a)), element("div", "diff-cell", displayValue(row.b)));
    table.append(line);
  });
  root.append(table);
  return root;
}
