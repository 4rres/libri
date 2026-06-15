# Libri — Book Tracker personale (design)

Data: 2026-06-16
Stato: approvato (design) — pronto per piano di implementazione

## Obiettivo
Webapp statica, a uso personale, ospitata su GitHub Pages, per tracciare i libri
posseduti e quelli desiderati. Inserimento per ISBN o titolo con compilazione
automatica dei metadati (titolo, autore, copertina, ecc.). Possibilità di segnare
un libro come "letto".

## Architettura
- Sito 100% statico: HTML + CSS + JavaScript vanilla, **nessun build step**.
- Hosting: **GitHub Pages** dallo stesso repository.
- Persistenza dati: file **`libri.json`** versionato nel repo.
  - **Lettura**: all'avvio l'app scarica `libri.json` (via raw.githubusercontent / API contents).
  - **Scrittura**: aggiunte/modifiche/eliminazioni fanno un commit di `libri.json`
    tramite **GitHub REST API** (`PUT /repos/{owner}/{repo}/contents/libri.json`),
    usando il SHA corrente del file per l'update.
- **Autenticazione**: Personal Access Token (scope `contents:write` su quel repo)
  inserito una volta dall'utente e salvato **solo in `localStorage`** del browser.
  Mai committato nel repo. Senza token l'app è in sola lettura.

## Lookup metadati
- Fonte primaria: **Google Books API** (`https://www.googleapis.com/books/v1/volumes?q=...`),
  senza chiave per le ricerche base. Per ISBN: `q=isbn:<ISBN>`.
- Fallback: **Open Library** (`https://openlibrary.org/...`) se Google non trova nulla.
- Flusso: utente scrive ISBN o titolo → ricerca → mostra risultato con copertina →
  conferma → libro aggiunto alla collezione.
- Campi estratti: titolo, autori, copertina (URL), editore, anno, descrizione, isbn.

## Modello dati (`libri.json`)
Array di oggetti:
```json
{
  "id": "stringa univoca",
  "isbn": "9788812345678",
  "titolo": "...",
  "autori": ["..."],
  "copertina": "https://...",
  "editore": "...",
  "anno": "2024",
  "descrizione": "...",
  "stato": "posseduto",      // "posseduto" | "desiderato"
  "letto": false,
  "aggiunto": "2026-06-16T..."
}
```

## Componenti (JS, moduli a responsabilità singola)
- `api/github.js` — lettura/scrittura `libri.json` via GitHub API; gestione token e SHA.
- `api/lookup.js` — ricerca metadati (Google Books + fallback Open Library).
- `store.js` — stato in memoria della collezione + operazioni CRUD; orchestra github.js.
- `ui/list.js` — griglia copertine + filtri sidebar.
- `ui/detail.js` — dettaglio libro e azioni (segna letto, sposta stato, elimina).
- `ui/add.js` — campo di ricerca/aggiunta e conferma risultato lookup.
- `ui/settings.js` — inserimento/gestione token.

## Interfaccia
Tema scuro, estetica **Liquid Glass (Apple)**: superfici traslucide con
`backdrop-filter: blur()`, vibrancy, bordi luminosi sottili, angoli morbidi,
ombre morbide e senso di profondità/stratificazione.
- **Sidebar** (pannello vetro) con filtri: **Tutti**, **Libreria** (posseduti),
  **Lista desideri** (desiderati), **Letti**.
- **Griglia** di copertine; click → **dettaglio** con azioni:
  segna come letto, sposta in libreria/desideri, elimina.
- **Barra superiore**: campo per aggiungere (ISBN/titolo) + filtro testo sulla collezione.

## Gestione errori
- Token assente/non valido → modalità sola lettura + messaggio chiaro per inserirlo.
- Lookup senza risultati → messaggio + possibilità di inserimento manuale dei campi.
- Conflitto di scrittura (SHA cambiato) → ricarica `libri.json` e riprova.
- Rete offline → messaggio; la collezione già caricata resta visibile.

## Fuori scope (v1)
Statistiche, Citazioni, tag, serie, generi, scansione barcode da fotocamera.
Possibili estensioni future.

## Testing
- Test unitari per `lookup.js` (parsing risposte Google/Open Library) e per la
  logica di `store.js` (CRUD, transizioni stato/letto) con fetch mockato.
- Verifica manuale del flusso completo aggiunta→commit→ricarica con un repo di prova.
