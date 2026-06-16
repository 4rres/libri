import { esc } from "./util.js";

const FILTERS = [
  { key: "tutti", label: "Tutti" },
  { key: "libreria", label: "Libreria" },
  { key: "desideri", label: "Lista desideri" },
  { key: "letti", label: "Letti" }
];

let activeFilter = "tutti";
let searchSeq = 0; // scarta risposte di ricerche superate (#5)
let adding = false; // evita doppi inserimenti (#4)

export function initUI({ store, lookup, github }) {
  const $ = (id) => document.getElementById(id);

  // ---- helper immagini / copertine ----
  function coverHtml(b, cls) {
    if (b.copertina) {
      return `<img class="${cls}" src="${esc(b.copertina)}" alt="${esc(b.titolo)}"
        onerror="this.classList.add('broken')"/>`;
    }
    return `<div class="${cls} ph">📕</div>`;
  }

  function pickImageFile() {
    return new Promise((resolve) => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/png,image/jpeg";
      inp.onchange = () => resolve(inp.files && inp.files[0] ? inp.files[0] : null);
      inp.click();
    });
  }

  function compressImage(file, maxDim = 500, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("immagine non valida"));
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result; };
      reader.onerror = () => reject(new Error("lettura file fallita"));
      reader.readAsDataURL(file);
    });
  }

  // Comprime e carica un file immagine nel repo; restituisce l'URL raw.
  async function uploadCoverFile(file, bookId) {
    const dataUrl = await compressImage(file);
    const base64 = dataUrl.split(",")[1];
    return github.uploadCover(bookId || "img", base64, "jpg", Date.now());
  }

  // ---- overlay con chiusura su sfondo + Esc ----
  let escHandler = null;
  function closeOverlay(el) {
    el.classList.add("hidden");
    el.innerHTML = "";
    if (escHandler) { document.removeEventListener("keydown", escHandler); escHandler = null; }
  }
  function openOverlay(el, html) {
    if (escHandler) document.removeEventListener("keydown", escHandler); // niente listener doppi
    el.innerHTML = html;
    el.classList.remove("hidden");
    el.onclick = (e) => { if (e.target === el) closeOverlay(el); }; // click sullo sfondo
    escHandler = (e) => { if (e.key === "Escape") closeOverlay(el); };
    document.addEventListener("keydown", escHandler);
  }

  // ---- render ----
  function renderSidebar() {
    $("sidebar").innerHTML = FILTERS.map((f) => {
      const n = store.filter(f.key).length;
      return `<div class="nav-item ${f.key === activeFilter ? "active" : ""}" data-f="${f.key}">
        <span>${esc(f.label)}</span><span class="count">${n}</span></div>`;
    }).join("");
    $("sidebar").querySelectorAll(".nav-item").forEach((el) => {
      el.onclick = () => { activeFilter = el.dataset.f; renderAll(); };
    });
  }

  function cardHtml(b, dashed) {
    const badge = b.letto ? `<span class="read-badge">● letto</span>` : "";
    const meta = dashed
      ? `<div class="meta">${esc([b.anno, b.fonte].filter(Boolean).join(" · "))}</div>`
      : badge;
    return `<div class="card" data-id="${esc(b.id || "")}">
      ${coverHtml(b, "card-cover")}
      <div class="t">${esc(b.titolo || "")}</div>
      <div class="a">${esc((b.autori || []).join(", "))}</div>
      ${meta}
    </div>`;
  }

  function renderGrid() {
    const books = store.filter(activeFilter);
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
    openOverlay(el, `<div class="panel glass" role="dialog" aria-label="Dettaglio libro">
      <div class="detail-top">
        ${coverHtml(b, "detail-cover")}
        <div>
          <h2>${esc(b.titolo)}</h2>
          <p class="a">${esc((b.autori || []).join(", "))}${b.editore || b.anno ? " — " : ""}${esc(b.editore)} ${esc(b.anno)}</p>
        </div>
      </div>
      <p class="descr">${esc(b.descrizione || "")}</p>
      <div class="cover-edit">
        <button class="btn ghost" id="d-cover-file">Cambia copertina (file)</button>
        <input id="d-cover-url" class="add-input" placeholder="…o incolla URL copertina" />
        <button class="btn ghost" id="d-cover-url-btn">Usa URL</button>
      </div>
      <div class="actions">
        <button class="btn" id="d-read">${b.letto ? "Segna non letto" : "Segna come letto"}</button>
        <button class="btn ghost" id="d-stato">${b.stato === "posseduto" ? "Sposta in desideri" : "Sposta in libreria"}</button>
        <button class="btn ghost" id="d-del">Elimina</button>
        <button class="btn ghost" id="d-close">Chiudi</button>
      </div></div>`);
    $("d-close").onclick = () => closeOverlay(el);
    $("d-read").onclick = async () => { await store.setRead(id, !b.letto); closeOverlay(el); renderAll(); };
    $("d-stato").onclick = async () => {
      await store.setStato(id, b.stato === "posseduto" ? "desiderato" : "posseduto");
      closeOverlay(el); renderAll();
    };
    $("d-del").onclick = async () => {
      if (!window.confirm(`Eliminare "${b.titolo}" dalla collezione?`)) return;
      await store.remove(id); closeOverlay(el); renderAll();
    };
    $("d-cover-url-btn").onclick = async () => {
      const url = $("d-cover-url").value.trim();
      if (!url) return;
      await store.setCover(id, url); openDetail(id); renderAll();
    };
    $("d-cover-file").onclick = async () => {
      const file = await pickImageFile();
      if (!file) return;
      const btn = $("d-cover-file");
      btn.disabled = true; btn.textContent = "Carico…";
      try {
        const url = await uploadCoverFile(file, id);
        await store.setCover(id, url);
        openDetail(id); renderAll();
      } catch (e) {
        alert("Copertina non caricata: " + e.message);
        btn.disabled = false; btn.textContent = "Cambia copertina (file)";
      }
    };
  }

  function renderResults(results) {
    const box = $("results");
    box.innerHTML = `<p class="a">Risultati — clicca per aggiungere:</p>` +
      `<div class="grid">${results.map((b) => cardHtml(b, true)).join("")}</div>`;
    box.querySelectorAll(".card").forEach((el, i) => {
      el.onclick = async () => {
        if (adding) return;
        adding = true;
        try {
          await store.add({ ...results[i], stato: activeFilter === "desideri" ? "desiderato" : "posseduto" });
          box.innerHTML = "";
          $("add-input").value = "";
          renderAll();
        } catch (e) {
          alert("Non aggiunto: " + e.message);
        } finally {
          adding = false;
        }
      };
    });
  }

  async function doSearch() {
    const q = $("add-input").value.trim();
    if (!q) return;
    const seq = ++searchSeq;
    $("results").innerHTML = `<p class="a">Cerco…</p>`;
    try {
      const results = await lookup.searchBooks(q);
      if (seq !== searchSeq) return; // una ricerca più recente ha la precedenza
      if (!results.length) showNoResults(q);
      else renderResults(results);
    } catch (e) {
      if (seq !== searchSeq) return;
      showNoResults(q, "Errore ricerca: " + e.message);
    }
  }

  function showNoResults(q, prefix) {
    const head = prefix ? `<p class="a">${esc(prefix)}</p>` : "";
    $("results").innerHTML = head +
      `<p class="a">Nessun risultato per "${esc(q)}".
      <button class="btn ghost" id="manual-btn">Inserisci a mano</button></p>`;
    $("manual-btn").onclick = () => openManual(q);
  }

  function openManual(q) {
    const isIsbn = /^\d{10}(\d{3})?$/.test((q || "").replace(/[-\s]/g, ""));
    const el = $("detail");
    openOverlay(el, `<div class="panel glass" role="dialog" aria-label="Inserimento manuale">
      <h2>Inserimento manuale</h2>
      <input id="m-titolo" class="add-input" placeholder="Titolo" value="${isIsbn ? "" : esc(q)}" />
      <input id="m-autori" class="add-input" placeholder="Autori (separati da virgola)" style="margin-top:8px" />
      <input id="m-anno" class="add-input" placeholder="Anno" style="margin-top:8px" />
      <input id="m-editore" class="add-input" placeholder="Editore" style="margin-top:8px" />
      <input id="m-isbn" class="add-input" placeholder="ISBN" value="${isIsbn ? esc(q) : ""}" style="margin-top:8px" />
      <div class="cover-edit" style="margin-top:8px">
        <button class="btn ghost" id="m-cover-file">Carica copertina (file)</button>
        <input id="m-copertina" class="add-input" placeholder="…o URL copertina" />
      </div>
      <div class="actions">
        <button class="btn" id="m-save">Aggiungi</button>
        <button class="btn ghost" id="m-close">Annulla</button>
      </div></div>`);
    $("m-close").onclick = () => closeOverlay(el);
    $("m-cover-file").onclick = async () => {
      const file = await pickImageFile();
      if (!file) return;
      const btn = $("m-cover-file");
      btn.disabled = true; btn.textContent = "Carico…";
      try {
        const url = await uploadCoverFile(file, "manual");
        $("m-copertina").value = url;
        btn.textContent = "Copertina caricata ✓";
      } catch (e) {
        alert("Copertina non caricata: " + e.message);
        btn.disabled = false; btn.textContent = "Carica copertina (file)";
      }
    };
    $("m-save").onclick = async () => {
      const titolo = $("m-titolo").value.trim();
      if (!titolo) { $("m-titolo").focus(); return; }
      await store.add({
        titolo,
        autori: $("m-autori").value.split(",").map((s) => s.trim()).filter(Boolean),
        anno: $("m-anno").value.trim(),
        editore: $("m-editore").value.trim(),
        isbn: $("m-isbn").value.trim(),
        copertina: $("m-copertina").value.trim(),
        stato: activeFilter === "desideri" ? "desiderato" : "posseduto"
      });
      closeOverlay(el);
      $("results").innerHTML = "";
      $("add-input").value = "";
      renderAll();
    };
  }

  function openSettings() {
    const el = $("settings");
    openOverlay(el, `<div class="panel glass" role="dialog" aria-label="Impostazioni">
      <h2>Token GitHub</h2>
      <p class="a">Serve un Personal Access Token con permesso <b>contents:write</b> sul repo. Resta solo in questo browser.</p>
      <input id="s-token" class="add-input" type="password" placeholder="ghp_…" value="${esc(github.getToken())}" />
      <div class="actions">
        <button class="btn" id="s-save">Salva</button>
        <button class="btn ghost" id="s-close">Chiudi</button>
      </div></div>`);
    $("s-save").onclick = () => { github.setToken($("s-token").value); closeOverlay(el); };
    $("s-close").onclick = () => closeOverlay(el);
  }

  $("add-btn").onclick = doSearch;
  $("add-input").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
  $("settings-btn").onclick = openSettings;

  renderAll();
}
