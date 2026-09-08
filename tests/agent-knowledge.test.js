import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, COMPARISONS, LOOP_STAGES, SOURCES, TERMS, getTerm, searchTerms } from "../lib/agent-knowledge.js";

test("every public concept has a unique route, complete article, and valid references", () => {
  const slugs = new Set();
  const categories = new Set(CATEGORIES.map((category) => category.id));
  for (const term of TERMS) {
    assert.match(term.slug, /^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(!slugs.has(term.slug), `Duplicate route: ${term.slug}`);
    slugs.add(term.slug);
    assert.ok(categories.has(term.category), `Unknown category: ${term.slug}`);
    for (const field of ["name", "summary", "definition", "example", "boundary"]) assert.ok(term[field]?.trim(), `${term.slug} needs ${field}`);
    assert.ok(term.sources.length, `${term.slug} needs sources`);
    for (const id of term.sources) assert.equal(new URL(SOURCES[id]?.url).protocol, "https:");
    for (const id of term.related) {
      assert.ok(getTerm(id), `Broken related link: ${term.slug} -> ${id}`);
      assert.notEqual(id, term.slug);
    }
  }
  assert.equal(getTerm("does-not-exist"), undefined);
});

test("the learning diagram and comparisons link to published definitions", () => {
  for (const stage of LOOP_STAGES) assert.ok(getTerm(stage.term));
  for (const comparison of COMPARISONS) {
    assert.ok(getTerm(comparison.left));
    assert.ok(getTerm(comparison.right));
  }
  for (const slug of ["message", "turn", "conversation", "session", "thread", "module", "component", "agent-loop"]) assert.ok(getTerm(slug));
});

test("concept search finds aliases and applies category filters", () => {
  assert.ok(searchTerms(" LLM ").some((term) => term.slug === "model"));
  assert.ok(searchTerms("human in the loop").some((term) => term.slug === "guardrail"));
  assert.ok(searchTerms("session").some((term) => term.slug === "session"));
  assert.ok(searchTerms("model", "components").some((term) => term.slug === "model"));
  assert.ok(searchTerms("model", "components").every((term) => term.category === "components"));
  assert.equal(searchTerms("no-such-concept-xyz").length, 0);
  assert.equal(searchTerms("", "all").length, TERMS.length);
});
