const GOOGLE = "https://www.googleapis.com/books/v1/volumes";
const OPENLIB = "https://openlibrary.org/search.json";
const ITUNES = "https://itunes.apple.com/search";

function cleanIsbn(q) {
  return q.replace(/[-\s]/g, "");
}
function isIsbn(q) {
  return /^\d{10}(\d{3})?$/.test(cleanIsbn(q));
}

// --- Google Books ---
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
    copertina: raw.replace(/^http:/, "https:"),
    fonte: "Google"
  };
}

export async function searchGoogle(query, { fetch = globalThis.fetch } = {}) {
  const q = isIsbn(query) ? `isbn:${cleanIsbn(query)}` : query;
  const url = `${GOOGLE}?q=${encodeURIComponent(q)}&maxResults=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map(normalizeGoogleVolume).filter((b) => b.titolo);
}

// --- Open Library ---
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
      : "",
    fonte: "OpenLibrary"
  };
}

export async function searchOpenLibrary(query, { fetch = globalThis.fetch } = {}) {
  const param = isIsbn(query) ? `isbn=${cleanIsbn(query)}` : `q=${encodeURIComponent(query)}`;
  const url = `${OPENLIB}?${param}&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.docs || []).map(normalizeOpenLibDoc).filter((b) => b.titolo);
}

// --- Apple Books (iTunes Search) ---
export function normalizeItunesItem(it) {
  return {
    isbn: "",
    titolo: it.trackName || "",
    autori: it.artistName ? [it.artistName] : [],
    editore: "",
    anno: (it.releaseDate || "").slice(0, 4),
    descrizione: (it.description || "").replace(/<[^>]+>/g, ""),
    copertina: (it.artworkUrl100 || "").replace("100x100", "400x400"),
    fonte: "Apple"
  };
}

export async function searchAppleBooks(query, { fetch = globalThis.fetch } = {}) {
  // iTunes non cerca per ISBN: con un ISBN saltiamo questa fonte.
  if (isIsbn(query)) return [];
  const url = `${ITUNES}?term=${encodeURIComponent(query)}&country=IT&media=ebook&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(normalizeItunesItem).filter((b) => b.titolo);
}

// --- Merge di tutte le fonti ---
function dedupeKey(b) {
  if (b.isbn) return "isbn:" + b.isbn;
  return "t:" + (b.titolo || "").toLowerCase().trim() + "|" + (b.autori[0] || "").toLowerCase().trim();
}

export async function searchBooks(query, { fetch = globalThis.fetch } = {}) {
  const sources = [searchGoogle, searchOpenLibrary, searchAppleBooks];
  const lists = await Promise.all(
    sources.map((fn) => fn(query, { fetch }).catch(() => []))
  );
  const seen = new Map();
  for (const b of lists.flat()) {
    const k = dedupeKey(b);
    if (!seen.has(k)) seen.set(k, b);
  }
  return [...seen.values()];
}
