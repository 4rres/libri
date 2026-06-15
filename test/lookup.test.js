import { test } from "node:test";
import assert from "node:assert/strict";
import { searchBooks, normalizeGoogleVolume } from "../src/lookup.js";

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

test("searchBooks queries Google by isbn and returns normalized results", async () => {
  const fakeFetch = async (url) => {
    assert.match(url, /isbn(:|%3A)9788845900000/);
    return {
      ok: true,
      json: async () => ({
        items: [{ volumeInfo: { title: "T", authors: ["A"], imageLinks: {} } }]
      })
    };
  };
  const res = await searchBooks("9788845900000", { fetch: fakeFetch });
  assert.equal(res.length, 1);
  assert.equal(res[0].titolo, "T");
});

test("searchBooks falls back to Open Library when Google empty", async () => {
  const fakeFetch = async (url) => {
    if (url.includes("googleapis")) {
      return { ok: true, json: async () => ({ items: [] }) };
    }
    assert.match(url, /openlibrary\.org/);
    return {
      ok: true,
      json: async () => ({
        docs: [
          {
            title: "K-Hole",
            author_name: ["Carlo Mazza Galanti"],
            first_publish_year: 2021,
            isbn: ["9788899999999"],
            cover_i: 123
          }
        ]
      })
    };
  };
  const res = await searchBooks("K-Hole", { fetch: fakeFetch });
  assert.equal(res.length, 1);
  assert.equal(res[0].titolo, "K-Hole");
  assert.equal(res[0].copertina, "https://covers.openlibrary.org/b/id/123-M.jpg");
});
