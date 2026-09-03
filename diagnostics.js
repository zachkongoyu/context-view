import { normalizeConversation, parseJson } from "./conversation-model.js";

const SECRET_PATTERNS = [
  { code: "openai-key", label: "Possible OpenAI API key", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { code: "aws-access-key", label: "Possible AWS access key", regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { code: "jwt", label: "Possible JWT", regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { code: "bearer", label: "Possible bearer token", regex: /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi },
  { code: "email", label: "Email address", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
];

const SENSITIVE_KEYS = /^(api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|password|passwd|secret|client[_-]?secret|private[_-]?key|cookie)$/i;

function diagnostic(severity, code, message, path = "$") {
  return { severity, code, message, path };
}

function inspectSensitiveKeys(value, path, output, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectSensitiveKeys(item, `${path}[${index}]`, output, seen));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (SENSITIVE_KEYS.test(key) && child !== "" && child !== null && child !== undefined) {
      output.push(diagnostic("warning", "sensitive-field", `Sensitive field name: ${key}`, childPath));
    }
    inspectSensitiveKeys(child, childPath, output, seen);
  }
}

function inspectToolIntegrity(items, output) {
  const calls = new Map();
  const results = new Map();
  for (const item of items) {
    for (const part of item.parts) {
      if (part.type === "tool_call") {
        const id = part.id ? String(part.id) : "";
        if (!id) output.push(diagnostic("warning", "tool-call-id-missing", "Tool call has no call ID.", `$[${item.index}]`));
        if (id && calls.has(id)) output.push(diagnostic("error", "duplicate-tool-call", `Duplicate tool-call ID: ${id}`, `$[${item.index}]`));
        if (id) calls.set(id, item.index);
        if (typeof part.arguments === "string" && part.arguments.trim()) {
          try { JSON.parse(part.arguments); } catch { output.push(diagnostic("error", "malformed-tool-arguments", `Tool ${part.name || "call"} has malformed JSON arguments.`, `$[${item.index}]`)); }
        }
      }
      if (part.type === "tool_result") {
        const id = part.callId ? String(part.callId) : "";
        if (!id) output.push(diagnostic("warning", "tool-result-id-missing", "Tool result has no matching call ID.", `$[${item.index}]`));
        if (id && results.has(id)) output.push(diagnostic("error", "duplicate-tool-result", `Duplicate tool result: ${id}`, `$[${item.index}]`));
        if (id) results.set(id, item.index);
      }
    }
  }
  for (const [id, index] of calls) {
    if (!results.has(id)) output.push(diagnostic("warning", "unmatched-tool-call", `Tool call ${id} has no result.`, `$[${index}]`));
  }
  for (const [id, index] of results) {
    if (!calls.has(id)) output.push(diagnostic("warning", "unmatched-tool-result", `Tool result ${id} has no call.`, `$[${index}]`));
  }
}

function inspectEmptyMessages(items, output) {
  for (const item of items) {
    if (!["user", "assistant", "context"].includes(item.role)) continue;
    const meaningful = item.parts.some((part) => {
      if (part.type === "text" || part.type === "reasoning") return Boolean(part.text?.trim());
      return part.type !== "unknown";
    });
    if (!meaningful) output.push(diagnostic("warning", "empty-message", `Empty ${item.role} message.`, `$[${item.index}]`));
  }
}

function inspectRawSecrets(source, output) {
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of String(source || "").matchAll(pattern.regex)) {
      output.push({
        severity: "warning",
        code: pattern.code,
        message: pattern.label,
        path: `character ${match.index ?? 0}`,
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
        value: match[0],
      });
    }
  }
}

export function runDiagnostics(source, mode = "payload") {
  const output = [];
  const raw = String(source || "");
  if (!raw.trim()) return output;
  inspectRawSecrets(raw, output);

  if (["payload", "trace", "schema", "rag"].includes(mode)) {
    const parsed = parseJson(raw);
    if (!parsed.ok) {
      output.unshift(diagnostic("error", "invalid-json", `Invalid JSON: ${parsed.error}`));
      return output;
    }
    inspectSensitiveKeys(parsed.value, "$", output);
    if (["payload", "trace"].includes(mode)) {
      const conversation = normalizeConversation(parsed.value);
      if (!conversation.items.length && mode === "payload") output.push(diagnostic("warning", "unknown-root", "No supported message collection was found."));
      inspectEmptyMessages(conversation.items, output);
      inspectToolIntegrity(conversation.items, output);
    }
    if (mode === "rag") {
      const chunks = Array.isArray(parsed.value) ? parsed.value : parsed.value.chunks || parsed.value.results || parsed.value.documents || [];
      chunks.forEach((chunk, index) => {
        if (chunk?.score !== undefined && (typeof chunk.score !== "number" || !Number.isFinite(chunk.score))) output.push(diagnostic("warning", "rag-score", "RAG score is not a finite number.", `$[${index}].score`));
        if (chunk?.rank !== undefined && (!Number.isInteger(chunk.rank) || chunk.rank < 1)) output.push(diagnostic("warning", "rag-rank", "RAG rank should be a positive integer.", `$[${index}].rank`));
        if (!chunk?.source && !chunk?.url && !chunk?.metadata?.source) output.push(diagnostic("info", "rag-source", "Retrieved chunk has no source identifier.", `$[${index}]`));
      });
    }
  }
  return output;
}

function redactObject(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactObject(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, SENSITIVE_KEYS.test(key) ? "[REDACTED]" : redactObject(child, seen)]));
}

export function redactSource(source) {
  const raw = String(source || "");
  const parsed = parseJson(raw);
  let redacted = raw;
  if (parsed.ok) {
    redacted = JSON.stringify(redactObject(parsed.value), null, 2);
  }
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    redacted = redacted.replace(pattern.regex, `[REDACTED:${pattern.code}]`);
  }
  return redacted;
}

export function diagnosticCounts(items) {
  return items.reduce((counts, item) => {
    counts[item.severity] = (counts[item.severity] || 0) + 1;
    return counts;
  }, { error: 0, warning: 0, info: 0 });
}
