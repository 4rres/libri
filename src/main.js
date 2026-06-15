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
