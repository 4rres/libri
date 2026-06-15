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
