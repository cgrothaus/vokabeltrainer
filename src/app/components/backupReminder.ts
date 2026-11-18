// Backup-Erinnerung als ruhige Zeile unter der Bibliotheksliste (TDD 6.6, 13.1, FR-31, AK-20, D-39,
// D-46): „Sichern“ liefert direkt aus, „Später“ stellt um drei Tage zurück. Nie während einer
// Lernsitzung, weil nur die Bibliothek sie zeigt.
import type { Reminder } from "../../domain/backupReminder";
import type { Delivery } from "../../platform/deliverFile";
import type { PreparedBackup } from "../backup";
import { h } from "../dom";
import { icon } from "../icons";
import { failureMessage } from "../storageMessages";

export interface ReminderActions {
  prepareBackup: () => Promise<PreparedBackup>;
  /** Muss direkt im Klick aufgerufen werden, sonst öffnet sich das Teilen-Menü nicht. */
  saveBackup: (prepared: PreparedBackup) => Promise<Delivery>;
  snoozeReminder: () => Promise<void>;
}

const NOT_SAVED =
  "Das Backup konnte nicht gespeichert werden. Lade die Seite neu und versuche es noch einmal.";

type DueReminder = Extract<Reminder, { due: true }>;

/** Der Satz nennt, warum es Zeit ist (D-46). */
export function describeReminder(reminder: DueReminder): string {
  if (reminder.daysSince !== null) return `Dein letztes Backup ist ${reminder.daysSince} Tage alt.`;
  if (reminder.learningDays >= 3)
    return `An ${reminder.learningDays} Tagen gelernt und noch nicht gesichert.`;
  const since = new Date(reminder.firstUnsavedAt).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });
  return `Dein Lernstand seit dem ${since} ist noch nicht gesichert.`;
}

export function backupReminder(reminder: DueReminder, actions: ReminderActions): HTMLElement {
  let prepared: PreparedBackup | null = null;
  const text = h("p", null, describeReminder(reminder));
  const status = h("div", { "aria-live": "polite" });
  const problem = h("div", { role: "alert" });
  const save = h(
    "button",
    {
      type: "button",
      class: "textbtn",
      // Gesperrt, bis das Backup vorbereitet ist (TDD 11.2).
      disabled: true,
      onclick: async () => {
        if (!prepared) return;
        save.disabled = later.disabled = true;
        status.replaceChildren();
        problem.replaceChildren();
        let delivery: Delivery;
        try {
          delivery = await actions.saveBackup(prepared);
        } catch (error) {
          console.error("Backup nicht gespeichert", error);
          problem.replaceChildren(h("p", null, NOT_SAVED));
          save.disabled = later.disabled = false;
          return;
        }
        if (delivery === "cancelled") {
          status.replaceChildren(h("p", null, "Backup nicht gespeichert."));
          save.disabled = later.disabled = false;
          return;
        }
        // Die Erinnerung ist erledigt; die Meldung bleibt im Live-Bereich stehen.
        text.remove();
        buttons.remove();
        status.replaceChildren(h("p", null, "Backup gespeichert."));
      },
    },
    "Sichern",
  );
  const later = h(
    "button",
    {
      type: "button",
      class: "textbtn",
      onclick: () => {
        hint.remove();
        void actions.snoozeReminder();
      },
    },
    "Später",
  );
  const buttons = h("div", { class: "quiet-actions" }, save, later);
  const hint = h(
    "div",
    { class: "quiet reminder" },
    icon("cloud"),
    h("div", { class: "quiet-text" }, text, status, problem),
    buttons,
  );

  actions.prepareBackup().then(
    (backup) => {
      prepared = backup;
      save.disabled = false;
    },
    (error: unknown) => {
      console.error("Backup nicht vorbereitet", error);
      const message = failureMessage(error, "Das Backup konnte nicht vorbereitet werden.");
      problem.replaceChildren(h("p", null, message));
    },
  );
  return hint;
}
