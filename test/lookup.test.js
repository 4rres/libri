import { test } from "node:test";
import assert from "node:assert/strict";
import {
  searchBooks,
  searchGoogle,
  normalizeGoogleVolume,
  normalizeItunesItem
} from "../src/lookup.js";

test("normalizeGoogleVolume maps fields", () => {
  const vol = {
    volumeInfo: {
      title: "La voce umana",
      authors: ["Jean Cocteau"],
      publisher: "Adelphi",
      publishedDate: "2018-05-01",
      description: "Un monologo.",
      industryIdentifiers: [{ type: "ISBN_13", identifier: "9788845900000" }],
      imageLinks: { thumbnail: "http://books/thumb?zoom=1" }
    }
  };
  const b = normalizeGoogleVolume(vol);
  assert.equal(b.titolo, "La voce umana");
  assert.deepEqual(b.autori, ["Jean Cocteau"]);
  assert.equal(b.editore, "Adelphi");
  assert.equal(b.anno, "2018");
  assert.equal(b.isbn, "9788845900000");
  assert.equal(b.copertina, "https://books/thumb?zoom=1"); // forced https
});

test("normalizeItunesItem maps fields and strips html", () => {
  const b = normalizeItunesItem({
    trackName: "K-Hole",
    artistName: "Carlo Mazza Galanti",
    releaseDate: "2024-03-01T00:00:00Z",
    description: "<p>Un saggio.</p>",
    artworkUrl100: "https://is/img/100x100bb.jpg"
  });
  assert.equal(b.titolo, "K-Hole");
  assert.deepEqual(b.autori, ["Carlo Mazza Galanti"]);
  assert.equal(b.anno, "2024");
  assert.equal(b.descrizione, "Un saggio.");
  assert.equal(b.copertina, "https://is/img/400x400bb.jpg");
  assert.equal(b.fonte, "Apple");
});

test("searchGoogle queries by isbn and returns normalized results", async () => {
  const fakeFetch = async (url) => {
    assert.match(url, /isbn(:|%3A)9788845900000/);
    return {
      ok: true,
      json: async () => ({
        items: [{ volumeInfo: { title: "T", authors: ["A"], imageLinks: {} } }]
      })
    };
  };
  const res = await searchGoogle("9788845900000", { fetch: fakeFetch });
  assert.equal(res.length, 1);
  assert.equal(res[0].titolo, "T");
});

test("searchBooks merges sources and dedupes by isbn", async () => {
  const fakeFetch = async (url) => {
    if (url.includes("googleapis")) {
      return {
        ok: true,
        json: async () => ({
          items: [{
            volumeInfo: {
              title: "Stesso libro",
              authors: ["A"],
              industryIdentifiers: [{ type: "ISBN_13", identifier: "111" }],
              imageLinks: {}
            }
          }]
        })
      };
    }
    if (url.includes("openlibrary")) {
      return {
        ok: true,
        json: async () => ({
          docs: [
            { title: "Stesso libro", author_name: ["A"], isbn: ["111"] },
            { title: "Altro libro", author_name: ["B"], isbn: ["222"] }
          ]
        })
      };
    }
    // itunes
    return { ok: true, json: async () => ({ results: [] }) };
  };
  const res = await searchBooks("qualcosa", { fetch: fakeFetch });
  const isbns = res.map((b) => b.isbn).sort();
  assert.deepEqual(isbns, ["111", "222"]); // duplicato 111 unito
});

test("searchBooks survives a failing source", async () => {
  const fakeFetch = async (url) => {
    if (url.includes("googleapis")) throw new Error("network down");
    if (url.includes("openlibrary")) {
      return { ok: true, json: async () => ({ docs: [{ title: "OK", author_name: ["B"], isbn: ["9"] }] }) };
    }
    return { ok: true, json: async () => ({ results: [] }) };
  };
  const res = await searchBooks("qualcosa", { fetch: fakeFetch });
  assert.equal(res.length, 1);
  assert.equal(res[0].titolo, "OK");
});
