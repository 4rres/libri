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
    const meta = dashed
      ? `<div class="meta">${[b.anno, b.fonte].filter(Boolean).join(" · ")}</div>`
      : badge;
    return `<div class="card" data-id="${b.id || ""}">
      <img src="${cover}" alt="" onerror="this.style.visibility='hidden'"/>
      <div class="t">${b.titolo || ""}</div>
      <div class="a">${(b.autori || []).join(", ")}</div>
      ${meta}
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
      if (!results.length) showNoResults(q);
      else renderResults(results);
    } catch (e) {
      $("results").innerHTML = `<p class="a">Errore ricerca: ${e.message}</p> `;
      showNoResults(q);
    }
  }

  function showNoResults(q) {
    const box = $("results");
    box.innerHTML += `<p class="a">Nessun risultato per "${q}".
      <button class="btn ghost" id="manual-btn">Inserisci a mano</button></p>`;
    $("manual-btn").onclick = () => openManual(q);
  }

  function openManual(q) {
    const isIsbn = /^\d{10}(\d{3})?$/.test((q || "").replace(/[-\s]/g, ""));
    const el = $("detail");
    el.innerHTML = `<div class="panel glass">
      <h2>Inserimento manuale</h2>
      <input id="m-titolo" class="add-input" placeholder="Titolo" value="${isIsbn ? "" : (q || "")}" />
      <input id="m-autori" class="add-input" placeholder="Autori (separati da virgola)" style="margin-top:8px" />
      <input id="m-anno" class="add-input" placeholder="Anno" style="margin-top:8px" />
      <input id="m-editore" class="add-input" placeholder="Editore" style="margin-top:8px" />
      <input id="m-isbn" class="add-input" placeholder="ISBN" value="${isIsbn ? (q || "") : ""}" style="margin-top:8px" />
      <input id="m-copertina" class="add-input" placeholder="URL copertina (opzionale)" style="margin-top:8px" />
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn" id="m-save">Aggiungi</button>
        <button class="btn ghost" id="m-close">Annulla</button>
      </div></div>`;
    el.classList.remove("hidden");
    $("m-close").onclick = () => el.classList.add("hidden");
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
      el.classList.add("hidden");
      $("results").innerHTML = "";
      $("add-input").value = "";
      renderAll();
    };
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
