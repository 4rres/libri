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
