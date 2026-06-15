# Libri — Book Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal, static book-tracker webapp (GitHub Pages) that adds books by ISBN/title with auto-filled metadata, stores them in `libri.json` in the repo via the GitHub API, and lets the user mark books as read.

**Architecture:** Vanilla HTML/CSS/JS, no build step. Pure-logic modules (lookup parsing, store CRUD) are ES modules unit-tested with Node's built-in test runner using a mocked `fetch`. GitHub API and DOM/UI code are thin wrappers verified manually. Liquid-Glass dark theme via CSS `backdrop-filter`.

**Tech Stack:** HTML5, CSS3 (`backdrop-filter`), JavaScript ES modules, Google Books API + Open Library (lookup), GitHub REST API (persistence), Node `node:test` (unit tests), GitHub Pages (hosting).

---

## File Structure

- `index.html` — single page; loads `src/main.js` as a module, defines layout containers.
- `styles.css` — Liquid-Glass dark theme.
- `libri.json` — data file (starts as `[]`).
- `src/lookup.js` — metadata search (Google Books + Open Library fallback); pure, fetch-injectable.
- `src/github.js` — read/write `libri.json` via GitHub API; token + SHA handling.
- `src/store.js` — in-memory collection + CRUD + state/read transitions; pure logic, persistence injected.
- `src/ui.js` — render sidebar, grid, detail, add bar, settings; wires events to store.
- `src/main.js` — bootstrap: load config, init store, first render.
- `test/lookup.test.js`, `test/store.test.js` — unit tests.
- `package.json` — defines the `test` script (no dependencies, no build).

A note on testability: `lookup.js` and `store.js` take their I/O (`fetch`, a persistence function) as parameters so tests inject fakes. `github.js` is the only place that reads `localStorage` / hits GitHub directly.

---

## Task 1: Project scaffold and test harness

**Files:**
- Create: `package.json`
- Create: `libri.json`
- Create: `test/smoke.test.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "libri",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create empty data file `libri.json`**

```json
[]
```

- [ ] **Step 3: Write a smoke test at `test/smoke.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("test harness runs", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS — 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add package.json libri.json test/smoke.test.js
git commit -m "chore: scaffold static project and node test harness"
```

---

## Task 2: ISBN/title lookup (Google Books)

**Files:**
- Create: `src/lookup.js`
- Test: `test/lookup.test.js`

- [ ] **Step 1: Write the failing test at `test/lookup.test.js`**

```js
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
    assert.match(url, /isbn:9788845900000/);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/lookup.js`.

- [ ] **Step 3: Implement `src/lookup.js`**

```js
const GOOGLE = "https://www.googleapis.com/books/v1/volumes";

function isIsbn(q) {
  const digits = q.replace(/[-\s]/g, "");
  return /^\d{10}(\d{3})?$/.test(digits);
}

export function normalizeGoogleVolume(vol) {
  const v = vol.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const isbn13 = ids.find((i) => i.type === "ISBN_13");
  const isbn10 = ids.find((i) => i.type === "ISBN_10");
  const raw = (v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || "";
  return {
    isbn: (isbn13 || isbn10 || {}).identifier || "",
    titolo: v.title || "",
    autori: v.authors || [],
    editore: v.publisher || "",
    anno: (v.publishedDate || "").slice(0, 4),
    descrizione: v.description || "",
    copertina: raw.replace(/^http:/, "https:")
  };
}

export async function searchBooks(query, { fetch = globalThis.fetch } = {}) {
  const q = isIsbn(query) ? `isbn:${query.replace(/[-\s]/g, "")}` : query;
  const url = `${GOOGLE}?q=${encodeURIComponent(q)}&maxResults=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map(normalizeGoogleVolume).filter((b) => b.titolo);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — lookup tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lookup.js test/lookup.test.js
git commit -m "feat: add Google Books ISBN/title lookup"
```

---

## Task 3: Open Library fallback

**Files:**
- Modify: `src/lookup.js`
- Modify: `test/lookup.test.js`

- [ ] **Step 1: Add a failing test to `test/lookup.test.js`**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — result length 0 (no fallback yet).

- [ ] **Step 3: Extend `src/lookup.js`**

Add the constant near the top (under `const GOOGLE`):

```js
const OPENLIB = "https://openlibrary.org/search.json";
```

Add the normalizer and fallback function at the end of the file:

```js
export function normalizeOpenLibDoc(doc) {
  return {
    isbn: (doc.isbn || [])[0] || "",
    titolo: doc.title || "",
    autori: doc.author_name || [],
    editore: (doc.publisher || [])[0] || "",
    anno: doc.first_publish_year ? String(doc.first_publish_year) : "",
    descrizione: "",
    copertina: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : ""
  };
}

export async function searchOpenLibrary(query, { fetch = globalThis.fetch } = {}) {
  const url = `${OPENLIB}?q=${encodeURIComponent(query)}&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.docs || []).map(normalizeOpenLibDoc).filter((b) => b.titolo);
}
```

Replace the final `return` line of `searchBooks` so it falls back when empty. The function should end like this:

```js
  const data = await res.json();
  const results = (data.items || []).map(normalizeGoogleVolume).filter((b) => b.titolo);
  if (results.length) return results;
  return searchOpenLibrary(query, { fetch });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all lookup tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lookup.js test/lookup.test.js
git commit -m "feat: add Open Library fallback to lookup"
```

---

## Task 4: Store — in-memory CRUD and transitions

**Files:**
- Create: `src/store.js`
- Test: `test/store.test.js`

- [ ] **Step 1: Write the failing test at `test/store.test.js`**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/store.js`.

- [ ] **Step 3: Implement `src/store.js`**

```js
export function createStore({ initial = [], persist, now, id } = {}) {
  let books = structuredClone(initial);

  async function save() {
    if (persist) await persist(books);
  }

  function find(bookId) {
    return books.find((b) => b.id === bookId);
  }

  return {
    all() {
      return books;
    },
    filter(which) {
      switch (which) {
        case "libreria": return books.filter((b) => b.stato === "posseduto");
        case "desideri": return books.filter((b) => b.stato === "desiderato");
        case "letti": return books.filter((b) => b.letto);
        case "tutti":
        default: return books;
      }
    },
    async add(book) {
      const entry = {
        id: id(),
        isbn: book.isbn || "",
        titolo: book.titolo || "",
        autori: book.autori || [],
        copertina: book.copertina || "",
        editore: book.editore || "",
        anno: book.anno || "",
        descrizione: book.descrizione || "",
        stato: book.stato || "posseduto",
        letto: false,
        aggiunto: now()
      };
      books.push(entry);
      await save();
      return entry;
    },
    async setRead(bookId, value) {
      const b = find(bookId);
      if (b) { b.letto = value; await save(); }
    },
    async setStato(bookId, stato) {
      const b = find(bookId);
      if (b) { b.stato = stato; await save(); }
    },
    async remove(bookId) {
      books = books.filter((b) => b.id !== bookId);
      await save();
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all store tests green.

- [ ] **Step 5: Commit**

```bash
git add src/store.js test/store.test.js
git commit -m "feat: add in-memory store with CRUD and filters"
```

---

## Task 5: GitHub persistence adapter

**Files:**
- Create: `src/github.js`

> This module reads `localStorage` and hits the GitHub API; it is verified manually in Task 8 (no unit test). Keep it thin.

- [ ] **Step 1: Implement `src/github.js`**

```js
// Config is hardcoded by the user after forking. Edit these two lines:
export const REPO_OWNER = "TUO_USERNAME";
export const REPO_NAME = "libri";
const FILE_PATH = "libri.json";
const BRANCH = "main";

const TOKEN_KEY = "libri_github_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t.trim());
}
export function hasToken() {
  return !!getToken();
}

function apiUrl() {
  return `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
}

function decode(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}
function encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

let currentSha = null;

// Public read: works without a token via the contents API.
export async function load() {
  const res = await fetch(`${apiUrl()}?ref=${BRANCH}`, {
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  const data = await res.json();
  currentSha = data.sha;
  return JSON.parse(decode(data.content));
}

// Write: requires a token with contents:write.
export async function save(books) {
  const token = getToken();
  if (!token) throw new Error("Nessun token: modalità sola lettura.");
  const body = {
    message: "update libri.json",
    content: encode(JSON.stringify(books, null, 2)),
    branch: BRANCH,
    sha: currentSha || undefined
  };
  let res = await fetch(apiUrl(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    },
    body: JSON.stringify(body)
  });
  // On SHA conflict, reload and retry once.
  if (res.status === 409) {
    await load();
    body.sha = currentSha;
    res = await fetch(apiUrl(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      },
      body: JSON.stringify(body)
    });
  }
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  const data = await res.json();
  currentSha = data.content.sha;
}
```

- [ ] **Step 2: Sanity check it parses**

Run: `node --check src/github.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add src/github.js
git commit -m "feat: add GitHub contents API persistence adapter"
```

---

## Task 6: Liquid-Glass styles and page shell

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Libri</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="app">
    <aside class="sidebar glass" id="sidebar"></aside>
    <main class="main">
      <header class="topbar glass">
        <input id="add-input" class="add-input" placeholder="Aggiungi per ISBN o titolo…" />
        <button id="add-btn" class="btn">Cerca</button>
        <input id="filter-input" class="filter-input" placeholder="Filtra la collezione…" />
        <button id="settings-btn" class="btn ghost">⚙︎</button>
      </header>
      <section id="results" class="results"></section>
      <section id="grid" class="grid"></section>
    </main>
  </div>
  <div id="detail" class="overlay hidden"></div>
  <div id="settings" class="overlay hidden"></div>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `styles.css` (Liquid-Glass dark theme)**

```css
:root {
  --bg: #0b0c0f;
  --glass-bg: rgba(30, 32, 38, 0.55);
  --glass-brd: rgba(255, 255, 255, 0.14);
  --txt: #f2f3f5;
  --muted: #a3a7b0;
  --accent: #e0533d;
  --radius: 18px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, "SF Pro Text", system-ui, sans-serif;
  color: var(--txt);
  background:
    radial-gradient(1200px 600px at 10% -10%, #2a2140 0%, transparent 60%),
    radial-gradient(900px 500px at 110% 10%, #14303a 0%, transparent 55%),
    var(--bg);
  min-height: 100vh;
}
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  border: 1px solid var(--glass-brd);
  box-shadow: 0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10);
}
.app { display: grid; grid-template-columns: 230px 1fr; gap: 16px; padding: 16px; }
.sidebar { border-radius: var(--radius); padding: 14px; height: calc(100vh - 32px); }
.nav-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 12px; border-radius: 12px; cursor: pointer; color: var(--muted);
}
.nav-item.active, .nav-item:hover { background: rgba(255,255,255,0.10); color: var(--txt); }
.count { font-size: 12px; opacity: 0.7; }
.main { display: flex; flex-direction: column; gap: 16px; }
.topbar { border-radius: var(--radius); padding: 12px; display: flex; gap: 10px; align-items: center; }
.add-input, .filter-input {
  flex: 1; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--glass-brd);
  background: rgba(0,0,0,0.25); color: var(--txt); outline: none;
}
.btn {
  padding: 10px 16px; border-radius: 12px; border: 1px solid var(--glass-brd);
  background: var(--accent); color: white; cursor: pointer;
}
.btn.ghost { background: rgba(255,255,255,0.08); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
.card { border-radius: var(--radius); padding: 10px; cursor: pointer; }
.card img { width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 10px; background: #222; }
.card .t { font-weight: 600; font-size: 14px; margin-top: 8px; }
.card .a { color: var(--muted); font-size: 12px; }
.card .read-badge { color: var(--accent); font-size: 12px; }
.results .card { border: 1px dashed var(--accent); }
.overlay {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); z-index: 10;
}
.overlay.hidden { display: none; }
.panel { border-radius: var(--radius); padding: 22px; width: min(520px, 92vw); }
.hidden { display: none; }
```

- [ ] **Step 3: Visually check the shell**

Run: `python3 -m http.server 8000` then open `http://localhost:8000/`.
Expected: dark glassy sidebar + topbar render (empty content is fine; console may warn about `main.js` until Task 7). Stop the server with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "feat: add Liquid-Glass page shell and styles"
```

---

## Task 7: UI rendering and wiring

**Files:**
- Create: `src/ui.js`
- Create: `src/main.js`

- [ ] **Step 1: Implement `src/ui.js`**

```js
const FILTERS = [
  { key: "tutti", label: "Tutti" },
  { key: "libreria", label: "Libreria" },
  { key: "desideri", label: "Lista desideri" },
  { key: "letti", label: "Letti" }
];

let activeFilter = "tutti";
let textFilter = "";

export function initUI({ store, lookup, github, onChange }) {
  const $ = (id) => document.getElementById(id);

  function matchesText(b) {
    if (!textFilter) return true;
    const hay = `${b.titolo} ${(b.autori || []).join(" ")}`.toLowerCase();
    return hay.includes(textFilter.toLowerCase());
  }

  function renderSidebar() {
    $("sidebar").innerHTML = FILTERS.map((f) => {
      const n = store.filter(f.key).length;
      return `<div class="nav-item ${f.key === activeFilter ? "active" : ""}" data-f="${f.key}">
        <span>${f.label}</span><span class="count">${n}</span></div>`;
    }).join("");
    $("sidebar").querySelectorAll(".nav-item").forEach((el) => {
      el.onclick = () => { activeFilter = el.dataset.f; renderAll(); };
    });
  }

  function cardHtml(b, dashed) {
    const cover = b.copertina || "";
    const badge = b.letto ? `<span class="read-badge">● letto</span>` : "";
    return `<div class="card" data-id="${b.id || ""}">
      <img src="${cover}" alt="" onerror="this.style.visibility='hidden'"/>
      <div class="t">${b.titolo || ""}</div>
      <div class="a">${(b.autori || []).join(", ")}</div>
      ${dashed ? "" : badge}
    </div>`;
  }

  function renderGrid() {
    const books = store.filter(activeFilter).filter(matchesText);
    $("grid").innerHTML = books.map((b) => cardHtml(b, false)).join("");
    $("grid").querySelectorAll(".card").forEach((el) => {
      el.onclick = () => openDetail(el.dataset.id);
    });
  }

  function renderAll() {
    renderSidebar();
    renderGrid();
  }

  function openDetail(id) {
    const b = store.all().find((x) => x.id === id);
    if (!b) return;
    const el = $("detail");
    el.innerHTML = `<div class="panel glass">
      <h2>${b.titolo}</h2>
      <p class="a">${(b.autori || []).join(", ")} — ${b.editore} ${b.anno}</p>
      <p>${b.descrizione || ""}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
        <button class="btn" id="d-read">${b.letto ? "Segna non letto" : "Segna come letto"}</button>
        <button class="btn ghost" id="d-stato">${b.stato === "posseduto" ? "Sposta in desideri" : "Sposta in libreria"}</button>
        <button class="btn ghost" id="d-del">Elimina</button>
        <button class="btn ghost" id="d-close">Chiudi</button>
      </div></div>`;
    el.classList.remove("hidden");
    $("d-close").onclick = () => el.classList.add("hidden");
    $("d-read").onclick = async () => { await store.setRead(id, !b.letto); el.classList.add("hidden"); renderAll(); };
    $("d-stato").onclick = async () => {
      await store.setStato(id, b.stato === "posseduto" ? "desiderato" : "posseduto");
      el.classList.add("hidden"); renderAll();
    };
    $("d-del").onclick = async () => { await store.remove(id); el.classList.add("hidden"); renderAll(); };
  }

  function renderResults(results) {
    const box = $("results");
    if (!results.length) { box.innerHTML = ""; return; }
    box.innerHTML = `<p class="a">Risultati — clicca per aggiungere:</p>` +
      `<div class="grid">${results.map((b) => cardHtml(b, true)).join("")}</div>`;
    box.querySelectorAll(".card").forEach((el, i) => {
      el.onclick = async () => {
        await store.add({ ...results[i], stato: activeFilter === "desideri" ? "desiderato" : "posseduto" });
        box.innerHTML = "";
        $("add-input").value = "";
        renderAll();
      };
    });
  }

  async function doSearch() {
    const q = $("add-input").value.trim();
    if (!q) return;
    $("results").innerHTML = `<p class="a">Cerco…</p>`;
    try {
      const results = await lookup.searchBooks(q);
      if (!results.length) $("results").innerHTML = `<p class="a">Nessun risultato.</p>`;
      else renderResults(results);
    } catch (e) {
      $("results").innerHTML = `<p class="a">Errore ricerca: ${e.message}</p>`;
    }
  }

  function openSettings() {
    const el = $("settings");
    el.innerHTML = `<div class="panel glass">
      <h2>Token GitHub</h2>
      <p class="a">Serve un Personal Access Token con permesso <b>contents:write</b> sul repo. Resta solo in questo browser.</p>
      <input id="s-token" class="add-input" type="password" placeholder="ghp_…" value="${github.getToken()}" />
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn" id="s-save">Salva</button>
        <button class="btn ghost" id="s-close">Chiudi</button>
      </div></div>`;
    el.classList.remove("hidden");
    $("s-save").onclick = () => { github.setToken($("s-token").value); el.classList.add("hidden"); };
    $("s-close").onclick = () => el.classList.add("hidden");
  }

  $("add-btn").onclick = doSearch;
  $("add-input").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
  $("filter-input").addEventListener("input", (e) => { textFilter = e.target.value; renderGrid(); });
  $("settings-btn").onclick = openSettings;

  if (onChange) onChange(renderAll);
  renderAll();
}
```

- [ ] **Step 2: Implement `src/main.js`**

```js
import { createStore } from "./store.js";
import { searchBooks } from "./lookup.js";
import * as github from "./github.js";
import { initUI } from "./ui.js";

function uuid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    String(Date.now()) + Math.random().toString(16).slice(2);
}

async function boot() {
  let initial = [];
  try {
    initial = await github.load();
  } catch (e) {
    console.warn("Impossibile caricare libri.json:", e.message);
  }

  const store = createStore({
    initial,
    persist: async (books) => {
      try {
        await github.save(books);
      } catch (e) {
        alert("Salvataggio non riuscito: " + e.message);
      }
    },
    now: () => new Date().toISOString(),
    id: uuid
  });

  initUI({ store, lookup: { searchBooks }, github });
}

boot();
```

- [ ] **Step 3: Confirm modules parse**

Run: `node --check src/ui.js && node --check src/main.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/ui.js src/main.js
git commit -m "feat: add UI rendering, search, detail and settings wiring"
```

---

## Task 8: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `npm test`
Expected: PASS — smoke, lookup, and store tests all green.

- [ ] **Step 2: Serve locally and exercise read-only flow**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/`.
Type a known ISBN (e.g. `9788845292613`) → click Cerca → a result card with cover appears.
Expected: search works against the live Google Books API. (Adding will fail to persist until a token + repo are set — that's expected locally.)

- [ ] **Step 3: Verify the filters and detail overlay**

Manually add a book to `libri.json` by hand, reload, click it, confirm the detail overlay opens and the sidebar counts update when switching filters.
Expected: UI reflects the data.

- [ ] **Step 4: Commit any fixes found**

```bash
git add -A
git commit -m "fix: address issues found in manual verification"
```

---

## Task 9: Deployment notes (README)

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Libri

Book tracker personale. Sito statico su GitHub Pages; i dati stanno in `libri.json`.

## Setup
1. Fai il fork / crea il repo su GitHub (branch `main`).
2. In `src/github.js` imposta `REPO_OWNER` e `REPO_NAME`.
3. Settings → Pages → Source: branch `main`, cartella `/root`.
4. Apri il sito, clicca ⚙︎ e incolla un Personal Access Token (fine-grained,
   permesso **Contents: Read and write** solo su questo repo). Resta nel browser.

## Uso
- Scrivi ISBN o titolo, Cerca, clicca un risultato per aggiungerlo.
- Filtri: Tutti / Libreria / Lista desideri / Letti.
- Clicca un libro per segnarlo letto, spostarlo o eliminarlo.

## Sviluppo
- Test: `npm test`
- Anteprima locale: `python3 -m http.server 8000`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup and usage README"
```

---

## Self-review notes (covered)
- Spec coverage: lookup (T2/T3), GitHub JSON persistence + token + SHA-conflict retry (T5), store CRUD + read toggle + stato (T4), filters Tutti/Libreria/Desideri/Letti (T4/T7), Liquid-Glass dark UI (T6/T7), error handling for missing token / no results / offline load (T5/T7/main.js). Statistiche/Citazioni intentionally excluded.
- Naming consistency: `searchBooks`, `searchOpenLibrary`, `createStore`, `setRead`, `setStato`, `remove`, `filter`, `github.load`/`github.save` used identically across tasks.
- No placeholders except `REPO_OWNER`/`REPO_NAME`, which are intended user config documented in T5/T9.
