// Config is hardcoded by the user after forking. Edit these two lines:
export const REPO_OWNER = "4rres";
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

function contentsUrl(path) {
  return `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
}

function decode(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}
function encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

// Messaggi d'errore comprensibili a partire dallo status HTTP.
function describe(status) {
  if (status === 401) return "token non valido — ricontrollalo in ⚙︎";
  if (status === 403) return "permessi insufficienti o token scaduto — rigeneralo con permesso Contents: Read and write";
  if (status === 404) return "file o repo non trovato";
  if (status === 409) return "conflitto di versione";
  if (status >= 500) return "GitHub temporaneamente non disponibile, riprova";
  return "errore " + status;
}

// Unione remoto+locale per id: tiene le voci aggiunte altrove (presenti solo nel
// remoto) e preferisce la versione locale per le voci modificate qui.
export function mergeBooks(remote, local) {
  const byId = new Map();
  for (const b of remote || []) if (b && b.id) byId.set(b.id, b);
  for (const b of local || []) if (b && b.id) byId.set(b.id, b); // locale vince
  return [...byId.values()];
}

let currentSha = null;

// Public read: works without a token via the contents API.
export async function load() {
  const res = await fetch(`${contentsUrl(FILE_PATH)}?ref=${BRANCH}`, {
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!res.ok) throw new Error("Caricamento fallito: " + describe(res.status));
  const data = await res.json();
  currentSha = data.sha;
  return JSON.parse(decode(data.content));
}

function putFile(path, contentB64, sha, message) {
  const token = getToken();
  const body = { message, content: contentB64, branch: BRANCH };
  if (sha) body.sha = sha;
  return fetch(contentsUrl(path), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    },
    body: JSON.stringify(body)
  });
}

// Write: requires a token with contents:write.
// Restituisce la lista effettivamente salvata (eventualmente unita al remoto).
export async function save(books) {
  if (!getToken()) throw new Error("Nessun token: modalità sola lettura.");
  let toSave = books;
  let res = await putFile(FILE_PATH, encode(JSON.stringify(toSave, null, 2)), currentSha || undefined, "update libri.json");

  // Conflitto: ricarica il remoto, UNISCI (senza perdere modifiche altrui) e riprova.
  if (res.status === 409) {
    const remote = await load(); // aggiorna currentSha
    toSave = mergeBooks(remote, books);
    res = await putFile(FILE_PATH, encode(JSON.stringify(toSave, null, 2)), currentSha, "merge libri.json");
  }
  if (!res.ok) throw new Error("Salvataggio fallito: " + describe(res.status));
  const data = await res.json();
  currentSha = data.content.sha;
  return toSave;
}

// Carica un'immagine copertina nel repo (cartella covers/) e ne restituisce
// l'URL raw pubblico. Nome file con timestamp per evitare cache stantia.
export async function uploadCover(bookId, base64NoPrefix, ext, stamp) {
  if (!getToken()) throw new Error("Serve il token per caricare la copertina (⚙︎).");
  const safeId = String(bookId || "img").replace(/[^a-zA-Z0-9_-]/g, "");
  const path = `covers/${safeId}-${stamp}.${ext}`;
  const res = await putFile(path, base64NoPrefix, undefined, "add cover " + path);
  if (!res.ok) throw new Error("Upload copertina fallito: " + describe(res.status));
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${path}`;
}
