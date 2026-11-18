// Backup speichern und wiederherstellen (TDD 11.3, 11.4, FR-19, FR-31): erklärt, wozu ein Backup dient,
// wohin man es speichert und wie man es zurückholt, und nennt Stand und Umfang. „Backup speichern“ ist
// die Hauptaktion unten. Vor dem Ersetzen vorhandener Daten nennt die Bestätigung deren Umfang und
// bietet an, sie vorher zu sichern.
import {
  type BackupSummary,
  type CheckedBackup,
  MAX_BACKUP_SIZE,
  type RecordCounts,
} from "../../domain/backup";
import type { Delivery } from "../../platform/deliverFile";
import type { CheckOutcome, PreparedBackup, RestoreOutcome } from "../backup";
import { frame } from "../components/frame";
import { focusSoon, h } from "../dom";
import { icon, type IconName } from "../icons";
import { failureMessage } from "../storageMessages";

export interface BackupContext {
  prepareBackup: () => Promise<PreparedBackup>;
  /** Muss direkt im Klick aufgerufen werden, sonst öffnet sich das Teilen-Menü nicht. */
  saveBackup: (prepared: PreparedBackup) => Promise<Delivery>;
  lastBackupAt: () => Promise<string | undefined>;
  /** Umfang der Daten auf diesem Gerät, für die Warnung vor dem Ersetzen. */
  localScope: () => Promise<RecordCounts>;
  checkBackup: (text: string) => CheckOutcome;
  restore: (backup: CheckedBackup) => Promise<RestoreOutcome>;
}

/** Ergebnis von „Backup speichern“, gleich ob oben oder in der Bestätigung ausgelöst. */
type SaveResult = "saved" | "cancelled" | "failed";

const SAVE_RESULT: Record<SaveResult, string> = {
  saved: "Backup gespeichert.",
  cancelled: "Backup nicht gespeichert.",
  failed: "",
};

/** So viele Fehler werden einzeln gezeigt. */
const SHOWN_ERRORS = 10;

const NOT_SAVED =
  "Das Backup konnte nicht gespeichert werden. Lade die Seite neu und versuche es noch einmal.";
const TOO_LARGE = "Die Datei ist zu groß für ein Backup des Vokabeltrainers.";
const UNREADABLE = "Die Datei konnte nicht gelesen werden. Wähle sie noch einmal aus.";
const LAST_UNKNOWN = "Wann zuletzt ein Backup gespeichert wurde, ließ sich nicht lesen.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

const dateTime = (iso: string) =>
  `${date(iso)}, ${new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;

/** Was im Backup steckt, als Kacheln wie in der Set-Ansicht (TDD 13.7). */
function summaryTiles(summary: BackupSummary): HTMLElement {
  const tile = (label: string, value: number) =>
    h("div", null, h("dt", null, label), h("dd", null, String(value)));
  return h(
    "dl",
    { class: "tiles" },
    tile(summary.sets === 1 ? "Vokabelset" : "Vokabelsets", summary.sets),
    tile(summary.events === 1 ? "Antwort" : "Antworten", summary.events),
    tile(summary.sessions === 1 ? "Lernsitzung" : "Lernsitzungen", summary.sessions),
  );
}

/** „Das steckt im Backup: …“ für die Statuskarte; Einstellungen gehören immer dazu. */
function describeContent(scope: RecordCounts): string {
  if (scope.sets === 0) return "Auf diesem Gerät sind noch keine Vokabelsets gespeichert.";
  const sets = count(scope.sets, "Vokabelset", "Vokabelsets");
  const answers = scope.events === 0 ? "" : `, ${count(scope.events, "Antwort", "Antworten")}`;
  return `Das steckt im Backup: ${sets}${answers} und deine Einstellungen.`;
}

/** Was beim Wiederherstellen verloren ginge (TDD 11.4, Schritt 4). */
function describeLocal(scope: RecordCounts | null): string {
  if (!scope) return "Das Backup ersetzt alle Daten auf diesem Gerät.";
  const content = `${count(scope.sets, "Set", "Sets")} mit ${count(scope.entries, "Eintrag", "Einträgen")}`;
  const progress =
    scope.sessions === 0
      ? ""
      : ` und dein Lernstand mit ${count(scope.events, "Antwort", "Antworten")} aus ${count(scope.sessions, "Lernsitzung", "Lernsitzungen")}`;
  return `Auf diesem Gerät gespeichert: ${content}${progress}. Das Backup ersetzt alles davon.`;
}

/** Wozu, wohin, wie zurück (TDD 11, FR-31), mit Symbol wie im Entwurf. */
function explanation(): Node {
  const point = (symbol: IconName, title: string, text: string) =>
    h(
      "div",
      null,
      h("span", { class: "ic" }, icon(symbol)),
      h("p", null, h("strong", null, title), " ", text),
    );
  return h(
    "div",
    { class: "why" },
    point(
      "phone",
      "Wozu?",
      "Wenn das Gerät kaputtgeht, du ein neues bekommst oder der Browser Daten löscht, holst du alles mit dem Backup zurück.",
    ),
    point(
      "cloud",
      "Wohin?",
      "Speichere die Datei dort, wo sie sicher ist: in „Dateien“, iCloud Drive, Google Drive oder schick sie dir selbst.",
    ),
    point(
      "restore",
      "Wie zurück?",
      "Auf dem neuen Gerät hier unter „Backup laden“ die Datei auswählen.",
    ),
  );
}

export function backupView(context: BackupContext): Node {
  const save = saveSection(context);
  return frame(
    { title: "Backup und Wiederherstellung", back: { parent: "#/" }, dock: [save.button] },
    h(
      "main",
      { class: "backup" },
      h(
        "div",
        { class: "intro" },
        h("p", { class: "display" }, "Deine Vokabeln sichern"),
        h(
          "p",
          { class: "lead" },
          "Ein Backup ist eine Datei mit allem, was in der App steckt: Vokabelsets, Lernstand und Einstellungen.",
        ),
      ),
      save.section,
      explanation(),
      // Nach dem Wiederherstellen gibt es einen neuen Bestand; das vorbereitete Backup wäre veraltet.
      restoreSection(context, save),
    ),
  ).element;
}

interface SaveSection {
  section: Node;
  /** „Backup speichern“ als Hauptaktion in der Aktionsleiste (TDD 13.7). */
  button: Node;
  /** Liest den Bestand neu ein, z. B. nach dem Wiederherstellen. */
  refresh: () => void;
  /** Speichert das vorbereitete Backup; direkt im Klick aufrufen (TDD 11.2). */
  saveNow: () => Promise<SaveResult>;
}

function saveSection(context: BackupContext): SaveSection {
  let prepared: PreparedBackup | null = null;
  const last = h("span");
  const dot = h("span", { class: "dot", "aria-hidden": "true" });
  const content = h("p", { class: "muted" });
  const status = h("div", { "aria-live": "polite" });
  const problem = h("div", { role: "alert" });

  /** Meldungen zeigt, wer speichern ließ, an seiner Stelle. */
  const saveNow = async (): Promise<SaveResult> => {
    if (!prepared) return "failed";
    try {
      const delivery = await context.saveBackup(prepared);
      void showLast();
      return delivery === "cancelled" ? "cancelled" : "saved";
    } catch (error) {
      console.error("Backup nicht gespeichert", error);
      return "failed";
    }
  };

  const save = h(
    "button",
    {
      type: "button",
      disabled: true,
      onclick: async () => {
        save.disabled = true;
        status.replaceChildren();
        problem.replaceChildren();
        const result = await saveNow();
        if (result === "failed") problem.replaceChildren(h("p", null, NOT_SAVED));
        else status.replaceChildren(h("p", null, SAVE_RESULT[result]));
        save.disabled = false;
      },
    },
    "Backup wird vorbereitet …",
  );

  const showLast = async () => {
    let at: string | undefined;
    try {
      at = await context.lastBackupAt();
    } catch (error) {
      console.error("Zeitpunkt des letzten Backups nicht lesbar", error);
      last.textContent = LAST_UNKNOWN;
      return;
    }
    last.textContent = at ? `Letztes Backup: ${dateTime(at)}` : "Noch kein Backup gespeichert.";
    // Grün mit Backup, rot ohne; der Satz sagt dasselbe (TDD 13.4).
    dot.classList.toggle("ok", !!at);
  };

  const showContent = async () => {
    try {
      content.textContent = describeContent(await context.localScope());
    } catch (error) {
      console.warn("Umfang der Daten nicht ermittelt", error);
      content.textContent = "";
    }
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
      const message = failureMessage(error, "Das Backup konnte nicht vorbereitet werden.");
      problem.replaceChildren(h("p", null, message));
    }
  };

  const refresh = () => {
    void showLast();
    void showContent();
    void prepare();
  };
  refresh();

  const section = h(
    "section",
    { class: "panel raised", "aria-labelledby": "backup-save" },
    h("h2", { id: "backup-save", class: "visually-hidden" }, "Backup speichern"),
    h("p", { class: "state" }, dot, last),
    content,
    status,
    problem,
  );
  return { section, button: save, refresh, saveNow };
}

/** Bestand auf diesem Gerät; `null`, wenn er sich nicht lesen ließ. */
interface Local {
  scope: RecordCounts | null;
  lastBackupAt: string | undefined;
}

async function readLocal(context: BackupContext): Promise<Local> {
  const [scope, lastBackupAt] = await Promise.all([
    context.localScope().catch((error: unknown) => {
      console.error("Umfang der Daten auf dem Gerät nicht ermittelt", error);
      return null;
    }),
    context.lastBackupAt().catch(() => undefined),
  ]);
  return { scope, lastBackupAt };
}

/**
 * Warnung vor dem Ersetzen vorhandener Daten mit dem Angebot, sie vorher zu sichern (TDD 11.4). Ist
 * der Umfang unbekannt, wird gewarnt, als wären Daten vorhanden.
 */
function replaceWarning(
  local: Local,
  save: SaveSection,
): { node: HTMLElement; saveFirst: HTMLButtonElement } {
  const last = h(
    "p",
    null,
    local.lastBackupAt
      ? `Dein letztes Backup: ${dateTime(local.lastBackupAt)}.`
      : "Auf diesem Gerät wurde noch kein Backup gespeichert.",
  );
  const status = h("div", { "aria-live": "polite" });
  const problem = h("div", { role: "alert" });
  const saveFirst = h(
    "button",
    {
      type: "button",
      class: "secondary",
      onclick: async () => {
        saveFirst.disabled = true;
        status.replaceChildren();
        problem.replaceChildren();
        const result = await save.saveNow();
        if (result === "failed") problem.replaceChildren(h("p", null, NOT_SAVED));
        else status.replaceChildren(h("p", null, SAVE_RESULT[result]));
        if (result === "saved") last.remove();
        saveFirst.disabled = false;
      },
    },
    "Vorher Backup speichern",
  );
  const node = h(
    "div",
    { class: "warning" },
    h("p", null, describeLocal(local.scope)),
    last,
    saveFirst,
    status,
    problem,
  );
  return { node, saveFirst };
}

function restoreSection(context: BackupContext, save: SaveSection): Node {
  const file = h("input", {
    id: "backup-file",
    type: "file",
    class: "file-input",
    // Wie beim Import; iOS und iPadOS lassen .json-Dateien damit auswählbar (S-11, O-08).
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

  const confirm = (backup: CheckedBackup, summary: BackupSummary, local: Local) => {
    const text = h("p", { class: "title" }, `Backup vom ${date(summary.exportedAt)}`);
    // Sitzungen und Antworten gibt es nur zu Sets (D-25); Einstellungen allein gehen nicht verloren.
    const hasData = local.scope === null || local.scope.sets > 0;
    const warning = hasData && replaceWarning(local, save);
    const replace = h(
      "button",
      {
        type: "button",
        class: hasData ? "danger" : null,
        onclick: async () => {
          replace.disabled = true;
          cancel.disabled = true;
          file.disabled = true;
          if (warning) warning.saveFirst.disabled = true;
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
          focusSoon(done);
          save.refresh();
        },
      },
      hasData ? "Alle Daten ersetzen" : "Wiederherstellen",
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
        summaryTiles(summary),
        h(
          "p",
          { class: "muted" },
          "Dazu deine Einstellungen, zum Beispiel die Darstellung und wie du jedes Set zuletzt gelernt hast.",
        ),
        warning
          ? warning.node
          : h(
              "p",
              { class: "muted" },
              "Auf diesem Gerät ist noch nichts gespeichert. Danach ist alles so wie auf dem anderen Gerät.",
            ),
        h("div", { class: "actions" }, cancel, replace),
      ),
    );
    focusSoon(text);
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
    confirm(outcome.backup, outcome.summary, await readLocal(context));
  });

  return h(
    "section",
    { class: "panel", "aria-labelledby": "backup-restore" },
    h("h2", { id: "backup-restore" }, "Backup laden"),
    h(
      "p",
      { class: "warn" },
      "Ein Backup ersetzt alles, was jetzt in der App ist. Vorher siehst du, was drin ist.",
    ),
    // Die Beschriftung sieht aus wie eine Schaltfläche, das Feld liegt unsichtbar darüber (TDD 13.4).
    h(
      "div",
      { class: "file-pick" },
      file,
      h(
        "label",
        { for: "backup-file", class: "file-button" },
        icon("file"),
        h("span", null, "Backup-Datei auswählen"),
      ),
    ),
    errors,
    confirmation,
    status,
  );
}
