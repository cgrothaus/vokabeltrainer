// Bibliothek (TDD 13.1, FR-02, FR-11): Sets als Karten nach Lernsprache, je mit Lernstand und
// Lernen-Knopf (Schnellstart, 12.1), unten „Weiterlernen“ mit dem zuletzt gelernten Set. Der Lernstand
// wird nachgeladen, ein Set nach dem anderen, das zuletzt gelernte zuerst (12.6, D-50).
import type { Reminder } from "../../domain/backupReminder";
import type { StoredSet } from "../../domain/model";
import { groupSets, setSize } from "../../domain/library";
import type { SetStats } from "../../domain/stats";
import { installOffer, type ProtectionNotice } from "../../domain/storageProtection";
import { backupReminder, type ReminderActions } from "../components/backupReminder";
import { type Frame, frame, iconLink } from "../components/frame";
import type { IosDevice } from "../components/homeScreen";
import { libraryStatus } from "../components/learningStatus";
import { protectionHint, quietRow } from "../components/protectionHint";
import { focusSoon, h } from "../dom";
import { icon, type IconName } from "../icons";
import { languageName } from "../languages";
import type { LibraryStart } from "../library";
import type { SampleOutcome } from "../sampleSet";
import { failureMessage } from "../storageMessages";
import { emptyLibrary } from "./emptyLibrary";

export interface InstallActions {
  /** Ob der Browser die Installation gerade anbietet (TDD 5.1). */
  canInstall: () => boolean;
  /** Zeigt die Rückfrage des Browsers; direkt im Klick aufrufen. */
  install: () => void;
  /** Meldet, wenn das Angebot kommt oder entfällt. */
  onInstallChange: (listener: () => void, signal: AbortSignal) => void;
}

export interface LibraryContext extends ReminderActions, InstallActions {
  /** Welcher Speicherschutz-Hinweis passt (TDD 6.6); hängt davon ab, ob Sets vorhanden sind. */
  protection: (hasSets: boolean) => ProtectionNotice;
  /** iPhone oder iPad, für die Hinweise auf iOS. */
  device: IosDevice;
  /** Ob „Später“ beim Installationsangebot schon gewählt wurde (TDD 5.1). */
  installOfferDismissed: () => Promise<boolean>;
  dismissInstallOffer: () => Promise<void>;
  /** Ob die Backup-Erinnerung fällig ist (TDD 6.6). */
  loadReminder: () => Promise<Reminder>;
  loadSets: () => Promise<StoredSet[]>;
  /** Reihenfolge des Nachladens und „Weiterlernen“, ohne Antworten zu lesen (TDD 12.6). */
  loadStart: (sets: StoredSet[]) => Promise<LibraryStart>;
  loadOverview: (set: StoredSet) => Promise<SetStats>;
  /** Schnellstart (TDD 12.1): startet mit der gemerkten Einrichtung oder öffnet die Einrichtung. */
  startLearning: (set: StoredSet) => Promise<void>;
  /** Speichert das Beispielset (Empty State); bei Erfolg wechselt die App zur Set-Ansicht. */
  loadSampleSet: () => Promise<SampleOutcome>;
  /** Meldung aus dem vorigen Schritt, z. B. nach Import oder Löschen; wird beim Abholen geleert. */
  takeMessage: () => string | null;
}

const NOT_STARTED = "Die Lernsitzung wurde nicht gestartet.";
const NO_STATUS = "Lernstand nicht verfügbar";

const vocabulary = (n: number) => (n === 1 ? "1 Vokabel" : `${n} Vokabeln`);

export function libraryView(context: LibraryContext, signal: AbortSignal): Node {
  // Hinweise über der Liste (TDD 13.1); sie hängen vom Bestand ab und erscheinen nach dem Laden. Die
  // Backup-Erinnerung steht unter der Liste (D-46); bis beides geprüft ist, gilt der Bereich als beschäftigt.
  const hints = h("div", { class: "hints", "aria-busy": "true" });
  const reminderSlot = h("div", { class: "reminder-slot" });
  const sets = h("section", { "aria-label": "Vokabelsets" });
  // Begrüßung und Wege unter der Liste erst nach dem Laden: Der Empty State hat eigene (TDD 13.1).
  const greeting = h(
    "div",
    { class: "greeting", hidden: true },
    h("p", { class: "display" }, "Was lernst du heute?"),
    h("p", { class: "lead" }, "Deine Vokabeln bleiben auf diesem Gerät. Kein Konto, keine Cloud."),
  );
  const more = h(
    "div",
    { class: "more", hidden: true },
    h(
      "a",
      { href: "#/import", class: "addcard" },
      icon("plus"),
      h("span", null, "Vokabelset hinzufügen"),
    ),
    reminderSlot,
    h(
      "ul",
      { class: "rows" },
      // „Leeres Set anlegen“ zieht mit S-44 in die Ansicht „Hinzufügen“ um (D-50).
      row("#/new-set", "edit", "Leeres Set anlegen"),
      row("#/help", "help", "Wie bekomme ich ein Vokabelset?"),
      row("#/backup", "shield", "Backup und Wiederherstellung"),
    ),
  );
  // Scheitert der Schnellstart, steht die Meldung oben und bekommt den Fokus.
  const problem = h("p", { role: "alert", class: "problem" });
  const text = context.takeMessage();
  const message = text && h("p", { role: "status", class: "message", tabindex: "-1" }, text);
  // Fokus auf die Meldung, sobald die Ansicht eingehängt ist, damit Screenreader sie vorlesen.
  if (message) queueMicrotask(() => message.isConnected && message.focus());

  const page = frame(
    {
      title: "Vokabeltrainer",
      actions: [iconLink("#/settings", "Einstellungen", "gear")],
    },
    h("main", { class: "library" }, message, problem, greeting, hints, sets, more),
  );

  const learn = async (set: StoredSet, button: HTMLButtonElement) => {
    button.disabled = true;
    problem.replaceChildren();
    try {
      await context.startLearning(set);
    } catch (error) {
      console.error("Lernsitzung nicht gestartet", error);
      problem.textContent = failureMessage(error, NOT_STARTED);
      focusSoon(problem);
    } finally {
      button.disabled = false;
    }
  };

  const lines = new Map<string, HTMLElement>();
  void showSets(sets, context, learn, lines).then(async (loaded) => {
    const empty = loaded?.length === 0;
    greeting.hidden = more.hidden = !loaded || empty;
    if (loaded && !empty) void showProgress(loaded, context, lines, page, learn, signal);
    const reminder = await loadReminder(context, empty);
    const state = {
      empty,
      reminderDue: reminder.due,
      dismissed: await context.installOfferDismissed(),
      within: page.element,
    };
    const showAbove = () => hints.replaceChildren(...aboveHints(context, state));
    showAbove();
    // Das Angebot des Browsers kann nach dem ersten Aufbau kommen und entfällt nach der Installation.
    context.onInstallChange(showAbove, signal);
    if (reminder.due) reminderSlot.replaceChildren(backupReminder(reminder, context));
    hints.removeAttribute("aria-busy");
  });
  return page.element;
}

/** Zeile mit Symbol und Pfeil zur Navigation (TDD 13.7). */
function row(href: string, symbol: IconName, label: string): Node {
  return h("li", null, h("a", { href }, icon(symbol), h("span", null, label), icon("chevron")));
}

/** Ohne Sets gibt es keine Antworten (D-25), also keine Erinnerung. */
async function loadReminder(context: LibraryContext, empty: boolean): Promise<Reminder> {
  if (empty) return { due: false };
  return context.loadReminder().catch((error: unknown) => {
    console.warn("Backup-Erinnerung nicht geprüft", error);
    return { due: false } as const;
  });
}

/**
 * Speicherschutz-Hinweis und einmal das Installationsangebot über der Liste (TDD 5.1, 6.6). Neben der
 * Backup-Erinnerung wäre der Hinweis auf Backups doppelt (D-39).
 */
function aboveHints(
  context: LibraryContext,
  state: { empty: boolean; reminderDue: boolean; dismissed: boolean; within: Element },
): Node[] {
  const hasSets = !state.empty;
  const notice = context.protection(hasSets);
  const install = context.canInstall() ? context.install : undefined;
  const protection =
    state.reminderDue && notice === "backup" && !install
      ? null
      : protectionHint(notice, { hasSets, device: context.device, within: state.within, install });
  const offer =
    installOffer({ canInstall: !!install, hasSets, dismissed: state.dismissed, notice }) &&
    installRow(context, state);
  return [protection, offer].filter((node): node is Node => !!node);
}

/** Einmal die ruhige Zeile „Als App installieren?“ mit „Später“ (TDD 5.1, FR-35). */
function installRow(context: LibraryContext, state: { dismissed: boolean }): Node {
  const later = h(
    "button",
    {
      type: "button",
      class: "textbtn",
      onclick: () => {
        // Auch beim Neuzeichnen nach einer Meldung des Browsers bleibt sie weg.
        state.dismissed = true;
        row.remove();
        void context.dismissInstallOffer();
      },
    },
    "Später",
  );
  const row = quietRow(
    "phone",
    "Als App installieren? Deine Vokabeln kommen mit.",
    h("button", { type: "button", class: "textbtn", onclick: context.install }, "Installieren"),
    later,
  );
  return row;
}

type Learn = (set: StoredSet, button: HTMLButtonElement) => Promise<void>;

/** Liefert die Sets, bei leerer Bibliothek `[]` (Empty State), `null`, wenn sie nicht lesbar sind. */
async function showSets(
  container: HTMLElement,
  context: LibraryContext,
  learn: Learn,
  lines: Map<string, HTMLElement>,
): Promise<StoredSet[] | null> {
  let sets: StoredSet[];
  try {
    sets = await context.loadSets();
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    const message = failureMessage(error, "Die Vokabelsets konnten nicht geladen werden.");
    container.replaceChildren(h("p", { role: "alert" }, message));
    return null;
  }
  // Ergibt sich aus dem Bestand, erscheint also auch nach dem Löschen des letzten Sets (TDD 13.1).
  if (sets.length === 0) {
    container.replaceChildren(emptyLibrary(context.loadSampleSet));
    return sets;
  }
  container.replaceChildren(
    ...groupSets(sets, languageName)
      .map((group) => [
        h("h2", { class: "group" }, group.name),
        h(
          "ul",
          { class: "sets" },
          group.sets.map((set) => setCard(set, learn, lines)),
        ),
      ])
      .flat(),
  );
  return sets;
}

/** `lines`: Zeile für den Lernstand je Set, gefüllt von `showProgress`. */
function setCard(set: StoredSet, learn: Learn, lines: Map<string, HTMLElement>): Node {
  const { entries } = setSize(set);
  const count = entries === 1 ? "1 Eintrag" : `${entries} Einträge`;
  // Hält die Höhe, bis der Lernstand da ist, damit die Liste nicht springt.
  const status = h("p", { class: "status" });
  lines.set(set.id, status);
  const play =
    entries > 0 &&
    h(
      "button",
      {
        type: "button",
        class: "play",
        // Wie der Link „Lernen“ der Set-Ansicht, damit auch Sprachsteuerung ihn findet.
        "aria-label": `${set.title} lernen`,
        onclick: () => learn(set, play as HTMLButtonElement),
      },
      icon("play"),
    );
  return h(
    "li",
    { class: "setcard" },
    // Titel und Zahl in einem Block: Der Link deckt per CSS die ganze Fläche links ab.
    h(
      "div",
      null,
      h("a", { href: `#/set/${encodeURIComponent(set.id)}`, class: "title" }, set.title),
      " ",
      h("span", { class: "count" }, set.level ? `${set.level} · ${count}` : count),
    ),
    play,
    status,
  );
}

/** „Weiterlernen“ zuerst, dann der Lernstand Set für Set; endet, sobald die Ansicht verlassen ist. */
async function showProgress(
  sets: StoredSet[],
  context: LibraryContext,
  lines: Map<string, HTMLElement>,
  page: Frame,
  learn: Learn,
  signal: AbortSignal,
): Promise<void> {
  const start = await context.loadStart(sets).catch((error: unknown): LibraryStart => {
    console.warn("Zuletzt gelerntes Set nicht ermittelt", error);
    return { order: [] };
  });
  if (signal.aborted) return;
  const next = start.continueWith;
  if (next) {
    const button: HTMLButtonElement = h(
      "button",
      { type: "button", class: "continue", onclick: () => learn(next.set, button) },
      icon("play"),
      h(
        "span",
        null,
        "Weiterlernen",
        " ",
        h(
          "small",
          null,
          next.count === undefined
            ? next.set.title
            : `${next.set.title} · ${vocabulary(next.count)}`,
        ),
      ),
    );
    page.setDock(button);
  }
  const first = start.order
    .map((id) => sets.find((set) => set.id === id))
    .filter((set): set is StoredSet => set !== undefined);
  const now = new Date();
  for (const set of [...first, ...sets.filter((set) => !first.includes(set))]) {
    const line = lines.get(set.id);
    if (!line) continue;
    try {
      const stats = await context.loadOverview(set);
      if (signal.aborted) return;
      line.replaceChildren(...h("span", null, libraryStatus(stats.set, now)).childNodes);
    } catch (error) {
      if (signal.aborted) return;
      console.warn("Lernstand nicht lesbar", error);
      line.textContent = NO_STATUS;
    }
  }
}
