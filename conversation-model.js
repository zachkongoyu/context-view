const CONTEXT_ROLES = new Set(["system", "developer", "context"]);
const TOOL_ROLES = new Set(["tool", "function"]);

export function parseJson(source) {
  if (typeof source !== "string") return { ok: true, value: source };
  const text = source.trim();
  if (!text) return { ok: false, error: "Source is empty." };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizeRole(role, item) {
  const raw = String(role || "unknown").toLowerCase();
  if (CONTEXT_ROLES.has(raw)) return "context";
  if (TOOL_ROLES.has(raw)) return "tool";
  if (raw === "model") return "assistant";
  if (raw === "human") return "user";
  if (raw === "ai") return "assistant";
  if (raw === "user" && Array.isArray(item?.content) && item.content.some((part) => part?.type === "tool_result")) return "tool";
  return raw || "unknown";
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeTextPart(value) {
  if (typeof value === "string") return { type: "text", text: value };
  if (value === null || value === undefined) return { type: "text", text: "" };
  return { type: "json", value };
}

function normalizeContent(content) {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (content === null || content === undefined) return [];
  if (!Array.isArray(content)) return [normalizeTextPart(content)];

  return content.flatMap((part) => {
    if (typeof part === "string") return [{ type: "text", text: part }];
    if (!part || typeof part !== "object") return [normalizeTextPart(part)];

    const type = String(part.type || "").toLowerCase();
    if (["text", "input_text", "output_text"].includes(type)) {
      return [{ type: "text", text: String(firstDefined(part.text, part.content, "")) }];
    }
    if (["image", "image_url", "input_image"].includes(type)) {
      return [{ type: "image", url: firstDefined(part.url, part.image_url?.url, part.source?.url), detail: part.detail, raw: part }];
    }
    if (["tool_use", "tool_call", "function_call"].includes(type)) {
      return [{
        type: "tool_call",
        id: firstDefined(part.id, part.call_id),
        name: firstDefined(part.name, part.function?.name),
        arguments: firstDefined(part.input, part.arguments, part.function?.arguments, {}),
        raw: part,
      }];
    }
    if (["tool_result", "function_call_output"].includes(type)) {
      return [{
        type: "tool_result",
        callId: firstDefined(part.tool_use_id, part.call_id, part.id),
        result: firstDefined(part.content, part.output, part.result),
        isError: Boolean(part.is_error),
        raw: part,
      }];
    }
    if (type === "thinking" || type === "reasoning") {
      return [{ type: "reasoning", text: String(firstDefined(part.thinking, part.text, part.summary, "")), raw: part }];
    }
    return [{ type: type || "unknown", value: part }];
  });
}

function openAiToolCalls(item) {
  if (!Array.isArray(item?.tool_calls)) return [];
  return item.tool_calls.map((call) => ({
    type: "tool_call",
    id: firstDefined(call.id, call.call_id),
    name: firstDefined(call.function?.name, call.name),
    arguments: firstDefined(call.function?.arguments, call.arguments, {}),
    raw: call,
  }));
}

function responseOutputParts(item) {
  const type = String(item?.type || "").toLowerCase();
  if (type === "function_call") {
    return [{ type: "tool_call", id: firstDefined(item.call_id, item.id), name: item.name, arguments: item.arguments, raw: item }];
  }
  if (type === "function_call_output") {
    return [{ type: "tool_result", callId: firstDefined(item.call_id, item.id), result: item.output, raw: item }];
  }
  if (type === "reasoning") {
    return [{ type: "reasoning", text: String(firstDefined(item.summary?.[0]?.text, item.content?.[0]?.text, "")), raw: item }];
  }
  return normalizeContent(firstDefined(item.content, item.text));
}

function inferKind(item, parts, role) {
  const explicit = String(firstDefined(item.type, item.kind, "")).toLowerCase();
  if (parts.some((part) => part.type === "tool_call")) return "tool_call";
  if (parts.some((part) => part.type === "tool_result")) return "tool_result";
  if (explicit.includes("error")) return "error";
  if (role === "tool") return "tool_result";
  if (explicit && !["message", "input", "output"].includes(explicit)) return explicit;
  return "message";
}

function metadataFor(item) {
  const omitted = new Set(["content", "parts", "text", "message", "role", "author", "type", "kind", "tool_calls", "function_call", "output", "input"]);
  return Object.fromEntries(Object.entries(safeObject(item)).filter(([key]) => !omitted.has(key)));
}

export function normalizeItem(item, index = 0) {
  if (typeof item === "string") {
    return { id: `item-${index}`, index, role: "unknown", kind: "text", parts: [{ type: "text", text: item }], metadata: {}, raw: item };
  }

  const value = safeObject(item);
  const nestedMessage = safeObject(value.message);
  const base = Object.keys(nestedMessage).length ? { ...value, ...nestedMessage } : value;
  const role = normalizeRole(firstDefined(base.role, base.author?.role, base.author, value.type === "function_call_output" ? "tool" : undefined, value.type === "function_call" ? "assistant" : undefined), base);
  let parts = responseOutputParts(base);
  parts = parts.concat(openAiToolCalls(base));

  if (base.function_call) {
    parts.push({
      type: "tool_call",
      id: firstDefined(base.function_call.id, base.call_id),
      name: base.function_call.name,
      arguments: base.function_call.arguments,
      raw: base.function_call,
    });
  }

  if (role === "tool" && !parts.some((part) => part.type === "tool_result")) {
    parts = [{ type: "tool_result", callId: firstDefined(base.tool_call_id, base.call_id, base.tool_use_id), result: firstDefined(base.output, base.result, base.content), raw: base }];
  }

  const firstCall = parts.find((part) => part.type === "tool_call");
  const firstResult = parts.find((part) => part.type === "tool_result");
  return {
    id: String(firstDefined(base.id, base.call_id, base.tool_call_id, `item-${index}`)),
    index,
    role,
    actor: role,
    kind: inferKind(base, parts, role),
    parts,
    toolCallId: firstDefined(firstCall?.id, firstResult?.callId, base.tool_call_id, base.call_id),
    toolName: firstDefined(firstCall?.name, base.name),
    timestamp: firstDefined(base.timestamp, base.created_at, base.created),
    status: base.status,
    metadata: metadataFor(base),
    raw: item,
  };
}

function rootItems(root) {
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== "object") return [];
  if (Array.isArray(root.messages)) return root.messages;
  if (Array.isArray(root.input)) return root.input;
  if (Array.isArray(root.contents)) return root.contents;
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.output)) return root.output;
  if (Array.isArray(root.content)) return [{ ...root, content: root.content }];
  if (Array.isArray(root.choices)) return root.choices.map((choice) => ({ ...choice, ...safeObject(choice.message), metadata: safeObject(choice).metadata }));
  if (root.message) return [root.message];
  if (root.response) return rootItems(root.response);
  return [];
}

export function normalizeConversation(root) {
  const sourceItems = rootItems(root);
  const items = sourceItems.map((item, index) => normalizeItem(item, index));
  const metadata = safeObject(root);
  return {
    items,
    turns: groupTurns(items),
    rounds: groupRounds(groupTurns(items)),
    metadata: {
      provider: firstDefined(metadata.provider, metadata.system_fingerprint ? "openai" : undefined),
      model: firstDefined(metadata.model, metadata.model_id),
      id: firstDefined(metadata.id, metadata.request_id, metadata.run_id),
      status: metadata.status,
      usage: firstDefined(metadata.usage, metadata.token_usage),
      latency: firstDefined(metadata.latency, metadata.duration, metadata.duration_ms),
    },
    raw: root,
  };
}

export function groupTurns(items) {
  const turns = [];
  for (const item of items) {
    const context = item.role === "context";
    const previous = turns.at(-1);
    if (previous && previous.actor === item.role && previous.context === context) {
      previous.items.push(item);
      previous.endIndex = item.index;
    } else {
      turns.push({
        id: `turn-${turns.length}`,
        actor: item.role,
        context,
        inferred: true,
        startIndex: item.index,
        endIndex: item.index,
        items: [item],
      });
    }
  }
  return turns;
}

export function groupRounds(turns) {
  const contextTurns = turns.filter((turn) => turn.context);
  const conversational = turns.filter((turn) => !turn.context);
  const rounds = [];
  let current = null;

  for (const turn of conversational) {
    if (turn.actor === "user" || !current) {
      current = {
        id: `round-${rounds.length}`,
        inferred: true,
        turns: [],
        startIndex: turn.startIndex,
        endIndex: turn.endIndex,
      };
      rounds.push(current);
    }
    current.turns.push(turn);
    current.endIndex = turn.endIndex;
  }

  return { context: contextTurns, rounds };
}

export function findToolLinks(items) {
  const calls = new Map();
  const results = new Map();
  for (const item of items) {
    for (const part of item.parts) {
      if (part.type === "tool_call" && part.id) calls.set(String(part.id), item.id);
      if (part.type === "tool_result" && part.callId) results.set(String(part.callId), item.id);
    }
  }
  return { calls, results };
}

export function countToolCalls(items) {
  return items.reduce((count, item) => count + item.parts.filter((part) => part.type === "tool_call").length, 0);
}
