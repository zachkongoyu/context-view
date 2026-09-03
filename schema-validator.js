const FORMAT_CHECKS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  hostname: /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(?:\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/,
  ipv4: /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  date: /^\d{4}-\d{2}-\d{2}$/,
  "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i,
  uri: /^[A-Za-z][A-Za-z0-9+.-]*:\/\//,
};

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(value, type) {
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "null") return value === null;
  return typeof value === type;
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || !a || !b || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}

function resolvePointer(root, ref) {
  if (ref === "#") return root;
  if (!ref.startsWith("#/")) return undefined;
  return ref.slice(2).split("/").reduce((value, token) => value?.[token.replace(/~1/g, "/").replace(/~0/g, "~")], root);
}

function issue(keyword, path, message, expected, actual) {
  return { keyword, path, message, expected, actual };
}

function childPath(path, key) {
  return /^\d+$/.test(String(key)) ? `${path}[${key}]` : `${path}.${key}`;
}

function validateNode(value, schema, root, path, errors, activeRefs) {
  if (schema === true || schema === undefined) return;
  if (schema === false) {
    errors.push(issue("falseSchema", path, "Value is rejected by a false schema.", false, value));
    return;
  }
  if (!schema || typeof schema !== "object") return;

  if (schema.$ref) {
    const resolved = resolvePointer(root, schema.$ref);
    if (resolved === undefined) {
      errors.push(issue("$ref", path, `Unresolved local reference: ${schema.$ref}`, schema.$ref, value));
      return;
    }
    const guard = `${schema.$ref}|${path}`;
    if (!activeRefs.has(guard)) {
      activeRefs.add(guard);
      validateNode(value, resolved, root, path, errors, activeRefs);
      activeRefs.delete(guard);
    }
  }

  const allowedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : schema.nullable ? ["null"] : [];
  if (schema.nullable && !allowedTypes.includes("null")) allowedTypes.push("null");
  if (allowedTypes.length && !allowedTypes.some((type) => matchesType(value, type))) {
    errors.push(issue("type", path, `Expected ${allowedTypes.join(" or ")}, received ${typeOf(value)}.`, allowedTypes, typeOf(value)));
    return;
  }

  if (schema.enum && !schema.enum.some((candidate) => deepEqual(candidate, value))) errors.push(issue("enum", path, "Value is not in the allowed enum.", schema.enum, value));
  if (Object.hasOwn(schema, "const") && !deepEqual(schema.const, value)) errors.push(issue("const", path, "Value does not match const.", schema.const, value));

  if (Array.isArray(schema.allOf)) schema.allOf.forEach((branch) => validateNode(value, branch, root, path, errors, activeRefs));
  if (Array.isArray(schema.anyOf)) {
    const valid = schema.anyOf.some((branch) => validateSchema(value, branch, root).valid);
    if (!valid) errors.push(issue("anyOf", path, "Value must match at least one anyOf branch.", schema.anyOf.length, value));
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((branch) => validateSchema(value, branch, root).valid).length;
    if (matches !== 1) errors.push(issue("oneOf", path, `Value matched ${matches} branches; exactly one is required.`, 1, matches));
  }
  if (schema.not && validateSchema(value, schema.not, root).valid) errors.push(issue("not", path, "Value matches a forbidden schema.", "not", value));
  if (schema.if) {
    const condition = validateSchema(value, schema.if, root).valid;
    if (condition && schema.then) validateNode(value, schema.then, root, path, errors, activeRefs);
    if (!condition && schema.else) validateNode(value, schema.else, root, path, errors, activeRefs);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(issue("minimum", path, `Value must be at least ${schema.minimum}.`, schema.minimum, value));
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(issue("maximum", path, `Value must be at most ${schema.maximum}.`, schema.maximum, value));
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(issue("exclusiveMinimum", path, `Value must be greater than ${schema.exclusiveMinimum}.`, schema.exclusiveMinimum, value));
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) errors.push(issue("exclusiveMaximum", path, `Value must be less than ${schema.exclusiveMaximum}.`, schema.exclusiveMaximum, value));
    if (schema.multipleOf !== undefined) {
      const quotient = value / schema.multipleOf;
      if (Math.abs(quotient - Math.round(quotient)) > 1e-10) errors.push(issue("multipleOf", path, `Value must be a multiple of ${schema.multipleOf}.`, schema.multipleOf, value));
    }
  }

  if (typeof value === "string") {
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) errors.push(issue("minLength", path, `String must contain at least ${schema.minLength} characters.`, schema.minLength, length));
    if (schema.maxLength !== undefined && length > schema.maxLength) errors.push(issue("maxLength", path, `String must contain at most ${schema.maxLength} characters.`, schema.maxLength, length));
    if (schema.pattern !== undefined) {
      try { if (!new RegExp(schema.pattern).test(value)) errors.push(issue("pattern", path, `String does not match /${schema.pattern}/.`, schema.pattern, value)); }
      catch { errors.push(issue("pattern", path, `Schema contains an invalid regular expression: ${schema.pattern}`, schema.pattern, value)); }
    }
    if (schema.format && FORMAT_CHECKS[schema.format] && !FORMAT_CHECKS[schema.format].test(value)) errors.push(issue("format", path, `String is not a valid ${schema.format}.`, schema.format, value));
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(issue("minItems", path, `Array must contain at least ${schema.minItems} items.`, schema.minItems, value.length));
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(issue("maxItems", path, `Array must contain at most ${schema.maxItems} items.`, schema.maxItems, value.length));
    if (schema.uniqueItems) {
      for (let i = 0; i < value.length; i += 1) {
        if (value.slice(0, i).some((item) => deepEqual(item, value[i]))) errors.push(issue("uniqueItems", childPath(path, i), "Array items must be unique.", true, value[i]));
      }
    }
    if (Array.isArray(schema.prefixItems)) schema.prefixItems.forEach((itemSchema, index) => { if (index < value.length) validateNode(value[index], itemSchema, root, childPath(path, index), errors, activeRefs); });
    if (schema.items && !Array.isArray(schema.items)) {
      const start = Array.isArray(schema.prefixItems) ? schema.prefixItems.length : 0;
      value.slice(start).forEach((item, offset) => validateNode(item, schema.items, root, childPath(path, start + offset), errors, activeRefs));
    }
    if (schema.contains) {
      const matches = value.filter((item) => validateSchema(item, schema.contains, root).valid).length;
      const minimum = schema.minContains ?? 1;
      const maximum = schema.maxContains ?? Infinity;
      if (matches < minimum || matches > maximum) errors.push(issue("contains", path, `Array contains ${matches} matching items; expected ${minimum}-${maximum === Infinity ? "any" : maximum}.`, [minimum, maximum], matches));
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) errors.push(issue("minProperties", path, `Object must contain at least ${schema.minProperties} properties.`, schema.minProperties, keys.length));
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) errors.push(issue("maxProperties", path, `Object must contain at most ${schema.maxProperties} properties.`, schema.maxProperties, keys.length));
    for (const required of schema.required || []) {
      if (!Object.hasOwn(value, required)) errors.push(issue("required", childPath(path, required), `Required property is missing: ${required}`, required, undefined));
    }
    for (const [key, propertySchema] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) validateNode(value[key], propertySchema, root, childPath(path, key), errors, activeRefs);
    }
    for (const [key, dependencies] of Object.entries(schema.dependentRequired || {})) {
      if (Object.hasOwn(value, key)) {
        for (const dependency of dependencies) if (!Object.hasOwn(value, dependency)) errors.push(issue("dependentRequired", childPath(path, dependency), `${dependency} is required when ${key} is present.`, dependency, undefined));
      }
    }
    const known = new Set(Object.keys(schema.properties || {}));
    const patterns = Object.entries(schema.patternProperties || {}).map(([pattern, childSchema]) => {
      try { return [new RegExp(pattern), childSchema]; } catch { errors.push(issue("patternProperties", path, `Schema contains an invalid property pattern: ${pattern}`, pattern, value)); return null; }
    }).filter(Boolean);
    for (const key of keys) {
      if (known.has(key)) continue;
      const matching = patterns.filter(([pattern]) => pattern.test(key));
      if (matching.length) matching.forEach(([, childSchema]) => validateNode(value[key], childSchema, root, childPath(path, key), errors, activeRefs));
      else if (schema.additionalProperties === false) errors.push(issue("additionalProperties", childPath(path, key), `Unexpected property: ${key}`, false, value[key]));
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") validateNode(value[key], schema.additionalProperties, root, childPath(path, key), errors, activeRefs);
    }
  }
}

export function validateSchema(value, schema, rootSchema = schema) {
  const errors = [];
  validateNode(value, schema, rootSchema, "$", errors, new Set());
  return { valid: errors.length === 0, errors };
}
