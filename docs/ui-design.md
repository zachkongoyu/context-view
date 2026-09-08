# Context View: inspection workspace

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

Future work can extend the same pattern with resizable panes, exact model tokenizers, and richer trace-specific detail views. Those are separate from the current long-prompt navigation fix.
