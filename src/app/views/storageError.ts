// Zustände, in denen die App nicht mit den gespeicherten Daten arbeiten kann (TDD 3.4, 6.5, 7.2).
// Die Texte erklären die Lage ohne Fachbegriffe und nennen den nächsten Schritt.
import { type BackupFile, backupFileName } from "../../domain/backup";
import { deliverFile } from "../../platform/deliverFile";
import type { OpenResult } from "../../storage/database";
import { h } from "../dom";

export type StorageProblem =
  | Extract<OpenResult, { ok: false }>
  /** Ein anderer Tab hat eine neuere Version geöffnet; die eigene Verbindung ist geschlossen. */
  | { reason: "replaced" }
  /** Ein anderer Tab mit älterer Version verhindert das Öffnen. */
  | { reason: "blocked" };

const reloadButton = () =>
  h("button", { type: "button", onclick: () => location.reload() }, "Neu laden");

export function storageErrorView(problem: StorageProblem): Node {
  switch (problem.reason) {
    case "unavailable":
      return screen(
        "Speichern nicht möglich",
        h(
          "p",
          null,
          "Dieser Browser erlaubt der App nicht, Daten zu speichern, zum Beispiel im privaten Modus. Öffne die App in einem normalen Browserfenster.",
        ),
      );
    case "newer-version":
      return screen(
        "Bitte neu laden",
        h(
          "p",
          null,
          "Die App wurde inzwischen aktualisiert. Lade die Seite neu, um die aktuelle Version zu verwenden. Deine Daten bleiben erhalten.",
        ),
        reloadButton(),
      );
    case "replaced":
      return screen(
        "Bitte neu laden",
        h("p", null, "Die App wurde in einem anderen Tab aktualisiert. Bitte neu laden."),
        reloadButton(),
      );
    case "blocked":
      return screen(
        "Einen Moment bitte",
        h(
          "p",
          null,
          "Die App ist noch in einem anderen Tab mit einer älteren Version geöffnet. Bitte schließe diesen Tab; danach geht es hier von selbst weiter.",
        ),
      );
    case "setup-failed":
      return screen(
        "Speicher nicht eingerichtet",
        h(
          "p",
          null,
          "Der Speicher für deine Daten konnte nicht eingerichtet werden. Lade die Seite neu, um es noch einmal zu versuchen.",
        ),
        reloadButton(),
      );
    case "migration-failed":
      return screen(
        "Daten nicht übernommen",
        h(
          "p",
          null,
          "Die neue App-Version konnte deine gespeicherten Daten nicht übernehmen. Deine Daten sind unverändert erhalten.",
        ),
        problem.backup
          ? [
              h("p", null, "Speichere sie jetzt als Notfall-Backup, damit sie sicher sind."),
              backupButton(problem.backup),
            ]
          : [
              h(
                "p",
                null,
                "Sie ließen sich gerade auch nicht auslesen. Lade die Seite später neu.",
              ),
              reloadButton(),
            ],
      );
  }
}

function backupButton(backup: BackupFile): Node {
  return h(
    "button",
    {
      type: "button",
      onclick: () => {
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        deliverFile(blob, backupFileName(new Date()));
      },
    },
    "Notfall-Backup speichern",
  );
}

function screen(title: string, ...content: (Node | Node[])[]): Node {
  return h("main", null, h("h1", null, title), content);
}
