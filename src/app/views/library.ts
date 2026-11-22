// Bibliothek (TDD 13.1, FR-02, FR-11, FR-43): Sets als Karten nach Lernsprache, je mit Lernstand und
// Lernen-Knopf (Schnellstart, 12.1), je Sprachpaar mit mehreren Sets „Zusammen lernen“ (12.10), unten
// „Weiterlernen“ mit dem zuletzt gelernten Set bzw. der Zusammenstellung. Der Lernstand wird
// nachgeladen, ein Set nach dem anderen, das zuletzt gelernte zuerst (12.6, D-50). Ordnen (D-72):
// Filter nach Sprache ab zwei Sprachen, die zuletzt gelernten Sets oben, archivierte Sets nur im Archiv,
// Auswahlmodus auf einem zusätzlichen Verlaufseintrag (Marke `selecting`) zum Archivieren und für die
// Lernstufe mehrerer Sets.
import type { Reminder } from "../../domain/backupReminder";
import { dayNumber } from "../../domain/learningState";
import type { StoredSet } from "../../domain/model";
import { FRESH_ONLY, planSummary, planSummaryAcross } from "../../domain/plan";
import {
  groupSets,
  joinTitles,
  type LanguagePair,
  languageFilter,
  pairsToCombine,
  type SetGroup,
  setSize,
  splitRecent,
} from "../../domain/library";
import type { SetStats } from "../../domain/stats";
import { installOffer, type ProtectionNotice } from "../../domain/storageProtection";
import type { ArrangeOutcome } from "../archive";
import { backupReminder, type ReminderActions } from "../components/backupReminder";
import { filterPills, focusChosen } from "../components/filterPills";
import { focusPick, pickCard } from "../components/pickCard";
import { frame, iconLink } from "../components/frame";
import type { IosDevice } from "../components/homeScreen";
import { directionStages, libraryStatus } from "../components/learningStatus";
import { protectionHint, quietRow } from "../components/protectionHint";
import { reportStorageProblem } from "../components/storageNotice";
import { focusSoon, h } from "../dom";
import { icon, type IconName } from "../icons";
import { languageName } from "../languages";
import type { LibraryStart } from "../library";
import { hasMark, pushMark } from "../router";
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
  /** IDs der archivierten Sets (D-72). */
  loadArchived: () => Promise<Set<string>>;
  /** Gemerkte Sprache der Filter, ungeprüft. */
  loadLanguageFilter: () => Promise<unknown>;
  saveLanguageFilter: (language: string | null) => Promise<void>;
  archive: (setIds: string[]) => Promise<ArrangeOutcome>;
  /** Reihenfolge des Nachladens und „Weiterlernen“, ohne Antworten zu lesen (TDD 12.6). */
  loadStart: (sets: StoredSet[]) => Promise<LibraryStart>;
  loadOverview: (set: StoredSet) => Promise<SetStats>;
  /** Schnellstart (TDD 12.1): startet mit der gemerkten Einrichtung oder öffnet die Einrichtung. */
  startLearning: (set: StoredSet) => Promise<void>;
  /** „Weiterlernen“ mit mehreren Sets (TDD 12.10): Plan, sonst die gemerkte freie Auswahl. */
  startTogether: (sets: StoredSet[]) => Promise<void>;
  /** Speichert das Beispielset (Empty State); bei Erfolg wechselt die App zur Set-Ansicht. */
  loadSampleSet: () => Promise<SampleOutcome>;
  /** Meldung aus dem vorigen Schritt, z. B. nach Import oder Löschen; wird beim Abholen geleert. */
  takeMessage: () => string | null;
}

const NOT_STARTED = "Die Lernsitzung wurde nicht gestartet.";
const NO_STATUS = "Lernstand nicht verfügbar";
const SELECTING = "selecting";
const TITLE = "Vokabeltrainer";

const vocabulary = (n: number) => (n === 1 ? "1 Vokabel" : `${n} Vokabeln`);
const countSets = (n: number) => (n === 1 ? "1 Set" : `${n} Sets`);

/** Auswahl, solange die App läuft: Nach „Lernstufe …“ und Zurück ist sie noch da (D-72). */
const picked = new Set<string>();

/** Seite „Lernstufe setzen“ für die gewählten Sets; `from` ist die Ansicht, in die sie zurückkehrt. */
export const levelHref = (from: "library" | "archive", setIds: Iterable<string>) =>
  `#/level/${from}/${encodeURIComponent([...setIds].join(","))}`;

interface Library {
  sets: StoredSet[];
  /** Ohne archivierte Sets. */
  active: StoredSet[];
  archivedCount: number;
  start: LibraryStart;
  filter: string | null;
}

export function libraryView(context: LibraryContext, signal: AbortSignal): Node {
  // Hinweise über der Liste (TDD 13.1); sie hängen vom Bestand ab und erscheinen nach dem Laden. Die
  // Backup-Erinnerung steht unter der Liste (D-46); bis beides geprüft ist, gilt der Bereich als beschäftigt.
  const hints = h("div", { class: "hints", "aria-busy": "true" });
  const reminderSlot = h("div", { class: "reminder-slot" });
  const archiveSlot = h("div", { class: "archive-slot" });
  const sets = h("section", { "aria-label": "Vokabelsets" });
  // Begrüßung und Wege unter der Liste erst nach dem Laden: Der Empty State hat eigene (TDD 13.1).
  const greeting = h(
    "div",
    { class: "greeting", hidden: true },
    h("p", { class: "display" }, "Was lernst du heute?"),
    h("p", { class: "lead" }, "Deine Vokabeln bleiben auf diesem Gerät. Kein Konto, keine Cloud."),
  );
  // Die Liste endet mit „Hinzufügen“; das Archiv betrifft die ganze Bibliothek und steht darunter
  // abgesetzt (D-72). Backup und Wiederherstellung erreicht man über die Einstellungen (D-31).
  const more = h(
    "div",
    { class: "more", hidden: true },
    h(
      "a",
      { href: "#/import", class: "addcard" },
      icon("plus"),
      h("span", null, "Vokabelset hinzufügen"),
    ),
    archiveSlot,
    reminderSlot,
  );
  // Scheitert der Schnellstart, steht die Meldung oben und bekommt den Fokus.
  const problem = h("p", { role: "alert", class: "problem" });
  const messageSlot = h("div", { class: "message-slot" });
  const showMessage = (text: string) => {
    const message = h("p", { role: "status", class: "message", tabindex: "-1" }, text);
    messageSlot.replaceChildren(message);
    focusSoon(message);
  };
  const text = context.takeMessage();
  if (text) {
    const message = h("p", { role: "status", class: "message", tabindex: "-1" }, text);
    messageSlot.replaceChildren(message);
    // Fokus auf die Meldung, sobald die Ansicht eingehängt ist, damit Screenreader sie vorlesen.
    queueMicrotask(() => message.isConnected && message.focus());
  }

  const selectButton = h(
    "button",
    {
      type: "button",
      class: "iconbtn",
      "aria-label": "Sets auswählen",
      hidden: true,
      onclick: () => {
        pushMark(SELECTING);
        picked.clear();
        selecting = true;
        render();
        focusSoon(page.setTitle(selectionTitle()));
      },
    },
    icon("select"),
  );
  const settingsLink = iconLink("#/settings", "Einstellungen", "gear");
  const page = frame(
    { title: TITLE, actions: [selectButton, settingsLink] },
    h("main", { class: "library" }, messageSlot, problem, greeting, hints, sets, more),
  );

  const learn = async (target: StoredSet | StoredSet[], button: HTMLButtonElement) => {
    button.disabled = true;
    problem.replaceChildren();
    try {
      await (Array.isArray(target) ? context.startTogether(target) : context.startLearning(target));
    } catch (error) {
      console.error("Lernsitzung nicht gestartet", error);
      problem.textContent = failureMessage(error, NOT_STARTED);
      focusSoon(problem);
    } finally {
      button.disabled = false;
    }
  };

  let library: Library | null = null;
  // Nach dem Neuladen auf dem Zusatzeintrag bleibt die Auswahl offen (wie der Sortiermodus, D-54).
  let selecting = hasMark(SELECTING);
  if (!selecting) picked.clear();
  let continueButton: HTMLButtonElement | null = null;
  const lines = new Map<string, HTMLElement>();
  const selectionTitle = () => (picked.size === 0 ? "Sets auswählen" : `${picked.size} ausgewählt`);

  const endSelection = () => history.back();
  const archive = async (button: HTMLButtonElement) => {
    button.disabled = true;
    problem.replaceChildren();
    const outcome = await context.archive([...picked]).catch((error: unknown): ArrangeOutcome => ({
      ok: false,
      error: failureMessage(error, "Nichts wurde archiviert."),
    }));
    if (!outcome.ok) {
      button.disabled = false;
      problem.textContent = outcome.error;
      return focusSoon(problem);
    }
    picked.clear();
    library = await load(context).catch(() => library);
    // Zurück vom Zusatzeintrag; die Meldung steht, sobald die Liste wieder normal ist.
    endSelection();
    showMessage(outcome.message);
  };

  const render = () => {
    if (!library) return;
    const { active, archivedCount } = library;
    // Nur, was es noch gibt (anderer Tab, Archivieren).
    for (const id of picked) if (!active.some((set) => set.id === id)) picked.delete(id);
    sets.replaceChildren(...listContent(library, learn, lines, selecting, onChange));
    archiveSlot.replaceChildren(archivedCount > 0 && !selecting ? archiveRow(archivedCount) : "");
    selectButton.hidden = selecting || active.length < 2;
    settingsLink.hidden = selecting;
    more.hidden = selecting;
    greeting.hidden = selecting;
    hints.hidden = selecting;
    if (selecting) {
      page.setTitle(selectionTitle());
      page.setBack({ label: "Auswahl beenden", icon: "close", onclick: endSelection });
      const none = picked.size === 0;
      const level = h(
        "button",
        {
          type: "button",
          class: "secondary",
          disabled: none,
          onclick: () => (location.hash = levelHref("library", picked)),
        },
        "Lernstufe …",
      );
      const store: HTMLButtonElement = h(
        "button",
        { type: "button", disabled: none, onclick: () => archive(store) },
        "Archivieren",
      );
      page.setDock(level, store);
    } else {
      page.setTitle(TITLE);
      page.setBack(null);
      page.setDock(continueButton);
    }
  };

  /** Eine Wahl in der Liste: Filter oder Häkchen. Danach behält das Bedienelement den Fokus. */
  const onChange = (change: ListChange) => {
    if (!library) return;
    if (change.kind === "filter") {
      library.filter = change.language;
      context.saveLanguageFilter(change.language).catch((error: unknown) => {
        console.warn("Filter nicht gemerkt", error);
        reportStorageProblem(error, "Die Wahl der Sprache wurde nicht gemerkt.");
      });
      render();
      return focusChosen(sets);
    }
    for (const id of change.setIds) change.on ? picked.add(id) : picked.delete(id);
    render();
    if (change.group === undefined) focusPick(sets, change.setIds[0]!);
    else sets.querySelector<HTMLElement>(`[data-group="${CSS.escape(change.group)}"]`)?.focus();
  };

  // Zurück und Vorwärts zwischen normaler Liste und Auswahl (Marke `selecting`).
  window.addEventListener(
    "popstate",
    () => {
      const next = hasMark(SELECTING);
      if (next === selecting) return;
      selecting = next;
      if (!selecting) picked.clear();
      render();
      if (!messageSlot.hasChildNodes())
        focusSoon(page.setTitle(selecting ? selectionTitle() : TITLE));
    },
    { signal },
  );

  void load(context).then(
    async (loaded) => {
      library = loaded;
      const empty = loaded.sets.length === 0;
      // Ergibt sich aus dem Bestand, erscheint also auch nach dem Löschen des letzten Sets (TDD 13.1).
      if (empty) sets.replaceChildren(emptyLibrary(context.loadSampleSet));
      else render();
      greeting.hidden = more.hidden = empty || selecting;
      if (!empty)
        void showProgress(loaded, context, lines, learn, signal, (button) => {
          continueButton = button;
          if (!selecting) page.setDock(button);
        });
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
    },
    (error: unknown) => {
      console.error("Sets nicht lesbar", error);
      const message = failureMessage(error, "Die Vokabelsets konnten nicht geladen werden.");
      sets.replaceChildren(h("p", { role: "alert" }, message));
      hints.removeAttribute("aria-busy");
    },
  );
  return page.element;
}

/** Sets, Archiv, gemerkter Filter und „Weiterlernen“; nur die aktiven Sets zählen für Letzteres. */
async function load(context: LibraryContext): Promise<Library> {
  const sets = await context.loadSets();
  const archived = await context.loadArchived().catch((error: unknown) => {
    console.warn("Archiv nicht lesbar", error);
    return new Set<string>();
  });
  const active = sets.filter((set) => !archived.has(set.id));
  const start = await context.loadStart(active).catch((error: unknown): LibraryStart => {
    console.warn("Zuletzt gelerntes Set nicht ermittelt", error);
    return { order: [] };
  });
  const remembered = await context.loadLanguageFilter().catch(() => null);
  const languages = [...new Set(active.map((set) => set.termLanguage))];
  return {
    sets,
    active,
    archivedCount: sets.length - active.length,
    start,
    filter: languages.length > 1 ? languageFilter(remembered, languages) : null,
  };
}

/** Navigationszeile zum Archiv, abgesetzt unter „Hinzufügen“ (D-72). */
function archiveRow(count: number): Node {
  return h(
    "ul",
    { class: "rows archive-row" },
    h(
      "li",
      null,
      h(
        "a",
        { href: "#/archive" },
        icon("archive"),
        h("span", null, "Archiv"),
        h("span", { class: "tail" }, countSets(count)),
        icon("chevron"),
      ),
    ),
  );
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

type Learn = (target: StoredSet | StoredSet[], button: HTMLButtonElement) => Promise<void>;

type ListChange =
  | { kind: "filter"; language: string | null }
  /** `group`: die Gruppe bei „Alle auswählen“, für den Fokus danach. */
  | { kind: "pick"; setIds: string[]; on: boolean; group?: string };

/** Filter und Gruppen der aktiven Sets; im Auswahlmodus Karten mit Häkchen statt Lernen-Knopf. */
function listContent(
  library: Library,
  learn: Learn,
  lines: Map<string, HTMLElement>,
  selecting: boolean,
  onChange: (change: ListChange) => void,
): Node[] {
  const groups = groupSets(library.active, languageName);
  if (groups.length === 0) return [h("p", { class: "muted" }, "Alle deine Sets liegen im Archiv.")];
  const filter =
    groups.length > 1 &&
    filterPills(
      "Sprache",
      [
        { value: null, label: "Alle", count: library.active.length },
        ...groups.map((group) => ({
          value: group.language,
          label: group.name,
          count: group.sets.length,
        })),
      ],
      library.filter,
      (language) => onChange({ kind: "filter", language }),
    );
  const shown = groups.filter(
    (group) => library.filter === null || group.language === library.filter,
  );
  const withHeading = shown.length > 1 || groups.length === 1;
  return [
    filter,
    ...shown.map((group) =>
      groupContent(group, library.start.order, withHeading, {
        card: selecting
          ? (set) =>
              pickCard(set, entryCount(set), picked.has(set.id), (on) =>
                onChange({ kind: "pick", setIds: [set.id], on }),
              )
          : (set) => setCard(set, learn, lines),
        selectAll: selecting
          ? () => {
              const ids = group.sets.map((set) => set.id);
              const all = ids.every((id) => picked.has(id));
              return h(
                "button",
                {
                  type: "button",
                  class: "textbtn",
                  "data-group": group.language,
                  "aria-label": `${all ? "Keine" : "Alle"} aus ${group.name} auswählen`,
                  onclick: () =>
                    onChange({ kind: "pick", setIds: ids, on: !all, group: group.language }),
                },
                all ? "Keine auswählen" : "Alle auswählen",
              );
            }
          : null,
        together: !selecting,
      }),
    ),
  ].filter((node): node is HTMLElement => !!node);
}

/** Eine Sprache: ab fünf Sets die zuletzt gelernten zuerst, dann die übrigen (D-72). */
function groupContent(
  group: SetGroup,
  order: readonly string[],
  withHeading: boolean,
  parts: {
    card: (set: StoredSet) => Node;
    selectAll: (() => Node) | null;
    together: boolean;
  },
): HTMLElement {
  const { recent, rest } = splitRecent(group.sets, order);
  const sub = withHeading ? "h3" : "h2";
  const list = (items: StoredSet[]) => h("ul", { class: "sets" }, items.map(parts.card));
  const heading = withHeading && h("h2", { class: "group" }, group.name);
  const head =
    parts.selectAll || heading
      ? h("div", { class: "group-line" }, heading || h("span"), parts.selectAll?.())
      : null;
  return h(
    "section",
    { class: "language", ...(!withHeading && { "aria-label": group.name }) },
    head,
    recent.length > 0
      ? [
          h(sub, { class: "subgroup" }, "Zuletzt gelernt"),
          list(recent),
          h(sub, { class: "subgroup" }, "Weitere Sets"),
          list(rest),
        ]
      : list(rest),
    parts.together && togetherRows(group),
  );
}

/** „Zusammen lernen“ je Sprachpaar mit mindestens zwei Sets (TDD 12.10). */
function togetherRows(group: SetGroup): Node | null {
  const pairs = pairsToCombine(group);
  if (pairs.length === 0) return null;
  // Lernt man in einer Gruppe in mehrere Sprachen, nennt die Zeile das Paar.
  const several = new Set(group.sets.map((set) => set.meaningLanguage)).size > 1;
  const label = (pair: LanguagePair) =>
    several
      ? `Zusammen lernen: ${languageName(pair.termLanguage)} → ${languageName(pair.meaningLanguage)}`
      : "Zusammen lernen";
  return h(
    "ul",
    { class: "rows combine" },
    pairs.map((pair) => row(togetherHref(pair), "stack", label(pair))),
  );
}

/** Zeile mit Symbol und Pfeil zur Navigation (TDD 13.7). */
function row(href: string, symbol: IconName, label: string): Node {
  return h("li", null, h("a", { href }, icon(symbol), h("span", null, label), icon("chevron")));
}

const togetherHref = ({ termLanguage, meaningLanguage }: Omit<LanguagePair, "sets">) =>
  `#/together/${encodeURIComponent(termLanguage)}/${encodeURIComponent(meaningLanguage)}`;

const entryCount = (set: StoredSet) => {
  const { entries } = setSize(set);
  const count = entries === 1 ? "1 Eintrag" : `${entries} Einträge`;
  return set.level ? `${set.level} · ${count}` : count;
};

/** `lines`: Zeile für den Lernstand je Set, gefüllt von `showProgress`; sie bleibt beim Neuzeichnen. */
function setCard(set: StoredSet, learn: Learn, lines: Map<string, HTMLElement>): Node {
  const status = statusLine(lines, set.id);
  const play =
    setSize(set).entries > 0 &&
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
      h("span", { class: "count" }, entryCount(set)),
    ),
    play,
    status,
  );
}

/** Hält die Höhe, bis der Lernstand da ist, damit die Liste nicht springt; bleibt beim Neuzeichnen. */
function statusLine(lines: Map<string, HTMLElement>, setId: string): HTMLElement {
  let line = lines.get(setId);
  if (!line) {
    line = h("p", { class: "status" });
    lines.set(setId, line);
  }
  return line;
}

/** „Weiterlernen“ zuerst, dann der Lernstand Set für Set; endet, sobald die Ansicht verlassen ist. */
async function showProgress(
  library: Library,
  context: LibraryContext,
  lines: Map<string, HTMLElement>,
  learn: Learn,
  signal: AbortSignal,
  showContinue: (button: HTMLButtonElement) => void,
): Promise<void> {
  const { start, active: sets } = library;
  const next = start.continueWith;
  const together = start.continueTogether;
  // Zusatz unter „Weiterlernen“; sobald der Lernstand des Sets da ist, nennt er das Fällige (D-63).
  const detail = h("small", null);
  if (next || together) {
    const button: HTMLButtonElement = h(
      "button",
      {
        type: "button",
        class: "continue",
        onclick: () => learn(together ?? next!.set, button),
      },
      icon("play"),
      h("span", null, "Weiterlernen", " ", detail),
    );
    detail.textContent = together
      ? `Zusammen: ${joinTitles(together)}`
      : next!.count === undefined
        ? next!.set.title
        : `${next!.set.title} · ${vocabulary(next!.count)}`;
    showContinue(button);
  }
  // Lernstand der Zusammenstellung, sobald alle ihre Sets geladen sind.
  const loaded = new Map<string, SetStats>();
  const showTogether = (today: number) => {
    if (!together || together.some((set) => !loaded.has(set.id))) return;
    const parts = together.map((set) => ({ set, cards: loaded.get(set.id)!.cards }));
    const plan = planSummaryAcross(parts, today);
    const titles = `Zusammen: ${joinTitles(together)}`;
    if (plan.due > 0) detail.textContent = `${titles} · ${plan.due} fällig`;
    else if (plan.fresh > 0)
      detail.textContent = `${titles} · ${Math.min(plan.fresh, FRESH_ONLY)} neue Vokabeln`;
  };
  const first = start.order
    .map((id) => sets.find((set) => set.id === id))
    .filter((set): set is StoredSet => set !== undefined);
  const now = new Date();
  const today = dayNumber(now);
  for (const set of [...first, ...sets.filter((set) => !first.includes(set))]) {
    const line = statusLine(lines, set.id);
    try {
      const stats = await context.loadOverview(set);
      if (signal.aborted) return;
      loaded.set(set.id, stats);
      showTogether(today);
      const plan = planSummary(set, stats.cards, today);
      const status = libraryStatus(stats.set, directionStages(set, stats.cards), plan, now);
      if (set === next?.set && plan.due > 0)
        detail.textContent = `${set.title} · ${plan.due} fällig`;
      else if (set === next?.set && plan.fresh > 0)
        detail.textContent = `${set.title} · ${Math.min(plan.fresh, FRESH_ONLY)} neue Vokabeln`;
      line.replaceChildren(...h("span", null, status).childNodes);
    } catch (error) {
      if (signal.aborted) return;
      console.warn("Lernstand nicht lesbar", error);
      line.textContent = NO_STATUS;
    }
  }
}
