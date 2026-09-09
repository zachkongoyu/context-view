# UI and UX references for Context View

Researched 9 September 2026. This research informed the interactive agent lab implemented on the same date. Dated publications below are from 2026; live examples were inspected on the research date and are not claimed to have launched in 2026.

## Evidence and application

| Reference | What the source shows | Application to Context View (our interpretation) |
| --- | --- | --- |
| [Webflow: 2026 web design trends](https://webflow.com/blog/web-design-trends-2026), updated 8 January | Custom visual systems, fuller palettes, distinctive typography, short summaries, and guided exploration. | Build a recognizable visual language out of agent concepts. Avoid making a standard component grid carry the entire identity. |
| [Springboards](https://springboards.ai/), live visual inspection | A conspicuous square-dot field, pixel-shaped brand elements, sharp buttons, and large bottom-positioned hero copy. | A repeated graphic motif can connect the whole site. Use a motif that describes information moving through an agent. |
| [React Bits](https://reactbits.dev/), live interaction inspection | The hero combines a rendered background with editable parameters and presets. Selecting Ember changed the selected preset and preview parameters. | Make the opening experience usable: choose an example, step through execution, and inspect a concept in place. |
| [Linear: March interface refresh](https://linear.app/now/behind-the-latest-design-refresh), 12 March | Muted navigation, more consistent controls, fewer competing icons, and softer separators. The team compared alternatives inside the running product. | Prompt and Trace should prioritize source and evidence. Keep actions predictable and reduce repeated framing around data. |
| [Vercel: dashboard navigation redesign](https://vercel.com/changelog/dashboard-navigation-redesign-rollout), 26 February | A resizable, hideable sidebar; consistent navigation; project filters; and a floating mobile bottom bar. | Navigation should adapt to the activity and available width. Give inspection and reading sufficient room. |
| [Brilliant: how it teaches](https://brilliant.org/resources/choosing-brilliant/how-brilliant-teaches-math/), updated 26 August | Manipulable visual problems, small conceptual steps, immediate feedback, and explanations connected to what the learner tried. | Teach a message or turn through an example before asking readers to absorb a definition. |
| [Braintrust: examining traces](https://www.braintrust.dev/docs/observe/examine-traces), current documentation | Multiple representations of execution, including hierarchy, timeline, and conversation, with detailed inspection. | Give each representation a question to answer. A timeline explains timing; a conversation explains the exchange. |

The January Webflow report mentions Pencil's earlier ASCII-art homepage. Its URL now redirects to [pen.dev](https://www.pen.dev/), whose live page uses a different presentation. The historical screenshot should not be treated as the current design.

## Assessment of the current site

These are judgments about our implementation, not claims from the sources:

- The visual refresh depends heavily on an oversized heading, an accent color, and repeated bordered rectangles.
- The hero's system map links to definitions, but does not demonstrate how an agent works.
- The loop mostly changes explanatory text. Readers cannot yet test a scenario or see the corresponding records accumulate.
- Too many sections use the same visual hierarchy. The page has little variation between a diagram, a glossary, and a comparison.
- The site has useful information, but its graphic language does not yet make messages, turns, sessions, and executions immediately distinguishable.

## Proposed direction

Create an explorable agent run as the main learning experience. A clearly labeled illustrative scenario starts with an order-status question. Step controls move through prepared context, model output, a tool request, its result, and the answer. The interface keeps the evolving messages and execution position visible together.

Selecting a record should explain the term in place. A follow-up question should demonstrate a second turn within the same conversation. A separate continuity explanation should show why session scope is application-defined. The presentation must preserve these distinctions rather than inventing a universal nesting model.

Give different concepts distinct shapes and consistent colors: message records, turn brackets, continuity tracks, and execution markers. Use that visual vocabulary in the guide illustrations and inspector annotations. A small coherent palette can be expressive without assigning arbitrary colors to every card.

Keep the glossary available as a fast reference, with full sourced articles one click away. Reserve prominent animation for the element currently being explained; every interaction needs a static and reduced-motion equivalent.

## What the next prototype must demonstrate

1. The first screen gives a visitor something meaningful to try.
2. A short scenario makes the difference between a message and a turn visible.
3. Interaction changes the example as well as the explanatory text.
4. The site has a recognizable visual identity even in a still screenshot.
5. Prompt and Trace remain readable, with stable selection and predictable controls.
6. Narrow screens retain the same learning relationships without a miniature desktop canvas.
