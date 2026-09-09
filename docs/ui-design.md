# Context View: inspection workspace

## Shared identity and learning experience

The September 2026 learning experience is an interactive agent lab. Warm ink surfaces, peach actions, lavender context and memory, and cyan tools connect the learning canvas with Prompt and Trace. New visitors start in dark mode; existing theme preferences are preserved. Light mode uses warm paper surfaces with the same dark execution canvas.

The opening example can be played, paused, rewound, or stepped through. Records appear beside the active component. A successful order lookup and a tool timeout show how results become context for the next model call. A follow-up demonstrates a second turn using retained history. Clicking a component, record, turn boundary, or session reveals its definition in place.

The illustration uses original SVG and CSS, with Motion for record entry transitions. Animation runs only during user-initiated playback and respects reduced-motion preferences. Scenarios are deterministic teaching examples with no model or external tool calls. Playback positions do not represent measured execution durations.

The guide keeps its searchable 30-concept vocabulary and sourced articles. Narrow screens stack the canvas and records. Distinct shapes supplement semantic colors. The research and the reasons for these choices are recorded in [UI and UX references](ui-ux-research-2026.md).

The primary workflow is reading a real prompt and navigating its structure. The supplied GD sales prompt exposed two problems: the source textarea grew beyond 5,000 pixels, and selecting a late section scrolled the analysis out of view. Long outline labels were also truncated.

## Reference patterns

Reviewed on 8 September 2026 using official product documentation:

- [Langfuse observability](https://langfuse.com/docs/observability/overview): a persistent observation tree beside the selected observation's inputs, outputs, and metadata.
- [Braintrust trace inspection](https://www.braintrust.dev/docs/observe/examine-traces): separate hierarchy, conversation, and timeline views; metrics within hierarchy rows; search that retains matching spans' parents; readable and raw representations.
- [LangSmith trace views](https://docs.langchain.com/langsmith/view-traces): conversation context stays available while inspecting a specific run; reading messages and debugging details are separate tasks.
- [Grafana trace exploration](https://grafana.com/docs/grafana/latest/visualizations/explore/trace-integration/): a timeline for measured execution duration, search, collapsible spans, and details revealed on selection.

## Application to this project

These are design decisions inferred from the references, rather than requirements imposed by them:

- Use a narrow outline beside a wide document reader. Keep both within the desktop viewport with independent scrolling.
- Begin large documents with their top-level sections. Reveal subsections on demand, or through search. Keep parent labels visible in search results.
- Keep estimated tokens and distribution compact. Full section names and readable content take priority over decorative charts.
- Selecting a section highlights and scrolls its source without displacing the outline. Read and Edit share the same source ranges.
- Render headings, lists, and inline code for reading; retain the exact editable source. Never execute source HTML.
- Treat prompt token weights as estimates of composition. They do not establish instruction quality or execution behavior. Time-based charts belong to trace data.
- Preserve separate prompt and trace drafts within the current browser tab session. File opening is local and does not upload prompt content.
- On smaller screens, stack the reader and outline while keeping each scroll area bounded.

## Trace inspection

The original Trace screen permanently reserved a third of the workspace for JSON, required horizontal scrolling to reach the waterfall, and covered events with an overlay when inspecting details.

- Give execution data the full workspace. Source editing opens on demand; file import and an example remain readily available.
- Keep the event list and selected event details side by side, each with bounded scrolling. Compact overview metrics leave room for the events themselves.
- Provide a measured timeline and a message view. Search includes recorded payloads and combines with All, Tools, and Errors filters.
- Separate Content, Metadata, and Raw views. Tool arguments and outputs are formatted and linked by call ID. Arrow keys and previous/next controls navigate events.
- Distinguish absent timing from recorded zero durations. Mark inferred starts, use recorded order when timing is absent, and label incomplete duration coverage as an observed span.
- Count tool calls once; results are separate events. Surface event errors even when the enclosing run says it completed. Reported run tokens remain separate from the source-size estimate.
- Stack events and details on narrow screens. Selecting an event brings its details into view.

Trace data currently represents ordered events and linked calls/results. It does not establish a nested span hierarchy. Future work can add span-tree support for formats that record parent relationships, resizable panes, and exact model tokenizers.
