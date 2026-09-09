// Deterministic teaching examples. No model or external tool is called.
const record = (id, role, kind, text, term, turn = 1) => ({ id, role, kind, text, term, turn });
const request = record("request", "user", "Message", "Has order A104 shipped?", "message");
const call = record("lookup-1", "assistant", "Tool call", 'lookup_order({ order_id: "A104" })', "tool-call");

export function createLabSteps(scenario = "success", followUp = false) {
  const failed = scenario === "failure";
  const result = record("result-1", failed ? "error" : "tool", "Tool result", failed ? "Timeout. The order service did not respond." : 'Shipped · Estimated arrival: Friday', "tool-result");
  const answer = record("answer", "assistant", "Message", failed ? "I couldn’t check the order status. Please try again shortly." : "Yes, A104 has shipped. It should arrive on Friday.", "message");
  const steps = [
    { node: "request", term: "message", title: "A request starts the exchange.", text: "The user’s words become a message: a record with content and a role.", records: [request], modelCalls: 0, toolCalls: 0, turn: 1 },
    { node: "context", term: "context", title: "Build the model’s view.", text: "The runtime prepares instructions, the user’s request, and the tool’s interface as context.", records: [request], modelCalls: 0, toolCalls: 0, turn: 1 },
    { node: "model", term: "model-call", title: "The model requests a tool.", text: "Model call 1 produces a structured tool request. The runtime still has to execute it.", records: [request, call], modelCalls: 1, toolCalls: 1, turn: 1 },
    { node: "tool", term: "tool-result", title: failed ? "The tool returns an error." : "The tool brings back evidence.", text: failed ? "The lookup times out. An error is still a tool result, linked to the original call." : "The runtime executes the lookup and records its result. The model does not query the order system itself.", records: [request, call, result], modelCalls: 1, toolCalls: 1, turn: 1 },
    { node: "context", term: "agent-loop", title: "The result closes the loop.", text: "The result is added to context for the next model call. A tool result alone is not a user-facing answer.", records: [request, call, result], modelCalls: 1, toolCalls: 1, turn: 1 },
    { node: "answer", term: "turn", title: "An answer completes this turn.", text: failed ? "Model call 2 acknowledges the failure instead of inventing a status. This user-facing turn ends here." : "Model call 2 uses the evidence to answer. One user-facing turn contained two model calls and a tool call.", records: [request, call, result, answer], modelCalls: 2, toolCalls: 1, turn: 1, complete: true },
  ];
  if (followUp && !failed) {
    const question = record("follow-up", "user", "Message", "When should I expect it?", "message", 2);
    const response = record("follow-up-answer", "assistant", "Message", "The order lookup estimated Friday.", "message", 2);
    const previous = steps[5].records;
    steps.push(
      { node: "request", term: "conversation", title: "New turn. Same conversation.", text: "A follow-up starts a second user-facing turn. It belongs to the continuing exchange about order A104.", records: [...previous, question], modelCalls: 2, toolCalls: 1, turn: 2 },
      { node: "memory", term: "session", title: "Carry the useful history forward.", text: "In this example, a session retains the exchange. The runtime selects the earlier result into context; stored history is not automatically visible to the model.", records: [...previous, question], modelCalls: 2, toolCalls: 1, turn: 2 },
      { node: "answer", term: "turn", title: "Answer from available context.", text: "Model call 3 answers from the previous lookup. This turn needs no new tool call. Session and conversation scopes vary across applications.", records: [...previous, question, response], modelCalls: 3, toolCalls: 1, turn: 2, complete: true },
    );
  }
  return steps;
}
