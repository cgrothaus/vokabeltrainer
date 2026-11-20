// Set-Ansicht (TDD 13.1, FR-02, FR-03): Titel und Sprachpaar, Lernstand als Kacheln (12.6, D-50),
// Sektionen als Karten zum Aufklappen mit allen Angaben der Einträge, „Über dieses Set“ am Ende.
// „Lernen“ unten; Bearbeiten (D-41), Exportieren (D-42) und Löschen im Menü „···“ (13.7).
import { dayNumber } from "../../domain/learningState";
import { setSize } from "../../domain/library";
import type { Answer, StoredEntry, StoredSection, StoredSet } from "../../domain/model";
import { type PlanSummary, planSummary } from "../../domain/plan";
import { describeDay, firstAttemptRate, type Overview, type SetStats } from "../../domain/stats";
import { entryDetails } from "../components/entryDetails";
import { frame } from "../components/frame";
import { learnActions, learnButton } from "../components/learnButton";
import {
  describeStages,
  type DirectionStages,
  directionStages,
  planText,
  splitTrack,
  track,
} from "../components/learningStatus";
import { openSheet } from "../components/sheet";
import { speakButton } from "../components/speakButton";
import type { DeleteOutcome, DeletionScope } from "../deleteSet";
import { type Child, focusSoon, h } from "../dom";
import { icon } from "../icons";
import { languageName } from "../languages";
import { failureMessage } from "../storageMessages";
import type { Say } from "../../platform/speech";

export interface SetContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  loadOverview: (set: StoredSet) => Promise<SetStats>;
  deletionScope: (set: StoredSet) => Promise<DeletionScope>;
  removeSet: (set: StoredSet) => Promise<DeleteOutcome>;
  /** Nach dem Löschen: Meldung für die Bibliothek und Wechsel dorthin. */
  onRemoved: (message: string) => void;
  /** Meldung nach einer Übernahme aus einer Datei (TDD 9.7); nur beim ersten Anzeigen. */
  takeMessage: () => string | null;
  /** Vorlesen der Lernsprache (TDD 12.11); `null` ohne passende Stimme. */
  speaker: (lang: string) => Promise<Say | null>;
  /** „Jetzt wiederholen“ bzw. „Neue Vokabeln lernen“ (TDD 12.8); wechselt bei Erfolg zur Sitzung. */
  startPlanned: (set: StoredSet) => Promise<void>;
}

const NOT_STARTED = "Die Lernsitzung wurde nicht gestartet.";

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";
const NO_OVERVIEW = "Der Lernstand konnte nicht geladen werden.";
const NO_SCOPE =
  "Der Umfang des Sets konnte nicht ermittelt werden. Lade die Seite neu und versuche es noch einmal.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const REVIEW_STATUS = { unchecked: "ungeprüft", checked: "geprüft" } as const;

export function setView(context: SetContext): Node {
  const main = h("main", { class: "set" });
  // Erst mit dem Set sichtbar: Bearbeiten, Exportieren und Löschen brauchen es (TDD 13.1).
  const menuButton = h(
    "button",
    { type: "button", class: "iconbtn", "aria-label": "Weitere Aktionen", hidden: true },
    icon("more"),
  );
  const page = frame({ back: { parent: "#/" }, actions: [menuButton] }, main);
  // Gleich nehmen: Beim Neuzeichnen (anderer Tab) erschiene sie sonst nicht noch einmal.
  const text = context.takeMessage();
  const message = text && h("p", { role: "status", class: "message" }, text);
  void context.loadSet().then(
    // Ist die Ansicht schon verlassen, hängt `main` nirgends mehr; das Ersetzen bleibt dann folgenlos.
    (set) => {
      if (set) {
        page.setTitle(set.title);
        const errors = h("p", { role: "alert", class: "problem" });
        // Die Aktionsleiste folgt dem Plan, sobald der Lernstand da ist (D-63); bis dahin „Lernen“.
        const showPlan = (plan: PlanSummary) => {
          const start = async (button: HTMLButtonElement) => {
            button.disabled = true;
            errors.replaceChildren();
            try {
              await context.startPlanned(set);
            } catch (error) {
              console.error("Lernsitzung nicht gestartet", error);
              errors.textContent = failureMessage(error, NOT_STARTED);
              focusSoon(errors);
            } finally {
              button.disabled = false;
            }
          };
          if (setSize(set).entries > 0) page.setDock(...learnActions(set, plan, start));
        };
        main.replaceChildren(
          ...h("div", null, content(set, context, message, errors, showPlan)).childNodes,
        );
        const remove = deletion(set, context, page.element, menuButton, errors);
        menuButton.onclick = () => openMenu(set, page.element, menuButton, remove);
        menuButton.hidden = false;
        if (setSize(set).entries > 0) page.setDock(learnButton(set));
        // Fokus auf die Meldung, damit Screenreader sie vorlesen (D-34).
        if (message) focusSoon(message);
        return;
      }
      page.setTitle("Set nicht gefunden");
      main.replaceChildren(h("p", null, "Dieses Vokabelset gibt es nicht (mehr)."));
    },
    (error: unknown) => {
      console.error("Set nicht lesbar", error);
      page.setTitle("Vokabelset");
      main.replaceChildren(h("p", { role: "alert" }, NOT_LOADED));
    },
  );
  return page.element;
}

/** Menü „···“ als Blatt von unten (TDD 13.7): Bearbeiten, Exportieren, Löschen (rot). */
/** `opener` ausdrücklich: WebKit fokussiert einen angetippten Knopf nicht. */
function openMenu(set: StoredSet, within: Element, opener: HTMLElement, remove: () => void): void {
  const id = encodeURIComponent(set.id);
  const sheet = openSheet(within, {
    title: set.title,
    returnTo: opener,
    content: [
      h(
        "ul",
        { class: "rows" },
        h(
          "li",
          null,
          h("a", { href: `#/edit/${id}` }, icon("edit"), h("span", null, "Bearbeiten")),
        ),
        h(
          "li",
          null,
          h("a", { href: `#/export/${id}` }, icon("download"), h("span", null, "Exportieren")),
        ),
        h(
          "li",
          null,
          h(
            "button",
            {
              type: "button",
              class: "destructive",
              onclick: () => {
                sheet.close();
                remove();
              },
            },
            icon("trash"),
            h("span", null, "Set löschen"),
          ),
        ),
      ),
    ],
  });
}

function content(
  set: StoredSet,
  context: SetContext,
  message: Child,
  errors: Node,
  showPlan: (plan: PlanSummary) => void,
): Child[] {
  const { entries } = setSize(set);
  const overview = h("div", { class: "overview" });
  // Je Sektion eine Zeile im Titel, auch zugeklappt sichtbar; gefüllt, sobald der Lernstand da ist.
  const sectionLines = new Map(
    set.sections.map((section) => [section.id, h("span", { class: "stats" })]),
  );
  // Lautsprecher je Wort (TDD 12.11); erst, wenn feststeht, dass das Gerät eine Stimme hat.
  const speakSlots: [HTMLElement, string][] = [];
  void context.speaker(set.termLanguage).then((say) => {
    if (say) for (const [slot, text] of speakSlots) slot.replaceChildren(speakButton(text, say));
  });
  void context.loadOverview(set).then(
    (stats) => {
      const now = new Date();
      const directions = directionStages(set, stats.cards);
      const plan = planSummary(set, stats.cards, dayNumber(now));
      showPlan(plan);
      overview.replaceChildren(
        ...h("div", null, describeSet(stats.set, directions, plan, now)).childNodes,
      );
      for (const [id, line] of sectionLines) {
        const section = stats.sections.get(id);
        if (section)
          line.replaceChildren(...h("span", null, describeSection(section, now)).childNodes);
      }
    },
    (error: unknown) => {
      console.error("Lernstand nicht lesbar", error);
      overview.replaceChildren(h("p", { role: "alert" }, NO_OVERVIEW));
    },
  );
  const facts = [
    `${languageName(set.termLanguage)} → ${languageName(set.meaningLanguage)}`,
    count(entries, "Eintrag", "Einträge"),
    ...(set.level ? [set.level] : []),
  ];
  return [
    h(
      "div",
      { class: "head" },
      // Der Titel in der App-Leiste ist einzeilig; aus Dateien kann er lang sein (TDD 13.7).
      h("p", { class: "display" }, set.title),
      h("p", { class: "languages" }, facts.join(" · ")),
      message,
      errors,
    ),
    h("section", { class: "learning", "aria-labelledby": "learning" }, [
      h("h2", { id: "learning" }, "Lernstand"),
      overview,
    ]),
    h("section", { class: "contents", "aria-labelledby": "contents" }, [
      h("h2", { id: "contents" }, "Sektionen"),
      set.sections.length === 0
        ? h("p", null, "Dieses Set hat noch keine Sektionen.")
        : set.sections.map((section) =>
            sectionView(section, set, sectionLines.get(section.id)!, speakSlots),
          ),
    ]),
    about(set),
  ];
}

/** Optionale Angaben außer der Lernstufe, zugeklappt am Ende; ohne Angaben entfällt der Abschnitt. */
function about(set: StoredSet): Node | null {
  const textbook =
    set.textbook && set.edition ? `${set.textbook}, ${set.edition}` : (set.textbook ?? set.edition);
  const rows: [string, string | undefined][] = [
    [set.textbook ? "Lehrwerk" : "Ausgabe", textbook],
    ["Herkunft", set.source],
    ["Lizenz", set.license],
    ["Notiz", set.notes],
    ["Prüfstatus", set.reviewStatus && REVIEW_STATUS[set.reviewStatus]],
  ];
  const shown = rows.filter((row): row is [string, string] => row[1] !== undefined);
  if (shown.length === 0) return null;
  return h(
    "details",
    { class: "about", id: "about" },
    h("summary", null, "Über dieses Set"),
    h(
      "dl",
      { class: "details" },
      shown.map(([label, value]) => h("div", null, h("dt", null, label), h("dd", null, value))),
    ),
  );
}

/**
 * Lernstand des ganzen Sets als drei Kacheln (TDD 12.6, AK-17, D-50), darunter je Richtung, wie viele
 * Vokabeln sicher, im Aufbau und neu sind (12.7, AK-30, D-62).
 */
function describeSet(
  overview: Overview,
  directions: DirectionStages[],
  plan: PlanSummary,
  now: Date,
): Child[] {
  if (overview.sessions === 0 || !overview.lastAt) {
    return [h("p", null, "Mit diesem Set hast du noch nicht gelernt.")];
  }
  const percent = firstAttemptRate(overview);
  const recent = overview.recent?.sessions ?? 0;
  // `dt` vor `dd`, wie HTML es verlangt; das CSS stellt die Zahl darüber.
  const tile = (label: string, value: string) =>
    h("div", null, h("dt", null, label), h("dd", null, value));
  // Was der Plan heute anbietet, wie in der Bibliothek (TDD 12.8).
  const next = planText(plan);
  return [
    next && h("p", { class: "plan" }, next),
    h(
      "dl",
      { class: "tiles" },
      tile(overview.sessions === 1 ? "Sitzung" : "Sitzungen", String(overview.sessions)),
      percent !== null && tile("beim 1. Mal", `${percent} %`),
      tile("zuletzt", describeDay(overview.lastAt, now).replace(/^am /, "")),
    ),
    percent !== null &&
      h(
        "p",
        { class: "note" },
        // Erklärt die kurze Beschriftung der Kachel, wie bisher als ganzer Satz (TDD 12.6).
        recent === 1
          ? "Beim ersten Mal gewusst, in der letzten Sitzung"
          : `Beim ersten Mal gewusst, in den letzten ${recent} Sitzungen`,
      ),
    h(
      "ul",
      { class: "stages" },
      directions.map(({ label, counts }) =>
        h(
          "li",
          null,
          h("span", { class: "direction" }, label),
          " ",
          splitTrack(counts),
          " ",
          h("span", { class: "counts" }, describeStages(counts)),
        ),
      ),
    ),
  ];
}

/** Kurzform für die Zeile im Sektionstitel, mit Balken für die Quote. */
function describeSection(overview: Overview, now: Date): Child[] {
  if (overview.sessions === 0 || !overview.lastAt) return ["noch nicht gelernt"];
  const percent = firstAttemptRate(overview);
  const text = [
    count(overview.sessions, "Sitzung", "Sitzungen"),
    `zuletzt ${describeDay(overview.lastAt, now)}`,
    ...(percent !== null ? [`${percent} %`] : []),
  ].join(" · ");
  return [text, percent !== null && track(percent)];
}

function sectionView(
  section: StoredSection,
  set: StoredSet,
  stats: HTMLElement,
  speakSlots: [HTMLElement, string][],
): Node {
  return h(
    "details",
    // Mit `id`, damit ein Neuzeichnen (TDD 3.4) sie aufgeklappt lässt.
    { class: "section", id: `section-${section.id}` },
    h(
      "summary",
      null,
      h("span", { class: "title" }, section.title),
      " ",
      h("span", { class: "count" }, count(section.entries.length, "Eintrag", "Einträge")),
      // Leerzeichen trennt die Zeile im vorgelesenen Namen; optisch bricht sie ohnehin um.
      " ",
      stats,
    ),
    section.entries.length === 0
      ? h("p", null, "Diese Sektion hat noch keine Einträge.")
      : h(
          "ul",
          { class: "entries" },
          section.entries.map((entry) => entryView(entry, set, speakSlots)),
        ),
  );
}

/** Text mit seinen Varianten, z. B. „autumn (auch: fall)“. */
function answer(value: Answer, lang: string, className: string): Node {
  const variants = value.acceptedVariants ?? [];
  return h(
    "span",
    { class: className, lang },
    value.text,
    variants.length > 0 && h("span", { class: "variants" }, ` (auch: ${variants.join(", ")})`),
  );
}

function entryView(entry: StoredEntry, set: StoredSet, speakSlots: [HTMLElement, string][]): Node {
  const meanings = entry.meanings.flatMap((meaning, index) => [
    index > 0 && "; ",
    answer(meaning, set.meaningLanguage, "meaning"),
  ]);
  const speak = h("span", { class: "speak-slot" });
  speakSlots.push([speak, entry.term.text]);
  return h(
    "li",
    null,
    h(
      "div",
      { class: "entry-text" },
      h(
        "p",
        { class: "pair" },
        answer(entry.term, set.termLanguage, "term"),
        " – ",
        meanings,
        // Als Text, nicht nur als Farbe (TDD 13.4).
        entry.reviewStatus === "unchecked" && [" ", h("span", { class: "badge" }, "ungeprüft")],
      ),
      entryDetails(entry, set),
    ),
    speak,
  );
}

function describeScope(scope: DeletionScope): string {
  const content = `Gelöscht werden ${count(scope.sections, "Sektion", "Sektionen")} mit ${count(scope.entries, "Eintrag", "Einträgen")}`;
  if (scope.sessions === 0) return `${content}. Mit diesem Set hast du noch nicht gelernt.`;
  return `${content} und dein Lernstand dazu: ${count(scope.events, "Antwort", "Antworten")} aus ${count(scope.sessions, "Lernsitzung", "Lernsitzungen")}.`;
}

/**
 * Löschen aus dem Menü mit Rückfrage im Blatt (FR-02, TDD 10, 13.7): nennt vorher, was mitgelöscht
 * wird, die Schaltfläche nennt die Folge (13.3). Danach geht der Fokus zurück an „···“ (`start`).
 */
function deletion(
  set: StoredSet,
  context: SetContext,
  within: Element,
  start: HTMLButtonElement,
  errors: HTMLElement,
): () => void {
  const begin = async () => {
    start.disabled = true;
    errors.replaceChildren();
    let scope: DeletionScope;
    try {
      scope = await context.deletionScope(set);
    } catch (error) {
      console.error("Umfang nicht ermittelt", error);
      errors.textContent = NO_SCOPE;
      start.disabled = false;
      return;
    }
    confirm(scope);
  };

  const confirm = (scope: DeletionScope) => {
    const remove = h(
      "button",
      {
        type: "button",
        class: "danger",
        onclick: async () => {
          remove.disabled = abort.disabled = true;
          let outcome: DeleteOutcome;
          try {
            outcome = await context.removeSet(set);
          } catch (error) {
            console.error("Set nicht gelöscht", error);
            outcome = { ok: false, error: "Das Set konnte nicht gelöscht werden." };
          }
          if (outcome.ok) return context.onRemoved(`„${set.title}“ gelöscht.`);
          sheet.close();
          errors.textContent = outcome.error;
          start.disabled = false;
        },
      },
      scope.entries > 0
        ? `Set mit ${count(scope.entries, "Eintrag", "Einträgen")} löschen`
        : "Endgültig löschen",
    );
    const abort = h(
      "button",
      { type: "button", class: "secondary", onclick: () => sheet.dismiss() },
      "Abbrechen",
    );
    const text = h("p", null, describeScope(scope));
    const sheet = openSheet(within, {
      title: "Set löschen?",
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

  return () => void begin();
}
