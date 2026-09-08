# Agent knowledge guide

The public learning hub lives at `/learn`. Each concept has a static, shareable page at `/learn/[slug]`, with its own title, description, canonical URL, and social metadata. The sitemap lists every published definition.

This is Context View's editorial vocabulary, not a claimed universal standard. The guide separates data records, interaction boundaries, execution units, system components, and telemetry. It explains framework differences explicitly and treats atoms/modules/components as design vocabulary rather than a mandatory hierarchy.

## Adding or revising a concept

Edit `lib/agent-knowledge.js`. Give each term a stable slug, category, concise summary, definition, illustrative example, boundary note, aliases, related concept slugs, and primary source IDs. Read the linked references before making claims about provider-specific behavior. Set `varying` when ambiguity is central to the term. Keep examples provider-neutral unless an API is named explicitly.

Add primary sources to `SOURCES` and update the review date when reviewing the collection. `app/learn/page.js` contains the teaching narrative; `LOOP_STAGES` defines the interactive diagram. The knowledge routes render content at build time, so public definitions remain readable without waiting for client hydration.

The existing Prompt and Trace inspectors remain at `/`. Links with `?view=prompt` and `?view=trace` open the intended inspector. Drafts continue to use browser session storage.

Production serves real static routes. Unknown URLs return 404 instead of a successful response containing the inspector homepage.

Run the tests and production build, then verify search, loop selection, definition navigation, direct URL loads, and the inspector links in a browser. Confirm the source and the related links remain valid when adding content.
