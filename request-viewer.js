import { renderPromptReader } from './prompt-reader.js';

export function normalizeRequest(value) {
  if (!value || Array.isArray(value) || !Array.isArray(value.messages)) return null;
  const tools = Array.isArray(value.tools) ? value.tools : [];
  return {
    model: value.model ?? 'Not provided',
    messages: value.messages.map((message, index) => ({ index, role: message?.role ?? 'unknown', content: message?.content, raw: message })),
    tools: tools.map((tool, index) => {
      const definition = tool?.function ?? tool ?? {};
      return { index, name: definition.name ?? `Tool ${index + 1}`, type: tool?.type ?? 'unknown', description: definition.description ?? '', parameters: definition.parameters ?? definition.input_schema, raw: tool };
    }),
    settings: Object.fromEntries(Object.entries(value).filter(([key]) => !['messages', 'tools', 'model'].includes(key))),
    raw: value,
  };
}

export function filterRequestTools(tools, query) {
  const search = query.trim().toLowerCase();
  return tools.filter(tool => JSON.stringify(tool.raw).toLowerCase().includes(search));
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function json(value) { return el('pre', 'request-json', JSON.stringify(value, null, 2) ?? 'Not provided'); }
function button(text, action, cls = 'request-button') {
  const node = el('button', cls, text); node.type = 'button'; node.addEventListener('click', action); return node;
}
function empty(text) { return el('p', 'request-empty', text); }
function content(value) {
  if (typeof value === 'string') return renderPromptReader(value);
  if (value === null || value === undefined) return empty('No text content. See the other message fields below.');
  if (Array.isArray(value)) {
    const root = el('div', 'request-content-blocks');
    value.forEach((part, index) => {
      const block = el('section', 'request-content-block');
      block.append(el('h4', '', `${index + 1} · ${part?.type ?? 'Content block'}`));
      if (typeof part?.text === 'string') block.append(renderPromptReader(part.text));
      else block.append(json(part));
      root.append(block);
    });
    return root;
  }
  return json(value);
}

export function renderRequest(request, options = {}) {
  const root = el('div', 'request-inspector');
  let active = ['Overview', 'Messages', 'Tools', 'Settings', 'Raw'].includes(options.requestTab) ? options.requestTab : 'Messages';
  let query = options.toolQuery ?? '';
  let selected = options.selectedTool ?? 0;
  const save = () => options.onStateChange?.({ ...options, requestTab: active, toolQuery: query, selectedTool: selected });
  const heading = el('div', 'request-heading');
  const title = el('div');
  title.append(el('span', 'request-eyebrow', 'MODEL REQUEST'), el('h3', '', request.model));
  const badges = el('div', 'request-badges');
  badges.append(el('span', '', `${request.messages.length} messages`), el('span', '', `${request.tools.length} available tools`));
  heading.append(title, badges);
  const nav = el('nav', 'request-tabs'); nav.setAttribute('aria-label', 'Request views');
  const panel = el('div', 'request-panel');
  const controls = new Map();
  for (const name of ['Overview', 'Messages', 'Tools', 'Settings', 'Raw']) {
    const control = button(name, () => { active = name; save(); draw(); });
    control.setAttribute('aria-controls', 'request-content');
    controls.set(name, control); nav.append(control);
  }
  panel.id = 'request-content'; panel.setAttribute('role', 'region');
  root.append(heading, nav, panel);
  function draw() {
    controls.forEach((control, name) => control.setAttribute('aria-pressed', String(name === active)));
    panel.setAttribute('aria-label', active); panel.classList.toggle('request-panel-tools', active === 'Tools'); panel.replaceChildren(); panel.scrollTop = 0;
    if (active === 'Overview') {
      const cards = el('div', 'request-summary');
      for (const [label, value] of [['Model', request.model], ['Input messages', request.messages.length], ['Available tools', request.tools.length], ['Streaming', request.settings.stream === true ? 'Enabled' : request.settings.stream === false ? 'Disabled' : 'Not provided']]) {
        const card = el('div'); card.append(el('span', '', label), el('strong', '', value)); cards.append(card);
      }
      panel.append(cards, el('h4', '', 'About this input'), el('p', 'request-note', 'This payload describes the input to a model call. Tool definitions describe available capabilities; they do not prove a tool was executed. No response, measured duration, or token usage is inferred from request settings.'));
      const outline = el('div', 'request-outline');
      request.messages.forEach(message => outline.append(el('div', '', `${String(message.index + 1).padStart(2, '0')} · ${message.role}`)));
      panel.append(el('h4', '', 'Message order'), outline);
    } else if (active === 'Messages') {
      panel.append(el('p', 'request-note', 'Input messages in source order. Expand a message to read its content and metadata.'));
      if (!request.messages.length) panel.append(empty('No input messages.'));
      request.messages.forEach(message => {
        const details = el('details', 'request-message');
        // Long instructions remain available without overwhelming the exchange.
        details.open = !['system', 'developer'].includes(message.role) || request.messages.length === 1;
        const summary = el('summary');
        summary.append(el('span', 'request-order', String(message.index + 1).padStart(2, '0')), el('strong', 'request-role', message.role));
        const length = typeof message.content === 'string' ? `${message.content.length.toLocaleString()} characters` : Array.isArray(message.content) ? `${message.content.length} content blocks` : 'Structured message';
        summary.append(el('span', 'request-message-size', length));
        const body = el('div', 'request-message-body');
        let loaded = false;
        const load = () => {
          if (loaded || !details.open) return;
          loaded = true; body.append(content(message.content));
          if (message.raw && typeof message.raw === 'object') {
            const metadata = Object.fromEntries(Object.entries(message.raw).filter(([key]) => !['role', 'content'].includes(key)));
            if (Object.keys(metadata).length) { body.append(el('h4', '', 'Additional fields'), json(metadata)); }
          }
        };
        details.append(summary, body); details.addEventListener('toggle', load); load(); panel.append(details);
      });
    } else if (active === 'Tools') drawTools();
    else if (active === 'Settings') {
      panel.append(el('p', 'request-note', 'Values supplied in the request. Token limits are configuration, not measured usage.'));
      const list = el('dl', 'request-settings');
      Object.entries(request.settings).forEach(([key, value]) => {
        const row = el('div'); const description = el('dd');
        description.append(typeof value === 'object' && value !== null ? json(value) : el('code', '', String(value)));
        row.append(el('dt', '', key), description); list.append(row);
      });
      panel.append(Object.keys(request.settings).length ? list : empty('No additional settings provided.'));
    } else panel.append(el('p', 'request-note', 'Complete request, formatted for inspection. Export preserves the source JSON.'), json(request.raw));
  }
  function drawTools() {
    const toolbar = el('div', 'request-tool-toolbar');
    const input = el('input'); input.type = 'search'; input.placeholder = 'Search tools or parameters…'; input.setAttribute('aria-label', 'Search available tools'); input.value = query;
    const count = el('span', 'request-note'); count.setAttribute('role', 'status');
    toolbar.append(input, count);
    const workspace = el('div', 'request-tool-workspace');
    const list = el('div', 'request-tool-list'); list.setAttribute('aria-label', 'Available tools');
    const detail = el('section', 'request-tool-detail'); detail.setAttribute('aria-label', 'Tool definition');
    workspace.append(list, detail); panel.append(toolbar, workspace);
    function update() {
      const matches = filterRequestTools(request.tools, query);
      if (!matches.some(tool => tool.index === selected)) selected = matches[0]?.index ?? -1;
      count.textContent = `${matches.length} of ${request.tools.length} tools`;
      list.replaceChildren(); detail.replaceChildren();
      matches.forEach(tool => {
        const row = button(tool.name, () => { selected = tool.index; save(); update(); list.querySelector('[aria-pressed=true]')?.focus({ preventScroll: true }); }, 'request-tool-row');
        row.setAttribute('aria-pressed', String(selected === tool.index)); list.append(row);
      });
      const tool = matches.find(item => item.index === selected);
      if (!tool) { detail.append(empty(request.tools.length ? 'No matching tools. Try another name or parameter.' : 'No tools defined in this request.')); return; }
      detail.append(el('span', 'request-eyebrow', `${tool.type} · DEFINITION`), el('h4', '', tool.name), el('p', 'request-tool-description', tool.description));
      detail.append(el('h5', '', 'Parameters'));
      const parameters = tool.parameters;
      if (parameters?.properties && typeof parameters.properties === 'object') {
        const table = el('div', 'request-parameters');
        Object.entries(parameters.properties).forEach(([name, schema]) => {
          const row = el('div'); const label = el('div'); label.append(el('code', '', name), el('span', '', Array.isArray(parameters.required) && parameters.required.includes(name) ? 'Required' : 'Optional'));
          row.append(label, json(schema)); table.append(row);
        }); detail.append(table);
      } else detail.append(empty('No named parameters provided.'));
      const raw = el('details', 'request-schema'); raw.append(el('summary', '', 'Full tool schema'), json(tool.raw)); detail.append(raw);
      detail.scrollTop = 0;
    }
    input.addEventListener('input', () => { query = input.value; update(); save(); });
    update();
  }
  draw();
  return root;
}
