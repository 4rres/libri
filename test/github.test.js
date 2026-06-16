import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeBooks } from "../src/github.js";

test("mergeBooks keeps remote-only entries (added elsewhere)", () => {
  const remote = [{ id: "a", titolo: "A" }, { id: "b", titolo: "B" }];
  const local = [{ id: "a", titolo: "A" }];
  const merged = mergeBooks(remote, local);
  const ids = merged.map((x) => x.id).sort();
  assert.deepEqual(ids, ["a", "b"]); // 'b' non viene perso
});

test("mergeBooks prefers local for edited entries", () => {
  const remote = [{ id: "a", titolo: "Vecchio", letto: false }];
  const local = [{ id: "a", titolo: "Vecchio", letto: true }];
  const merged = mergeBooks(remote, local);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].letto, true); // la modifica locale vince
});

test("mergeBooks includes local-only new entries", () => {
  const remote = [{ id: "a", titolo: "A" }];
  const local = [{ id: "a", titolo: "A" }, { id: "c", titolo: "Nuovo" }];
  const merged = mergeBooks(remote, local);
  assert.equal(merged.length, 2);
  assert.ok(merged.find((x) => x.id === "c"));
});

test("mergeBooks tolerates null inputs", () => {
  assert.deepEqual(mergeBooks(null, null), []);
});
