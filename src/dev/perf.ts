// Performance-Messung (TDD 15.6, TAK-15) für den Dev-Schalter `?perf` (nur `npm run dev`, nicht im
// Build). Läuft auf einer eigenen Datenbank über die echten Wege der App: Import über Vorschau und
// Speichern, Lernüberblick wie in der Set-Ansicht (`loadOverview`: Lesen und Berechnen).
import { h } from "../app/dom";
import { previewImport, saveImport } from "../app/importText";
import type { StoredSet } from "../domain/model";
import { computeStats } from "../domain/stats";
import { copyText } from "../platform/clipboard";
import { openDatabase } from "../storage/database";
import { listSetEvents } from "../storage/sessions";
import { runTransaction } from "../storage/transaction";
import { PERF_ENTRIES, PERF_EVENTS, perfHistory, perfSetText } from "./perfData";

export const PERF_DB_NAME = "vokabeltrainer-perf";

/**
 * Grenzen aus TDD 15.6 in Millisekunden. Der Lernstand wird nachgeladen: Lesen und Berechnen zusammen
 * bis er erscheint, das Berechnen allein, weil es die Seite blockiert.
 */
const LIMIT = { import: 1000, overview: 1000, compute: 200 } as const;
const OVERVIEW_RUNS = 5;

const ms = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("de-DE");
const verdict = (value: number, limit: number) =>
  value < limit ? "erfüllt" : `NICHT erfüllt (Grenze ${ms.format(limit)} ms)`;

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(PERF_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    // Eine offene Verbindung in einem anderen Tab hält das Löschen auf.
    request.onblocked = () => reject(new Error("Messdatenbank ist in einem anderen Tab geöffnet."));
  });
}

async function timed<T>(work: () => Promise<T> | T): Promise<[T, number]> {
  const start = performance.now();
  const result = await work();
  return [result, performance.now() - start];
}

/** Dem Browser Zeit zum Zeichnen geben, damit der Fortschritt sichtbar wird. */
const breathe = () => new Promise((resolve) => setTimeout(resolve, 50));

async function measure(report: (line: string) => void): Promise<void> {
  report(`Gerät: ${navigator.userAgent}`);
  report(`Zeitpunkt: ${new Date().toLocaleString("de-DE")}`);
  report("");
  await deleteDatabase();
  const opened = await openDatabase({ appVersion: "perf", name: PERF_DB_NAME });
  if (!opened.ok) throw new Error(`Messdatenbank nicht nutzbar: ${opened.reason}`);
  const { db } = opened;
  try {
    const text = perfSetText();
    report(`Import ${count.format(PERF_ENTRIES)} Einträge, ${ms.format(text.length / 1024)} KB`);
    await breathe();
    const [preview, previewTime] = await timed(() => previewImport(db, text));
    if (!preview.ok) throw new Error(preview.errors.join(" "));
    if (preview.kind !== "new") throw new Error("Messset schon vorhanden");
    const [saved, saveTime] = await timed(() => saveImport(db, preview.set));
    if (!saved.ok) throw new Error(saved.error);
    const importTime = previewTime + saveTime;
    report(
      `  Vorschau ${ms.format(previewTime)} ms + Speichern ${ms.format(saveTime)} ms = ${ms.format(importTime)} ms → ${verdict(importTime, LIMIT.import)}`,
    );
    await breathe();
    const [again, againTime] = await timed(() => previewImport(db, text));
    if (!again.ok || again.kind !== "new" || again.duplicates.length !== 1)
      throw new Error("Duplikathinweis fehlt");
    report(
      `  Erneut prüfen mit Duplikathinweis: ${ms.format(againTime)} ms → ${verdict(againTime + saveTime, LIMIT.import)} (mit Speichern geschätzt)`,
    );
    report("  Abgleich mit vorhandenem Set (Diff) gibt es erst mit M4 – dort nachmessen.");
    report("");

    const set: StoredSet = preview.set;
    const [{ sessions, events }, generateTime] = await timed(() => perfHistory(set));
    const [, writeTime] = await timed(() =>
      runTransaction(db, ["sessions", "reviewEvents"], "readwrite", (transaction) => {
        for (const session of sessions) transaction.objectStore("sessions").add(session);
        for (const event of events) transaction.objectStore("reviewEvents").add(event);
      }),
    );
    report(
      `Verlauf vorbereitet: ${count.format(sessions.length)} Sitzungen, ${count.format(events.length)} Antworten (erzeugt ${ms.format(generateTime)} ms, geschrieben ${ms.format(writeTime)} ms, nicht bewertet)`,
    );
    report(`Lernüberblick über ${count.format(PERF_EVENTS)} Antworten, ${OVERVIEW_RUNS} Läufe:`);
    let slowest = 0;
    let slowestCompute = 0;
    for (let run = 1; run <= OVERVIEW_RUNS; run++) {
      await breathe();
      const [read, readTime] = await timed(() => listSetEvents(db, set.id));
      const [stats, computeTime] = await timed(() => computeStats(set, read));
      if (read.length !== PERF_EVENTS || stats.set.sessions === 0)
        throw new Error("Lernüberblick unvollständig");
      const total = readTime + computeTime;
      slowest = Math.max(slowest, total);
      slowestCompute = Math.max(slowestCompute, computeTime);
      report(
        `  Lauf ${run}: lesen ${ms.format(readTime)} ms + berechnen ${ms.format(computeTime)} ms = ${ms.format(total)} ms`,
      );
    }
    report(
      `  bis der Lernstand erscheint, höchstens: ${ms.format(slowest)} ms → ${verdict(slowest, LIMIT.overview)}`,
    );
    report(
      `  davon Berechnen (blockiert die Seite), höchstens: ${ms.format(slowestCompute)} ms → ${verdict(slowestCompute, LIMIT.compute)}`,
    );
  } finally {
    db.close();
    await deleteDatabase();
  }
}

export function perfView(): Node {
  const output = h("pre", { style: "white-space: pre-wrap; overflow-wrap: anywhere" });
  const status = h("p", { role: "status" });
  const copy = h(
    "button",
    {
      type: "button",
      class: "secondary",
      hidden: true,
      onclick: async () => {
        const copied = await copyText(output.textContent ?? "");
        status.textContent = copied
          ? "Ergebnis kopiert."
          : "Kopieren nicht möglich – bitte markieren.";
      },
    },
    "Ergebnis kopieren",
  );
  const start = h(
    "button",
    {
      type: "button",
      onclick: async () => {
        start.disabled = true;
        copy.hidden = true;
        output.textContent = "";
        status.textContent = "Messung läuft …";
        try {
          await measure((line) => (output.textContent += `${line}\n`));
          status.textContent = "Messung fertig.";
        } catch (error) {
          output.textContent += `\nFehler: ${error instanceof Error ? error.message : String(error)}\n`;
          status.textContent = "Messung abgebrochen.";
        }
        copy.hidden = false;
        start.disabled = false;
      },
    },
    "Messung starten",
  );
  return h(
    "main",
    null,
    h("h1", null, "Performance-Messung"),
    h(
      "p",
      null,
      "Misst Import und Lernüberblick mit erzeugten Daten in einer eigenen Datenbank (TDD 15.6). Deine Vokabelsets bleiben unberührt. Dauert je nach Gerät bis zu einer Minute.",
    ),
    start,
    status,
    output,
    copy,
  );
}
