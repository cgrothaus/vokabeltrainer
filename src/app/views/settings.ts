// Einstellungen (TDD 3.2, 10, 13.5, FR-21, FR-25): Darstellung, Weg zum Backup, alle Daten löschen und
// die App-Version.
import type { RecordCounts } from "../../domain/backup";
import type { Theme } from "../../domain/theme";
import type { DeleteAllOutcome } from "../deleteAll";
import { h } from "../dom";
import type { SaveThemeOutcome } from "../theme";

export interface SettingsContext {
  theme: Theme;
  /** Wendet die Darstellung sofort an und speichert sie danach. */
  chooseTheme: (theme: Theme) => Promise<SaveThemeOutcome>;
  dataScope: () => Promise<RecordCounts>;
  removeAllData: () => Promise<DeleteAllOutcome>;
  /** Nach dem Löschen; die App wechselt zur Bibliothek und zeigt dort die Meldung. */
  onRemoved: (message: string) => void;
  appVersion: string;
}

const THEMES: [Theme, string][] = [
  ["system", "Wie auf dem Gerät"],
  ["light", "Hell"],
  ["dark", "Dunkel"],
];

const NO_SCOPE =
  "Der Umfang deiner Daten konnte nicht ermittelt werden. Lade die Seite neu und versuche es noch einmal.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Fokus setzen, sobald das Element eingehängt ist; Screenreader lesen es dann vor. */
function focus(element: HTMLElement): void {
  element.tabIndex = -1;
  if (element.isConnected) element.focus();
  else queueMicrotask(() => element.isConnected && element.focus());
}

export function settingsView(context: SettingsContext): Node {
  const heading = h("h1", null, "Einstellungen");
  focus(heading);
  return h(
    "main",
    { class: "settings" },
    heading,
    themeChoice(context),
    h(
      "section",
      { "aria-labelledby": "settings-data" },
      h("h2", { id: "settings-data" }, "Daten"),
      h("p", null, h("a", { href: "#/backup" }, "Backup und Wiederherstellung")),
      deletion(context),
    ),
    h(
      "section",
      { "aria-labelledby": "settings-about" },
      h("h2", { id: "settings-about" }, "Über die App"),
      h("p", null, `Version ${context.appVersion}`),
    ),
    h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek")),
  );
}

function themeChoice(context: SettingsContext): Node {
  const status = h("p", { "aria-live": "polite" });
  return h(
    "fieldset",
    null,
    h("legend", null, "Darstellung"),
    h(
      "div",
      { class: "choices" },
      THEMES.map(([value, label]) =>
        h(
          "label",
          null,
          h("input", {
            type: "radio",
            name: "theme",
            value,
            checked: value === context.theme,
            onchange: async () => {
              status.textContent = "";
              const outcome = await context.chooseTheme(value);
              if (!outcome.ok) status.textContent = outcome.error;
            },
          }),
          label,
        ),
      ),
    ),
    status,
  );
}

function describeScope(scope: RecordCounts): string {
  if (scope.sets === 0)
    return "Es sind keine Vokabelsets gespeichert. Gelöscht werden nur deine Einstellungen.";
  const content = `Gelöscht werden ${count(scope.sets, "Set", "Sets")} mit ${count(scope.entries, "Eintrag", "Einträgen")}`;
  const progress =
    scope.sessions === 0
      ? ""
      : ` und dein Lernstand: ${count(scope.events, "Antwort", "Antworten")} aus ${count(scope.sessions, "Lernsitzung", "Lernsitzungen")}`;
  return `${content}${progress}. Deine Einstellungen werden zurückgesetzt.`;
}

/** Die Schaltfläche nennt die Folge (TDD 13.3). */
function consequence(scope: RecordCounts): string {
  if (scope.sets === 0) return "Einstellungen zurücksetzen";
  const sets = count(scope.sets, "Set", "Sets");
  return scope.sessions === 0 ? `${sets} löschen` : `${sets} und Lernstand löschen`;
}

/** Löschen mit Ankündigung des Umfangs wie beim Set (TDD 10, FR-06). */
function deletion(context: SettingsContext): Node {
  const confirmation = h("div");
  const errors = h("div", { role: "alert" });
  const start = h(
    "button",
    {
      type: "button",
      class: "secondary",
      onclick: async () => {
        start.disabled = true;
        errors.replaceChildren();
        let scope: RecordCounts;
        try {
          scope = await context.dataScope();
        } catch (error) {
          console.error("Umfang nicht ermittelt", error);
          errors.textContent = NO_SCOPE;
          start.disabled = false;
          return;
        }
        confirm(scope);
      },
    },
    "Alle Daten löschen",
  );

  const cancel = () => {
    confirmation.replaceChildren();
    start.disabled = false;
    start.focus();
  };

  const confirm = (scope: RecordCounts) => {
    const text = h("p", null, describeScope(scope));
    const remove = h(
      "button",
      {
        type: "button",
        onclick: async () => {
          remove.disabled = abort.disabled = true;
          let outcome: DeleteAllOutcome;
          try {
            outcome = await context.removeAllData();
          } catch (error) {
            console.error("Daten nicht gelöscht", error);
            outcome = { ok: false, error: "Die Daten konnten nicht gelöscht werden." };
          }
          if (outcome.ok) return context.onRemoved("Alle Daten gelöscht.");
          confirmation.replaceChildren();
          errors.textContent = outcome.error;
          start.disabled = false;
        },
      },
      consequence(scope),
    );
    const abort = h("button", { type: "button", class: "secondary", onclick: cancel }, "Abbrechen");
    confirmation.replaceChildren(
      h(
        "div",
        { class: "confirm" },
        text,
        h(
          "p",
          null,
          "Das lässt sich nicht rückgängig machen. ",
          h("a", { href: "#/backup" }, "Vorher ein Backup speichern"),
        ),
        h("div", { class: "actions" }, remove, abort),
      ),
    );
    focus(text);
  };

  return h("div", null, start, confirmation, errors);
}
