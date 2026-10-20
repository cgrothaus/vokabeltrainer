// Backup speichern und wiederherstellen (TDD 11.3, 11.4, FR-19). In M0 mit knapper Bestätigung; die
// Warnung nur bei vorhandenen Daten und das Angebot eines vorherigen Backups folgen mit S-25.
import { type BackupSummary, type CheckedBackup, MAX_BACKUP_SIZE } from "../../domain/backup";
import type { Delivery } from "../../platform/deliverFile";
import type { CheckOutcome, PreparedBackup, RestoreOutcome } from "../backup";
import { h } from "../dom";

export interface BackupContext {
  prepareBackup: () => Promise<PreparedBackup>;
  /** Muss direkt im Klick aufgerufen werden, sonst öffnet sich das Teilen-Menü nicht. */
  saveBackup: (prepared: PreparedBackup) => Promise<Delivery>;
  lastBackupAt: () => Promise<string | undefined>;
  checkBackup: (text: string) => CheckOutcome;
  restore: (backup: CheckedBackup) => Promise<RestoreOutcome>;
}

/** So viele Fehler werden einzeln gezeigt. */
const SHOWN_ERRORS = 10;

const NOT_PREPARED =
  "Das Backup konnte nicht vorbereitet werden. Lade die Seite neu und versuche es noch einmal.";
const NOT_SAVED =
  "Das Backup konnte nicht gespeichert werden. Lade die Seite neu und versuche es noch einmal.";
const TOO_LARGE = "Die Datei ist zu groß für ein Backup des Vokabeltrainers.";
const UNREADABLE = "Die Datei konnte nicht gelesen werden. Wähle sie noch einmal aus.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

const dateTime = (iso: string) =>
  `${date(iso)}, ${new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;

function describe(summary: BackupSummary): string {
  const sets = `${count(summary.sets, "Set", "Sets")} mit ${count(summary.entries, "Eintrag", "Einträgen")}`;
  const sessions = count(summary.sessions, "Lernsitzung", "Lernsitzungen");
  const events = count(summary.events, "Antwort", "Antworten");
  return `Backup vom ${date(summary.exportedAt)}: ${sets}, ${sessions}, ${events}.`;
}

/** Fokus auf eine Meldung, damit Screenreader sie vorlesen und die Tastatur dort weitermacht. */
function focus(element: HTMLElement): void {
  element.tabIndex = -1;
  element.focus();
}

export function backupView(context: BackupContext): Node {
  const save = saveSection(context);
  return h(
    "main",
    { class: "backup" },
    h("h1", null, "Backup und Wiederherstellung"),
    save.section,
    // Nach dem Wiederherstellen gibt es einen neuen Bestand; das vorbereitete Backup wäre veraltet.
    restoreSection(context, save.refresh),
    h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek")),
  );
}

function saveSection(context: BackupContext): { section: Node; refresh: () => void } {
  let prepared: PreparedBackup | null = null;
  const last = h("p");
  const status = h("div", { "aria-live": "polite" });
  const save = h(
    "button",
    {
      type: "button",
      disabled: true,
      onclick: async () => {
        if (!prepared) return;
        save.disabled = true;
        status.replaceChildren();
        try {
          const delivery = await context.saveBackup(prepared);
          status.replaceChildren(
            h(
              "p",
              null,
              delivery === "cancelled" ? "Backup nicht gespeichert." : "Backup gespeichert.",
            ),
          );
          void showLast();
        } catch (error) {
          console.error("Backup nicht gespeichert", error);
          status.replaceChildren(h("p", null, NOT_SAVED));
        } finally {
          save.disabled = false;
        }
      },
    },
    "Backup wird vorbereitet …",
  );

  const showLast = async () => {
    const at = await context.lastBackupAt().catch(() => undefined);
    last.textContent = at ? `Letztes Backup: ${dateTime(at)}` : "Noch kein Backup gespeichert.";
  };

  const prepare = async () => {
    save.disabled = true;
    save.textContent = "Backup wird vorbereitet …";
    try {
      prepared = await context.prepareBackup();
      save.textContent = "Backup speichern";
      save.disabled = false;
    } catch (error) {
      console.error("Backup nicht vorbereitet", error);
      save.textContent = "Backup speichern";
      status.replaceChildren(h("p", null, NOT_PREPARED));
    }
  };

  const refresh = () => {
    void showLast();
    void prepare();
  };
  refresh();

  const section = h(
    "section",
    { "aria-labelledby": "backup-save" },
    h("h2", { id: "backup-save" }, "Backup speichern"),
    h(
      "p",
      null,
      "Ein Backup enthält alle Vokabelsets, deinen Lernstand und deine Einstellungen. Speichere es an einem sicheren Ort, zum Beispiel in „Dateien“ oder in deiner Cloud.",
    ),
    last,
    save,
    status,
  );
  return { section, refresh };
}

function restoreSection(context: BackupContext, onRestored: () => void): Node {
  const file = h("input", {
    id: "backup-file",
    type: "file",
    // Wie beim Import; ob iOS damit .json-Dateien auswählbar lässt, wird in S-11 geprüft (O-08).
    accept: ".json,application/json,text/plain",
  });
  const errors = h("div", { role: "alert" });
  const confirmation = h("div");
  const status = h("div", { "aria-live": "polite" });

  const reset = () => {
    errors.replaceChildren();
    confirmation.replaceChildren();
    status.replaceChildren();
  };

  const showErrors = (messages: string[]) => {
    const hidden = messages.length - SHOWN_ERRORS;
    errors.replaceChildren(
      h(
        "div",
        null,
        h("p", null, "Das Backup kann nicht wiederhergestellt werden:"),
        h(
          "ul",
          null,
          messages.slice(0, SHOWN_ERRORS).map((message) => h("li", null, message)),
        ),
        hidden > 0 && h("p", null, `… und ${hidden} weitere Fehler.`),
      ),
    );
  };

  const confirm = (backup: CheckedBackup, summary: BackupSummary) => {
    const text = h("p", null, describe(summary));
    const replace = h(
      "button",
      {
        type: "button",
        onclick: async () => {
          replace.disabled = true;
          cancel.disabled = true;
          file.disabled = true;
          let outcome: RestoreOutcome;
          try {
            outcome = await context.restore(backup);
          } catch (error) {
            console.error("Backup nicht wiederhergestellt", error);
            outcome = { ok: false, error: "Das Backup konnte nicht wiederhergestellt werden." };
          }
          file.disabled = false;
          confirmation.replaceChildren();
          if (!outcome.ok) return showErrors([outcome.error]);
          const done = h("p", null, "Backup wiederhergestellt.");
          status.replaceChildren(done);
          focus(done);
          onRestored();
        },
      },
      "Alle Daten ersetzen",
    );
    const cancel = h(
      "button",
      { type: "button", class: "secondary", onclick: () => reset() },
      "Abbrechen",
    );
    confirmation.replaceChildren(
      h(
        "div",
        { class: "confirm" },
        text,
        h("p", null, "Alle Daten auf diesem Gerät werden dadurch ersetzt."),
        h("div", { class: "actions" }, replace, cancel),
      ),
    );
    focus(text);
  };

  file.addEventListener("change", async () => {
    const chosen = file.files?.[0];
    // Zurücksetzen, damit dieselbe Datei erneut auswählbar ist.
    file.value = "";
    reset();
    if (!chosen) return;
    if (chosen.size > MAX_BACKUP_SIZE) return showErrors([TOO_LARGE]);
    let text: string;
    try {
      text = await chosen.text();
    } catch (error) {
      console.error("Datei nicht lesbar", error);
      return showErrors([UNREADABLE]);
    }
    const outcome = context.checkBackup(text);
    if (!outcome.ok) return showErrors(outcome.errors);
    confirm(outcome.backup, outcome.summary);
  });

  return h(
    "section",
    { "aria-labelledby": "backup-restore" },
    h("h2", { id: "backup-restore" }, "Backup wiederherstellen"),
    h(
      "p",
      null,
      "Wähle eine Backup-Datei aus. Du siehst dann, was sie enthält, und bestätigst das Ersetzen.",
    ),
    h("label", { for: "backup-file" }, "Backup-Datei auswählen"),
    file,
    errors,
    confirmation,
    status,
  );
}
