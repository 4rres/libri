# Libri — Book Tracker personale

Riepilogo del progetto, delle scelte e di tutto il lavoro svolto.

- **Sito live:** https://4rres.github.io/libri/
- **Repo:** https://github.com/4rres/libri
- **Ultimo aggiornamento doc:** 2026-06-16

---

## Cos'è
Webapp personale per tracciare i libri **posseduti** e **desiderati**. Si aggiunge
un libro per **ISBN o titolo** e i metadati (titolo, autore, copertina, editore,
anno, descrizione) vengono compilati automaticamente. Ogni libro si può segnare
come **letto**.

## Architettura
- **Sito 100% statico** (HTML + CSS + JavaScript vanilla, **nessun build step**),
  ospitato su **GitHub Pages**.
- **Dati** in `libri.json`, versionato nel repo.
  - Lettura: all'avvio via GitHub Contents API.
  - Scrittura: ogni modifica fa un commit di `libri.json` via GitHub REST API.
- **Autenticazione**: Personal Access Token (fine-grained, permesso
  *Contents: Read and write*) inserito una volta dal pannello ⚙︎ e salvato
  **solo nel browser** (`localStorage`), mai nel repo. Senza token l'app è in sola lettura.
- **PWA installabile**: manifest + service worker (offline + finestra propria,
  title-bar arancione `#ff6b35`). Strategia *network-first* così gli aggiornamenti
  di design appaiono subito; auto-reload quando arriva un nuovo service worker.

## Ricerca metadati (3 fonti, gratis e senza chiave, CORS-ok)
1. **Google Books API**
2. **Open Library**
3. **Apple Books** (iTunes Search, country IT)

I risultati delle tre fonti vengono **uniti e deduplicati**. Se il titolo completo
non trova nulla (tipico dei titoli composti, es. *"Lulù-Lo spirito della terra-Il
vaso di Pandora"*), scatta un **fallback automatico**: il titolo viene spezzato sui
separatori (`-`, `:`, `.`) e si cercano i singoli segmenti **in parallelo**,
aggregando i candidati (mostrati con anno + fonte per riconoscere l'edizione giusta).

Per i libri che nessun catalogo ha (es. uscite recentissime o ASIN Kindle senza
ISBN) c'è l'**inserimento manuale**.

## Copertine
- Provengono dalle API; se mancano si può **incollare un URL** o **caricare un file
  PNG/JPEG da locale**.
- Il file viene **compresso lato client** (max 500px, JPEG) e caricato nel repo in
  `covers/`, salvando in `libri.json` solo l'URL → il file dati resta leggero.
- La copertina si può cambiare a **qualsiasi** libro dal suo dettaglio.

## Modello dati (`libri.json`)
```json
{
  "id": "uuid", "isbn": "", "titolo": "", "autori": ["..."],
  "copertina": "url", "editore": "", "anno": "", "descrizione": "",
  "stato": "posseduto | desiderato", "letto": false, "aggiunto": "ISO date"
}
```

## File principali
| File | Responsabilità |
|------|----------------|
| `index.html` | Struttura pagina, registrazione service worker, pulsante Installa |
| `styles.css` | Tema chiaro Liquid Glass, sfondo, responsive, card glass |
| `src/main.js` | Bootstrap: carica dati, crea store, avvia UI |
| `src/lookup.js` | Ricerca 3 fonti + merge + fallback per segmenti |
| `src/store.js` | Stato in memoria + CRUD + adozione lista unita dal merge |
| `src/github.js` | Lettura/scrittura `libri.json`, merge anti-conflitto, upload copertine, token |
| `src/ui.js` | Render sidebar/griglia/dettaglio/ricerca/impostazioni, upload copertina |
| `src/util.js` | `esc()` per escaping HTML |
| `sw.js` | Service worker (cache shell, network-first) |
| `manifest.webmanifest` | Manifest PWA |
| `test/*.test.js` | Test unitari (node --test) |

## Test
- `npm test` — 23 test su logica pura (lookup, store, merge, escaping).
- Anteprima locale: `python3 -m http.server 8000`.

## Cronologia del lavoro
1. Spec e piano (in `docs/superpowers/`), implementazione TDD del nucleo.
2. Repo creato e pubblicato su GitHub Pages; token configurato.
3. Design migliorato (v0): tema chiaro, sfondo, Liquid Glass; favicon dall'icona `.icns`.
4. Ricerca portata a 3 fonti con merge.
5. Trasformazione in **PWA installabile** + rifiniture di design.
6. Card in stile liquid glass (bordo + blur).
7. **Fallback per titoli composti** + aggregazione candidati + anno/fonte nei risultati.
8. Fix cache service worker (v2→v4) + auto-reload per evitare versioni stantie.
9. Ripristino copertine mancanti via Google Books per ISBN.
10. **Giro di hardening** (vedi sotto).

## Hardening (ultimo giro)
**Bug corretti**
- Perdita dati al salvataggio concorrente → **merge per `id`** del remoto col locale.
- **Escaping HTML** ovunque (`esc()`), niente rotture con virgolette / `<`.
- "Cerco…" non spariva → ora viene sostituito.
- Doppio inserimento da doppio click → **guard**.
- Risultati di ricerca obsoleti → **token di sequenza**, vince l'ultima ricerca.

**Robustezza / UX**
- Messaggi d'errore parlanti (401/403/404/409/5xx).
- Fallback di ricerca **in parallelo** (più veloce).
- Placeholder 📕 per copertine mancanti.
- Modali chiudibili con **click sullo sfondo** ed **Esc**.
- **Conferma** prima di eliminare.
- Accessibilità (aria-label, alt).
- Rimosso codice morto e `pnpm-lock.yaml`.
- Rimosso il filtro "Filtra la collezione".

## Idee per il futuro (non implementate)
- Verifica/ripristino automatico delle copertine mancanti in collezione.
- Pulizia dei file copertina orfani in `covers/`.
- Ordinamento/raggruppamento (per autore, anno, data aggiunta).

## Note operative
- Per scrivere serve il token in ⚙︎ (fine-grained, *Contents: Read and write* sul repo `libri`).
- Le copertine caricate da file generano un commit in `covers/` e poi l'aggiornamento di `libri.json`.
- Grazie al merge anti-conflitto, non è più necessario "ricaricare prima di modificare".
