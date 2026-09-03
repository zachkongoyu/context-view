import { normalizeConversation } from "./conversation-model.js";

function textOf(item) {
  return item.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n");
}

function parseArguments(value, warnings, label) {
  if (typeof value !== "string") return value ?? {};
  try { return JSON.parse(value); }
  catch { warnings.push(`${label} arguments remain a string because they are not valid JSON.`); return value; }
}

function toOpenAI(items, warnings) {
  return {
    messages: items.flatMap((item) => {
      if (item.role === "context") return [{ role: "system", content: textOf(item) }];
      const calls = item.parts.filter((part) => part.type === "tool_call");
      const results = item.parts.filter((part) => part.type === "tool_result");
      if (results.length) return results.map((part) => ({ role: "tool", tool_call_id: part.callId, content: typeof part.result === "string" ? part.result : JSON.stringify(part.result) }));
      const message = { role: ["user", "assistant"].includes(item.role) ? item.role : "user", content: textOf(item) || null };
      if (calls.length) message.tool_calls = calls.map((part) => ({ id: part.id, type: "function", function: { name: part.name, arguments: typeof part.arguments === "string" ? part.arguments : JSON.stringify(part.arguments ?? {}) } }));
      return [message];
    }),
  };
}

function toAnthropic(items, warnings) {
  const system = items.filter((item) => item.role === "context").map(textOf).filter(Boolean).join("\n\n");
  const messages = [];
  for (const item of items.filter((candidate) => candidate.role !== "context")) {
    const content = [];
    const text = textOf(item);
    if (text) content.push({ type: "text", text });
    item.parts.filter((part) => part.type === "tool_call").forEach((part) => content.push({ type: "tool_use", id: part.id, name: part.name, input: parseArguments(part.arguments, warnings, part.name || "Tool") }));
    item.parts.filter((part) => part.type === "tool_result").forEach((part) => content.push({ type: "tool_result", tool_use_id: part.callId, content: typeof part.result === "string" ? part.result : JSON.stringify(part.result), is_error: Boolean(part.isError) }));
    const role = item.parts.some((part) => part.type === "tool_result") ? "user" : item.role === "assistant" ? "assistant" : "user";
    messages.push({ role, content });
  }
  return system ? { system, messages } : { messages };
}

function toGemini(items, warnings) {
  const systemInstruction = items.filter((item) => item.role === "context").map(textOf).filter(Boolean).join("\n\n");
  const contents = items.filter((item) => item.role !== "context").map((item) => {
    const parts = [];
    const text = textOf(item);
    if (text) parts.push({ text });
    item.parts.filter((part) => part.type === "tool_call").forEach((part) => parts.push({ functionCall: { name: part.name, args: parseArguments(part.arguments, warnings, part.name || "Tool") } }));
    item.parts.filter((part) => part.type === "tool_result").forEach((part) => parts.push({ functionResponse: { name: item.toolName || "tool", response: typeof part.result === "object" ? part.result : { result: part.result } } }));
    return { role: item.role === "assistant" ? "model" : "user", parts };
  });
  return systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] }, contents } : { contents };
}

function toCohere(items, warnings) {
  warnings.push("Cohere tool-call conversion is best effort because payload shapes vary by API generation.");
  const preamble = items.filter((item) => item.role === "context").map(textOf).filter(Boolean).join("\n\n");
  const chatHistory = items.filter((item) => item.role !== "context").map((item) => ({ role: item.role === "assistant" ? "CHATBOT" : item.role === "tool" ? "TOOL" : "USER", message: textOf(item) || JSON.stringify(item.parts) }));
  return preamble ? { preamble, chat_history: chatHistory } : { chat_history: chatHistory };
}

export function convertPayload(root, target) {
  const conversation = normalizeConversation(root);
  const warnings = [];
  if (!conversation.items.length) return { payload: null, warnings: ["No supported messages were found."] };
  const normalizedTarget = String(target).toLowerCase();
  let payload;
  if (normalizedTarget === "openai") payload = toOpenAI(conversation.items, warnings);
  else if (normalizedTarget === "anthropic") payload = toAnthropic(conversation.items, warnings);
  else if (normalizedTarget === "gemini") payload = toGemini(conversation.items, warnings);
  else if (normalizedTarget === "cohere") payload = toCohere(conversation.items, warnings);
  else throw new Error(`Unsupported conversion target: ${target}`);
  return { payload, warnings };
}
