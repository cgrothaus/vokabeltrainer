import type { Reminder } from "../../domain/backupReminder";
import type { StoredSet } from "../../domain/model";
import { groupSets, setSize } from "../../domain/library";
import type { ProtectionNotice } from "../../domain/storageProtection";
import { backupReminder, type ReminderActions } from "../components/backupReminder";
import { learnButton } from "../components/learnButton";
import { protectionHint } from "../components/protectionHint";
import { h } from "../dom";
import { languageName } from "../languages";
import type { SampleOutcome } from "../sampleSet";
import { failureMessage } from "../storageMessages";
import { emptyLibrary } from "./emptyLibrary";

export interface LibraryContext extends ReminderActions {
  /** Welcher Speicherschutz-Hinweis passt (TDD 6.6); hängt davon ab, ob Sets vorhanden sind. */
  protection: (hasSets: boolean) => ProtectionNotice;
  /** Ob die Backup-Erinnerung fällig ist (TDD 6.6). */
  loadReminder: () => Promise<Reminder>;
  loadSets: () => Promise<StoredSet[]>;
  /** Speichert das Beispielset (Empty State); bei Erfolg wechselt die App zur Set-Ansicht. */
  loadSampleSet: () => Promise<SampleOutcome>;
  /** Meldung aus dem vorigen Schritt, z. B. nach Import oder Löschen; wird beim Abholen geleert. */
  takeMessage: () => string | null;
}

export function libraryView(context: LibraryContext): Node {
  // Hinweise über der Liste (TDD 13.1); sie hängen vom Bestand ab und erscheinen nach dem Laden.
  const hints = h("div", { class: "hints", "aria-busy": "true" });
  const sets = h("section", { "aria-label": "Vokabelsets" });
  // Erst nach dem Laden zeigen: Bei leerer Bibliothek bietet der Empty State dieselben Wege an.
  const more = h(
    "div",
    { hidden: true },
    h("p", null, h("a", { href: "#/import", class: "action" }, "Vokabelset importieren")),
    h("p", null, h("a", { href: "#/new-set", class: "action secondary" }, "Leeres Set anlegen")),
    h("p", null, h("a", { href: "#/help" }, "Wie bekomme ich ein Vokabelset?")),
  );
  void showSets(sets, context).then(async (empty) => {
    more.hidden = empty;
    hints.replaceChildren(...(await showHints(context, empty)));
    hints.removeAttribute("aria-busy");
  });
  const text = context.takeMessage();
  const message = text && h("p", { role: "status", class: "message", tabindex: "-1" }, text);
  // Fokus auf die Meldung, sobald die Ansicht eingehängt ist, damit Screenreader sie vorlesen.
  if (message) queueMicrotask(() => message.isConnected && message.focus());
  return h(
    "main",
    null,
    h("h1", null, "Vokabeltrainer"),
    message,
    hints,
    sets,
    more,
    h("p", null, h("a", { href: "#/backup" }, "Backup und Wiederherstellung")),
    h("p", null, h("a", { href: "#/settings" }, "Einstellungen")),
  );
}

/**
 * Backup-Erinnerung und Speicherschutz-Hinweis (TDD 6.6). Ohne Sets gibt es keine Antworten (D-25),
 * also keine Erinnerung; neben ihr wäre der Hinweis auf Backups doppelt.
 */
async function showHints(context: LibraryContext, empty: boolean): Promise<Node[]> {
  let reminder: Reminder = { due: false };
  if (!empty)
    reminder = await context.loadReminder().catch((error: unknown) => {
      console.warn("Backup-Erinnerung nicht geprüft", error);
      return { due: false } as const;
    });
  const notice = context.protection(!empty);
  const protection = reminder.due && notice === "backup" ? null : protectionHint(notice, !empty);
  return [reminder.due ? backupReminder(reminder, context) : null, protection].filter(
    (node): node is Node => node !== null,
  );
}

/** Liefert `true`, wenn die Bibliothek leer ist und der Empty State erscheint. */
async function showSets(container: HTMLElement, context: LibraryContext): Promise<boolean> {
  let sets: StoredSet[];
  try {
    sets = await context.loadSets();
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    const message = failureMessage(error, "Die Vokabelsets konnten nicht geladen werden.");
    container.replaceChildren(h("p", { role: "alert" }, message));
    return false;
  }
  // Ergibt sich aus dem Bestand, erscheint also auch nach dem Löschen des letzten Sets (TDD 13.1).
  if (sets.length === 0) {
    container.replaceChildren(emptyLibrary(context.loadSampleSet));
    return true;
  }
  container.replaceChildren(
    ...groupSets(sets, languageName)
      .map((group) => [
        h("h2", { class: "group" }, group.name),
        h(
          "ul",
          { class: "sets" },
          group.sets.map((set) => {
            const { entries } = setSize(set);
            const count = entries === 1 ? "1 Eintrag" : `${entries} Einträge`;
            return h(
              "li",
              null,
              h(
                "div",
                null,
                h("a", { href: `#/set/${encodeURIComponent(set.id)}`, class: "title" }, set.title),
                " ",
                h("span", { class: "count" }, set.level ? `${set.level} · ${count}` : count),
              ),
              entries > 0 && learnButton(set),
            );
          }),
        ),
      ])
      .flat(),
  );
  return false;
}
