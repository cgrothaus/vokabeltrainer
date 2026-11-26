// Einstellungen (TDD 3.2, 10, 13.5, 13.6, FR-21, FR-25, FR-35, FR-40): Darstellung als Segmentschalter,
// „Automatisch vorlesen“, wenn das Gerät eine Stimme für eine Lernsprache hat, Stand des Speicherschutzes mit „Als App installieren“ bzw. dem Weg zum Home-Bildschirm, Backup, alle Daten
// löschen und die App-Version.
import type { RecordCounts } from "../../domain/backup";
import type { PersistenceState } from "../../domain/storageProtection";
import type { Theme } from "../../domain/theme";
import { frame } from "../components/frame";
import { type IosDevice, openHomeScreenSheet } from "../components/homeScreen";
import { openSheet } from "../components/sheet";
import type { DeleteAllOutcome } from "../deleteAll";
import { focusSoon, h } from "../dom";
import { icon } from "../icons";
import type { SaveSpeakAloudOutcome } from "../speech";
import type { SaveThemeOutcome } from "../theme";

export interface SettingsContext {
  theme: Theme;
  /** Wendet die Darstellung sofort an und speichert sie danach. */
  chooseTheme: (theme: Theme) => Promise<SaveThemeOutcome>;
  speakAloud: boolean;
  /** Gilt sofort und wird danach gespeichert (TDD 12.11). */
  chooseSpeakAloud: (on: boolean) => Promise<SaveSpeakAloudOutcome>;
  /** Ob das Gerät für eine Lernsprache der Bibliothek eine Stimme hat. */
  hasVoice: () => Promise<boolean>;
  dataScope: () => Promise<RecordCounts>;
  removeAllData: () => Promise<DeleteAllOutcome>;
  /** Nach dem Löschen; die App wechselt zur Bibliothek und zeigt dort die Meldung. */
  onRemoved: (message: string) => void;
  appVersion: string;
  persistence: PersistenceState;
  /** Auf iOS im Browser: Gerät für den Weg zum Home-Bildschirm (TDD 6.6), sonst `null`. */
  homeScreen: IosDevice | null;
  hasSets: () => Promise<boolean>;
  canInstall: () => boolean;
  /** Zeigt die Rückfrage des Browsers; direkt im Klick aufrufen (TDD 5.1). */
  install: () => void;
  onInstallChange: (listener: () => void, signal: AbortSignal) => void;
}

/** Stand des Speicherschutzes (TDD 6.6, 13.6); Hinweise dazu stehen in der Bibliothek. */
const PERSISTENCE_TEXT: Record<PersistenceState, string> = {
  granted: "Deine Daten sind auf diesem Gerät dauerhaft geschützt.",
  "not-granted": "Deine Daten sind auf diesem Gerät nicht dauerhaft geschützt.",
  unsupported: "Dieser Browser kann deine Daten nicht dauerhaft schützen.",
};

const THEMES: [Theme, string][] = [
  ["system", "Wie auf dem Gerät"],
  ["light", "Hell"],
  ["dark", "Dunkel"],
];

const NO_SCOPE =
  "Der Umfang deiner Daten konnte nicht ermittelt werden. Lade die Seite neu und versuche es noch einmal.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function settingsView(context: SettingsContext, signal: AbortSignal): Node {
  const main = h("main", { class: "settings" });
  const page = frame({ back: { parent: "#/" } }, main);
  focusSoon(page.setTitle("Einstellungen"));
  main.append(
    themeChoice(context),
    learning(context),
    h(
      "section",
      { "aria-labelledby": "settings-data" },
      h("h2", { id: "settings-data" }, "Deine Daten"),
      protection(context, page.element, signal),
      h(
        "ul",
        { class: "rows" },
        h(
          "li",
          null,
          h(
            "a",
            { href: "#/backup" },
            icon("shield"),
            h("span", null, "Backup und Wiederherstellung"),
            icon("chevron"),
          ),
        ),
        h("li", null, deletion(context, page.element)),
      ),
    ),
    h(
      "section",
      { "aria-labelledby": "settings-about" },
      h("h2", { id: "settings-about" }, "Über die App"),
      h(
        "ul",
        { class: "rows" },
        h(
          "li",
          null,
          h(
            "a",
            { href: "#/help/learning" },
            icon("help"),
            h("span", null, "Wie lerne ich mit dem Plan?"),
            icon("chevron"),
          ),
        ),
        h(
          "li",
          null,
          h(
            "a",
            { href: "#/help/about" },
            icon("info"),
            h("span", null, "Über den Vokabeltrainer"),
            icon("chevron"),
          ),
        ),
      ),
      h("p", null, `Version ${context.appVersion}`),
    ),
  );
  return page.element;
}

/** Stand des Speicherschutzes als Karte mit Punkt und Satz, dazu der Weg, ihn zu verbessern. */
function protection(context: SettingsContext, within: Element, signal: AbortSignal): Node {
  const granted = context.persistence === "granted";
  const action = h("div", { class: "panel-actions" });
  const showAction = () => {
    // Installieren ist Komfort, auch bei gewährtem Speicher (TDD 5.1); der Home-Bildschirm schützt.
    if (context.canInstall())
      return action.replaceChildren(
        h("button", { type: "button", onclick: context.install }, "Als App installieren"),
      );
    if (granted || !context.homeScreen) return action.replaceChildren();
    const device = context.homeScreen;
    const open: HTMLButtonElement = h(
      "button",
      {
        type: "button",
        onclick: async () => {
          const hasSets = await context.hasSets().catch(() => true);
          openHomeScreenSheet(within, { device, hasSets, returnTo: open });
        },
      },
      "Auf den Home-Bildschirm",
    );
    action.replaceChildren(open);
  };
  showAction();
  context.onInstallChange(showAction, signal);
  return h(
    "div",
    { class: "panel" },
    h(
      "p",
      { class: "state" },
      h("span", { class: granted ? "dot ok" : "dot", "aria-hidden": "true" }),
      h("span", null, PERSISTENCE_TEXT[context.persistence]),
    ),
    h(
      "p",
      { class: "muted" },
      granted
        ? "Dein Gerät löscht die Vokabeln nicht von selbst."
        : "Der Browser kann die Vokabeln löschen, wenn du länger nicht lernst. Ein Backup schützt sie.",
    ),
    action,
  );
}

/** Abschnitt „Lernen“ (TDD 13.6, D-61): erscheint nur, wenn es eine passende Stimme gibt. */
function learning(context: SettingsContext): Node {
  const status = h("p", { "aria-live": "polite" });
  const section = h(
    "section",
    { "aria-labelledby": "settings-learning", hidden: true },
    h("h2", { id: "settings-learning" }, "Lernen"),
    h(
      "label",
      { class: "switch-row" },
      h(
        "span",
        null,
        h("span", { class: "label" }, "Automatisch vorlesen"),
        h(
          "span",
          { class: "muted" },
          "Liest Wörter der Lernsprache in der Lernsitzung vor, sobald sie erscheinen.",
        ),
      ),
      h("input", {
        type: "checkbox",
        role: "switch",
        checked: context.speakAloud,
        onchange: async (event: Event) => {
          status.textContent = "";
          const outcome = await context.chooseSpeakAloud(
            (event.target as HTMLInputElement).checked,
          );
          if (!outcome.ok) status.textContent = outcome.error;
        },
      }),
    ),
    status,
  );
  void context.hasVoice().then(
    (found) => (section.hidden = !found),
    (error: unknown) => console.warn("Stimmen nicht geprüft", error),
  );
  return section;
}

function themeChoice(context: SettingsContext): Node {
  const status = h("p", { "aria-live": "polite" });
  return h(
    "fieldset",
    null,
    h("legend", null, "Darstellung"),
    h(
      "div",
      { class: "seg" },
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
          h("span", null, label),
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

/** Löschen mit Rückfrage im Blatt und Umfang wie beim Set (TDD 10, 13.7, FR-06). */
function deletion(context: SettingsContext, within: Element): Node[] {
  const errors = h("div", { role: "alert" });
  const start = h(
    "button",
    {
      type: "button",
      class: "destructive",
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
    icon("trash"),
    h("span", null, "Alle Daten löschen"),
  );

  const confirm = (scope: RecordCounts) => {
    const remove = h(
      "button",
      {
        type: "button",
        class: "danger",
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
          sheet.close();
          errors.textContent = outcome.error;
          start.disabled = false;
        },
      },
      consequence(scope),
    );
    const abort = h(
      "button",
      { type: "button", class: "secondary", onclick: () => sheet.dismiss() },
      "Abbrechen",
    );
    const text = h("p", null, describeScope(scope));
    const sheet = openSheet(within, {
      title: "Alle Daten löschen?",
      focus: text,
      content: [
        text,
        h(
          "p",
          null,
          "Das lässt sich nicht rückgängig machen. ",
          h("a", { href: "#/backup" }, "Vorher ein Backup speichern"),
        ),
        h("div", { class: "actions" }, abort, remove),
      ],
      returnTo: start,
      onDismiss: () => (start.disabled = false),
    });
  };

  return [start, errors];
}
