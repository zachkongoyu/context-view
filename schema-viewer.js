import { validateSchema } from "./schema-validator.js";

function firstDefined(...values) { return values.find((value) => value !== undefined && value !== null); }

export function normalizeSchemas(root) {
  const values = Array.isArray(root) ? root : Array.isArray(root?.tools) ? root.tools : Array.isArray(root?.functions) ? root.functions : [root];
  return values.map((entry, index) => {
    const source = entry?.function || entry?.function_declarations?.[0] || entry || {};
    const schema = firstDefined(source.parameters, source.input_schema, source.schema, source.json_schema?.schema, source.json_schema, source);
    return {
      id: String(firstDefined(source.name, entry?.name, `schema-${index}`)),
      name: String(firstDefined(source.name, entry?.name, `Schema ${index + 1}`)),
      description: String(firstDefined(source.description, entry?.description, "")),
      schema,
      raw: entry,
    };
  }).filter((entry) => entry.schema && typeof entry.schema === "object");
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function typeLabel(schema) {
  if (Array.isArray(schema?.type)) return schema.type.join(" | ");
  if (schema?.type) return schema.type;
  if (schema?.enum) return "enum";
  if (schema?.$ref) return schema.$ref;
  return "any";
}

function schemaNode(name, schema, required = false) {
  const details = element("details", "schema-card");
  details.open = true;
  const summary = element("summary");
  summary.append(element("span", "", name), element("span", "badge", typeLabel(schema)));
  if (required) summary.append(element("span", "badge required", "required"));
  details.append(summary);
  const body = element("div", "schema-card-body");
  if (schema.description) body.append(element("div", "text-part", schema.description));
  const facts = [];
  if (schema.default !== undefined) facts.push(["default", JSON.stringify(schema.default)]);
  if (schema.enum) facts.push(["enum", schema.enum.map((item) => JSON.stringify(item)).join(", ")]);
  if (schema.pattern) facts.push(["pattern", schema.pattern]);
  if (schema.format) facts.push(["format", schema.format]);
  if (schema.minimum !== undefined) facts.push(["minimum", schema.minimum]);
  if (schema.maximum !== undefined) facts.push(["maximum", schema.maximum]);
  if (facts.length) {
    const grid = element("div", "property-grid");
    facts.forEach(([key, value]) => grid.append(element("div", "property-name", key), element("div", "property-value", value)));
    body.append(grid);
  }
  const requiredSet = new Set(schema.required || []);
  for (const [propertyName, propertySchema] of Object.entries(schema.properties || {})) body.append(schemaNode(propertyName, propertySchema, requiredSet.has(propertyName)));
  if (schema.items && typeof schema.items === "object") body.append(schemaNode("items", schema.items));
  details.append(body);
  return details;
}

export function renderSchemas(entries, onValidate) {
  const root = element("div", "section-stack");
  const summary = element("div", "summary-grid");
  const propertyCount = entries.reduce((sum, entry) => sum + Object.keys(entry.schema.properties || {}).length, 0);
  [["Definitions", entries.length], ["Top properties", propertyCount], ["Validator", "Local"], ["Draft", "Pragmatic"]].forEach(([label, value]) => { const metric = element("div", "metric"); metric.append(element("span", "metric-label", label), element("span", "metric-value", value)); summary.append(metric); });
  root.append(summary);
  entries.forEach((entry) => {
    const wrapper = element("section", "stack");
    const header = element("div", "timeline-head");
    header.append(element("strong", "", entry.name));
    if (entry.description) header.append(element("span", "text-part", entry.description));
    const button = element("button", "secondary-button", "Validate sample");
    button.type = "button";
    button.addEventListener("click", () => onValidate(entry));
    header.append(button);
    wrapper.append(header, schemaNode(entry.name, entry.schema));
    root.append(wrapper);
  });
  return root;
}

export function validateSample(sample, schema) {
  return validateSchema(sample, schema);
}
