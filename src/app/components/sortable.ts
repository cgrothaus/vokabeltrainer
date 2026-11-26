// Ziehen am Griff (TDD 10, D-54): Die Zeile wird zur Lücke, eine Kopie folgt dem Finger, am Rand des
// Fensters läuft die Seite mit. Losgelassen zählt, wo die Lücke steht, auch in einer anderen Liste.
// Gleichwertige Wege ohne Ziehen (Pfeiltasten am Griff, Menü) bietet die Ansicht selbst.
//
// Erwartet im `board`: Listen `ul[data-section-id]` mit Zeilen `li[data-entry-id]`, darin ein Griff
// `.grip`, und je Liste eine Zeile `.drop-empty` (Ziel, solange die Liste leer ist).

export interface SortableOptions {
  /** Losgelassen: Eintrag, Ziel-Sektion und Stelle darin, gezählt ohne den Eintrag selbst. */
  drop: (entryId: string, sectionId: string, index: number) => void;
  /** Abgebrochen (z. B. vom System): Die Ansicht zeichnet den alten Stand neu. */
  cancel: () => void;
  signal: AbortSignal;
}

/** Abstand zum Fensterrand, ab dem die Seite mitläuft; unten mit Platz für die Aktionsleiste. */
const EDGE_TOP = 90;
const EDGE_BOTTOM = 130;

export function sortable(board: HTMLElement, options: SortableOptions): void {
  board.addEventListener("pointerdown", (event) => start(event, board, options), {
    signal: options.signal,
  });
}

function start(event: PointerEvent, board: HTMLElement, options: SortableOptions): void {
  const grip = (event.target as Element).closest<HTMLElement>(".grip");
  if (!grip || !board.contains(grip)) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const row = grip.closest<HTMLElement>("li[data-entry-id]");
  if (!row) return;
  // Kein Scrollen, keine Textauswahl, kein Kontextmenü unter iOS.
  event.preventDefault();

  const rect = row.getBoundingClientRect();
  const ghost = row.cloneNode(true) as HTMLElement;
  ghost.classList.add("ghost");
  ghost.removeAttribute("data-entry-id");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.width = `${rect.width}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  document.body.append(ghost);
  document.body.classList.add("dragging");
  row.classList.add("placeholder");
  row.style.height = `${rect.height}px`;

  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  let x = event.clientX;
  let y = event.clientY;
  const pointer = event.pointerId;

  const lists = () => [...board.querySelectorAll<HTMLElement>("ul[data-section-id]")];
  /** Die Liste unter dem Finger, sonst die nächste; waagerechter Abstand zählt mehr (Spalten). */
  const listAt = (all: HTMLElement[]): HTMLElement => {
    let best = all[0]!;
    let distance = Infinity;
    for (const list of all) {
      const box = (list.closest("section") ?? list).getBoundingClientRect();
      const dx = x < box.left ? box.left - x : x > box.right ? x - box.right : 0;
      const dy = y < box.top ? box.top - y : y > box.bottom ? y - box.bottom : 0;
      const value = dx * 4 + dy;
      if (value < distance) [best, distance] = [list, value];
    }
    return best;
  };
  const place = () => {
    const all = lists();
    if (all.length === 0) return;
    const target = listAt(all);
    const rows = [...target.querySelectorAll<HTMLElement>("li[data-entry-id]")].filter(
      (item) => item !== row,
    );
    const before = rows.find((item) => {
      const box = item.getBoundingClientRect();
      return y < box.top + box.height / 2;
    });
    const reference = before ?? target.querySelector(".drop-empty");
    if (row.parentElement !== target || row.nextElementSibling !== reference)
      target.insertBefore(row, reference);
    for (const list of all) {
      const empty = list.querySelector<HTMLElement>(".drop-empty");
      if (empty) empty.hidden = list.querySelector("li[data-entry-id]") !== null;
    }
  };

  let frame = 0;
  const tick = () => {
    if (y < EDGE_TOP) window.scrollBy(0, -Math.ceil((EDGE_TOP - y) / 6));
    else if (y > innerHeight - EDGE_BOTTOM)
      window.scrollBy(0, Math.ceil((y - (innerHeight - EDGE_BOTTOM)) / 6));
    place();
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  const move = (moved: PointerEvent) => {
    if (moved.pointerId !== pointer) return;
    moved.preventDefault();
    x = moved.clientX;
    y = moved.clientY;
    ghost.style.left = `${x - offsetX}px`;
    ghost.style.top = `${y - offsetY}px`;
  };
  const finish = (ended: PointerEvent) => {
    if (ended.pointerId !== pointer) return;
    cancelAnimationFrame(frame);
    // Die Lücke folgt dem Zeiger nur mit jedem Bild: Kam seit dem letzten keins (langsames Gerät,
    // schnelles Loslassen), stünde sie noch an der alten Stelle. Deshalb dort, wo der Zeiger endet.
    if (ended.type === "pointerup") {
      x = ended.clientX;
      y = ended.clientY;
      place();
    }
    // Am Dokument statt am Griff: Das Verschieben der Zeile im DOM hebt die Zeigererfassung auf.
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", finish);
    document.removeEventListener("pointercancel", finish);
    ghost.remove();
    document.body.classList.remove("dragging");
    row.classList.remove("placeholder");
    row.style.height = "";
    const list = row.closest<HTMLElement>("ul[data-section-id]");
    if (ended.type === "pointercancel" || !list || options.signal.aborted) return options.cancel();
    const index = [...list.querySelectorAll("li[data-entry-id]")].indexOf(row);
    options.drop(row.dataset.entryId!, list.dataset.sectionId!, index);
  };
  document.addEventListener("pointermove", move, { passive: false });
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);
}
