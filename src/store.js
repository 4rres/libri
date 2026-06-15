export function createStore({ initial = [], persist, now, id } = {}) {
  let books = structuredClone(initial);

  async function save() {
    if (persist) await persist(books);
  }

  function find(bookId) {
    return books.find((b) => b.id === bookId);
  }

  return {
    all() {
      return books;
    },
    filter(which) {
      switch (which) {
        case "libreria": return books.filter((b) => b.stato === "posseduto");
        case "desideri": return books.filter((b) => b.stato === "desiderato");
        case "letti": return books.filter((b) => b.letto);
        case "tutti":
        default: return books;
      }
    },
    async add(book) {
      const entry = {
        id: id(),
        isbn: book.isbn || "",
        titolo: book.titolo || "",
        autori: book.autori || [],
        copertina: book.copertina || "",
        editore: book.editore || "",
        anno: book.anno || "",
        descrizione: book.descrizione || "",
        stato: book.stato || "posseduto",
        letto: false,
        aggiunto: now()
      };
      books.push(entry);
      await save();
      return entry;
    },
    async setRead(bookId, value) {
      const b = find(bookId);
      if (b) { b.letto = value; await save(); }
    },
    async setStato(bookId, stato) {
      const b = find(bookId);
      if (b) { b.stato = stato; await save(); }
    },
    async remove(bookId) {
      books = books.filter((b) => b.id !== bookId);
      await save();
    }
  };
}
