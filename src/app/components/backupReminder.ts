// Backup-Erinnerung über der Bibliotheksliste (TDD 6.6, 13.1, FR-31, AK-20, D-39): „Backup speichern“
// liefert direkt aus, „Später“ stellt um drei Tage zurück. Nie während einer Lernsitzung, weil nur die
// Bibliothek sie zeigt.
import type { Reminder } from "../../domain/backupReminder";
import type { Delivery } from "../../platform/deliverFile";
import type { PreparedBackup } from "../backup";
import { h } from "../dom";
import { failureMessage } from "../storageMessages";

export interface ReminderActions {
  prepareBackup: () => Promise<PreparedBackup>;
  /** Muss direkt im Klick aufgerufen werden, sonst öffnet sich das Teilen-Menü nicht. */
  saveBackup: (prepared: PreparedBackup) => Promise<Delivery>;
  snoozeReminder: () => Promise<void>;
}

const NOT_SAVED =
  "Das Backup konnte nicht gespeichert werden. Lade die Seite neu und versuche es noch einmal.";

function describe(daysSince: number | null): string {
  return daysSince === null
    ? "Du hast noch kein Backup gespeichert."
    : `Dein letztes Backup ist ${daysSince} Tage alt.`;
}

export function backupReminder(
  reminder: Extract<Reminder, { due: true }>,
  actions: ReminderActions,
): HTMLElement {
  let prepared: PreparedBackup | null = null;
  const text = h(
    "p",
    null,
    `${describe(reminder.daysSince)} Sichere deinen Lernstand, damit er nicht verloren geht.`,
  );
  const status = h("div", { "aria-live": "polite" });
  const problem = h("div", { role: "alert" });
  const save = h(
    "button",
    {
      type: "button",
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
    "Backup wird vorbereitet …",
  );
  const later = h(
    "button",
    {
      type: "button",
      class: "secondary",
      onclick: () => {
        hint.remove();
        void actions.snoozeReminder();
      },
    },
    "Später",
  );
  const buttons = h("div", { class: "actions" }, save, later);
  const hint = h("div", { class: "hint" }, text, buttons, status, problem);

  actions.prepareBackup().then(
    (backup) => {
      prepared = backup;
      save.textContent = "Backup speichern";
      save.disabled = false;
    },
    (error: unknown) => {
      console.error("Backup nicht vorbereitet", error);
      save.textContent = "Backup speichern";
      const message = failureMessage(error, "Das Backup konnte nicht vorbereitet werden.");
      problem.replaceChildren(h("p", null, message));
    },
  );
  return hint;
}
