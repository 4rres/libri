import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store.js";

function newStore(initial = []) {
  const saved = [];
  const persist = async (books) => { saved.push(structuredClone(books)); };
  const store = createStore({ initial, persist, now: () => "2026-06-16T00:00:00.000Z", id: () => "id1" });
  return { store, saved };
}

test("add inserts a book with defaults and persists", async () => {
  const { store, saved } = newStore();
  await store.add({ titolo: "T", autori: ["A"], stato: "posseduto" });
  const books = store.all();
  assert.equal(books.length, 1);
  assert.equal(books[0].id, "id1");
  assert.equal(books[0].letto, false);
  assert.equal(books[0].aggiunto, "2026-06-16T00:00:00.000Z");
  assert.equal(saved.length, 1);
});

test("markRead toggles letto and persists", async () => {
  const { store, saved } = newStore([
    { id: "x", titolo: "T", stato: "posseduto", letto: false }
  ]);
  await store.setRead("x", true);
  assert.equal(store.all()[0].letto, true);
  assert.equal(saved.length, 1);
});

test("setStato moves between posseduto and desiderato", async () => {
  const { store } = newStore([{ id: "x", titolo: "T", stato: "desiderato", letto: false }]);
  await store.setStato("x", "posseduto");
  assert.equal(store.all()[0].stato, "posseduto");
});

test("remove deletes by id", async () => {
  const { store } = newStore([{ id: "x", titolo: "T", stato: "posseduto", letto: false }]);
  await store.remove("x");
  assert.equal(store.all().length, 0);
});

test("filter returns subsets", () => {
  const { store } = newStore([
    { id: "1", titolo: "A", stato: "posseduto", letto: true },
    { id: "2", titolo: "B", stato: "desiderato", letto: false }
  ]);
  assert.equal(store.filter("tutti").length, 2);
  assert.equal(store.filter("libreria").length, 1);
  assert.equal(store.filter("desideri").length, 1);
  assert.equal(store.filter("letti").length, 1);
});
