const GOOGLE = "https://www.googleapis.com/books/v1/volumes";
const OPENLIB = "https://openlibrary.org/search.json";

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

export async function searchBooks(query, { fetch = globalThis.fetch } = {}) {
  const q = isIsbn(query) ? `isbn:${query.replace(/[-\s]/g, "")}` : query;
  const url = `${GOOGLE}?q=${encodeURIComponent(q)}&maxResults=5`;
  const res = await fetch(url);
  if (!res.ok) return searchOpenLibrary(query, { fetch });
  const data = await res.json();
  const results = (data.items || []).map(normalizeGoogleVolume).filter((b) => b.titolo);
  if (results.length) return results;
  return searchOpenLibrary(query, { fetch });
}
