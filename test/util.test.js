import { test } from "node:test";
import assert from "node:assert/strict";
import { esc } from "../src/util.js";

test("esc neutralizes html-breaking characters", () => {
  assert.equal(esc('K-Hole "ket" <b> & co'), "K-Hole &quot;ket&quot; &lt;b&gt; &amp; co");
});

test("esc handles null/undefined", () => {
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
});

test("esc protects attribute context (quotes)", () => {
  assert.equal(esc('a"b'), "a&quot;b");
});
