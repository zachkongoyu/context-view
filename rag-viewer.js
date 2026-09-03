import { estimateTokens } from "./token-estimator.js";

function firstDefined(...values) { return values.find((value) => value !== undefined && value !== null); }

export function normalizeRag(root) {
  const source = Array.isArray(root) ? root : firstDefined(root?.chunks, root?.results, root?.documents, root?.matches, root?.data, []);
  const items = Array.isArray(source) ? source : [];
  return items.map((item, index) => {
    const value = typeof item === "string" ? { text: item } : item || {};
    const metadata = value.metadata || {};
    const text = String(firstDefined(value.text, value.content, value.page_content, value.document?.text, value.document?.content, ""));
    return {
      id: String(firstDefined(value.id, value.chunk_id, metadata.id, `chunk-${index}`)),
      rank: Number(firstDefined(value.rank, index + 1)),
      score: firstDefined(value.score, value.similarity, value.relevance_score, value.distance),
      source: String(firstDefined(value.source, value.url, value.title, metadata.source, metadata.url, metadata.title, "Unknown source")),
      text,
      tokens: estimateTokens(text),
      metadata,
      raw: item,
    };
  }).sort((a, b) => a.rank - b.rank);
}

function terms(text) {
  return new Set(String(text).toLowerCase().match(/[a-z0-9_]{3,}/g) || []);
}

function overlap(a, b) {
  const left = terms(a);
  const right = terms(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  left.forEach((term) => { if (right.has(term)) shared += 1; });
  return shared / new Set([...left, ...right]).size;
}

export function analyzeRag(items) {
  const warnings = [];
  for (let i = 0; i < items.length; i += 1) {
    if (!items[i].text.trim()) warnings.push({ severity: "warning", message: `Rank ${items[i].rank} has empty content.` });
    for (let j = i + 1; j < items.length; j += 1) {
      const ratio = overlap(items[i].text, items[j].text);
      if (ratio >= 0.72) warnings.push({ severity: "info", message: `Ranks ${items[i].rank} and ${items[j].rank} strongly overlap (${Math.round(ratio * 100)}%).` });
    }
  }
  return {
    totalTokens: items.reduce((sum, item) => sum + item.tokens, 0),
    sourceCount: new Set(items.map((item) => item.source)).size,
    warnings,
  };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

export function renderRag(items) {
  const root = element("div", "section-stack");
  const analysis = analyzeRag(items);
  const summary = element("div", "summary-grid");
  [["Chunks", items.length], ["Sources", analysis.sourceCount], ["Est. tokens", analysis.totalTokens], ["Warnings", analysis.warnings.length]].forEach(([label, value]) => { const metric = element("div", "metric"); metric.append(element("span", "metric-label", label), element("span", "metric-value", value)); summary.append(metric); });
  root.append(summary);

  if (analysis.warnings.length) {
    const warnings = element("div", "validation-list");
    analysis.warnings.forEach((warning) => warnings.append(element("div", `validation-item ${warning.severity}`, warning.message)));
    root.append(warnings);
  }

  const list = element("div", "rag-list");
  items.forEach((item) => {
    const row = element("article", "rag-chunk");
    row.append(element("div", "rag-rank", item.rank));
    const body = element("div", "rag-body");
    const head = element("div", "rag-head");
    head.append(element("span", "rag-source", item.source), element("span", "rag-score", `score ${item.score ?? "n/a"} | ${item.tokens} tokens`));
    body.append(head, element("div", "rag-text", item.text));
    if (Object.keys(item.metadata).length) { const details = element("details", "node"); const summaryNode = element("summary", "", "Metadata"); const pre = element("pre", "", JSON.stringify(item.metadata, null, 2)); const detailBody = element("div", "node-body"); detailBody.append(pre); details.append(summaryNode, detailBody); body.append(details); }
    row.append(body);
    list.append(row);
  });
  root.append(list);
  return root;
}
