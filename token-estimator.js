function countCjk(text) {
  return (text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
}

export function estimateTokens(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (!text) return 0;
  const cjk = countCjk(text);
  const remaining = text.length - cjk;
  const words = (text.match(/[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g) || []).length;
  return Math.max(1, Math.ceil(cjk * 1.05 + Math.max(remaining / 4, words * 0.72)));
}

export function estimateByItems(items) {
  return items.map((item) => ({
    id: item.id,
    label: `${item.role} ${item.index + 1}`,
    tokens: estimateTokens(item.raw),
  }));
}

export function estimatePromptSections(root) {
  if (!root || typeof root !== "object") return [];
  const sections = (root.children || []).filter((node) => node.type === "heading");
  const total = sections.reduce((sum, node) => sum + (node.subtreeTokens || 0), 0);
  return sections.map((node, index) => ({
    id: node.id || `section-${index}`,
    label: node.title,
    tokens: node.subtreeTokens || 0,
    startLine: node.line,
    endLine: node.endLine,
    share: total ? (node.subtreeTokens || 0) / total : 0,
    node,
  }));
}

export function analyzeContext({ inputTokens, expectedOutputTokens = 0, contextWindow = 128000, inputPrice = 0, outputPrice = 0 }) {
  const total = inputTokens + expectedOutputTokens;
  const utilization = contextWindow > 0 ? total / contextWindow : 0;
  const remaining = Math.max(0, contextWindow - total);
  const inputCost = (inputTokens / 1_000_000) * inputPrice;
  const outputCost = (expectedOutputTokens / 1_000_000) * outputPrice;
  return {
    inputTokens,
    expectedOutputTokens,
    total,
    contextWindow,
    remaining,
    utilization,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

export function formatCompactNumber(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: number < 10 ? 2 : 0 }).format(number);
}
