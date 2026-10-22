// Sitzung einrichten (TDD 12.1, FR-07, FR-08, D-27): Sektionen, Richtung, Anzahl in festen Stufen und
// Anteil an Multiple Choice, vorbelegt mit der zuletzt gewählten Einrichtung des Sets.
import type { Direction, StoredSet } from "../../domain/model";
import {
  type CountChoice,
  countOptions,
  effectiveCount,
  fitCount,
  MC_SHARE_STEP,
  type PracticeSetup,
  selectedEntryCount,
} from "../../domain/practiceSetup";
import { h } from "../dom";
import { languageName } from "../languages";

export interface LearnContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  loadSetup: (set: StoredSet) => Promise<PracticeSetup>;
  /** Legt die Sitzung an und wechselt zu ihr; lehnt ab, wenn das Speichern scheitert. */
  startPractice: (set: StoredSet, setup: PracticeSetup) => Promise<void>;
}

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";
const NOT_STARTED =
  "Die Lernsitzung konnte nicht gestartet werden. Lade die Seite neu und versuche es noch einmal.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const back = () => h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek"));

/** Fokus auf die Überschrift, sobald sie eingehängt ist; Screenreader lesen dann den Titel vor. */
function focus(element: HTMLElement): void {
  element.tabIndex = -1;
  if (element.isConnected) element.focus();
  else queueMicrotask(() => element.isConnected && element.focus());
}

export function learnView(context: LearnContext): Node {
  const main = h("main", { class: "setup" });
  const fail = (title: string, text: string, alert = false) =>
    main.replaceChildren(
      h("h1", null, title),
      h("p", alert ? { role: "alert" } : null, text),
      back(),
    );
  void (async () => {
    let set: StoredSet | undefined;
    try {
      set = await context.loadSet();
    } catch (error) {
      console.error("Set nicht lesbar", error);
      return fail("Lernen", NOT_LOADED, true);
    }
    if (!set) return fail("Set nicht gefunden", "Dieses Vokabelset gibt es nicht (mehr).");
    if (
      selectedEntryCount(
        set,
        set.sections.map((section) => section.id),
      ) === 0
    ) {
      return fail(set.title, "Dieses Set hat noch keine Einträge zum Lernen.");
    }
    // Ist die Ansicht schon verlassen, hängt `main` nirgends mehr; das Ersetzen bleibt dann folgenlos.
    main.replaceChildren(...form(set, await context.loadSetup(set), context));
  })();
  return main;
}

function form(set: StoredSet, initial: PracticeSetup, context: LearnContext): Node[] {
  const selected = new Set(initial.sectionIds);
  let direction = initial.direction;
  // Die gewählte Stufe bleibt, auch wenn sie bei kleinerer Auswahl zeitweise als „alle“ erscheint.
  let chosenCount = initial.count;
  let mcShare = initial.mcShare;

  const term = languageName(set.termLanguage);
  const meaning = languageName(set.meaningLanguage);
  const directions: [Direction | "mixed", string][] = [
    ["termToMeaning", `${term} → ${meaning}`],
    ["meaningToTerm", `${meaning} → ${term}`],
    ["mixed", "Gemischt"],
  ];

  const sectionIds = () => set.sections.map((s) => s.id).filter((id) => selected.has(id));
  const available = () => selectedEntryCount(set, sectionIds());
  const setup = (): PracticeSetup => ({
    sectionIds: sectionIds(),
    direction,
    count: fitCount(chosenCount, available()),
    mcShare,
  });

  const boxes = set.sections.map((section) =>
    h("input", {
      type: "checkbox",
      value: section.id,
      checked: selected.has(section.id),
      onchange: (event: Event) => {
        const box = event.target as HTMLInputElement;
        if (box.checked) selected.add(section.id);
        else selected.delete(section.id);
        update();
      },
    }),
  );
  const setAll = (checked: boolean) => {
    for (const box of boxes) box.checked = checked;
    selected.clear();
    if (checked) for (const section of set.sections) selected.add(section.id);
    update();
  };
  // Bei nur einer Sektion gibt es nichts zu wählen.
  const sections =
    set.sections.length > 1 &&
    h(
      "fieldset",
      null,
      h("legend", null, "Sektionen"),
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "secondary", onclick: () => setAll(true) }, "Alle"),
        h("button", { type: "button", class: "secondary", onclick: () => setAll(false) }, "Keine"),
      ),
      h(
        "ul",
        { class: "section-choice" },
        set.sections.map((section, index) =>
          h(
            "li",
            null,
            h(
              "label",
              null,
              boxes[index],
              h("span", { class: "title" }, section.title),
              h("span", { class: "count" }, count(section.entries.length, "Eintrag", "Einträge")),
            ),
          ),
        ),
      ),
    );

  const directionChoice = h(
    "fieldset",
    null,
    h("legend", null, "Richtung"),
    h(
      "div",
      { class: "choices" },
      directions.map(([value, label]) =>
        h(
          "label",
          null,
          h("input", {
            type: "radio",
            name: "direction",
            value,
            checked: value === direction,
            onchange: () => (direction = value),
          }),
          label,
        ),
      ),
    ),
  );

  const countChoices = h("div", { class: "choices" });
  const countChoice = h("fieldset", null, h("legend", null, "Anzahl"), countChoices);
  const shareText = () => `${mcShare} % (Rest: Karteikarten)`;
  const shareValue = h("span", { class: "share-value" }, shareText());
  const slider = h("input", {
    type: "range",
    id: "mc-share",
    min: 0,
    max: 100,
    step: MC_SHARE_STEP,
    value: mcShare,
    "aria-valuetext": `${mcShare} Prozent`,
    oninput: () => {
      mcShare = slider.valueAsNumber;
      shareValue.textContent = shareText();
      slider.setAttribute("aria-valuetext", `${mcShare} Prozent`);
    },
  });
  const shareChoice = h(
    "div",
    { class: "share" },
    h("label", { for: "mc-share" }, "Multiple Choice"),
    slider,
    shareValue,
  );

  const status = h("p", { "aria-live": "polite", class: "selection" });
  const problem = h("div", { role: "alert" });
  const start = h("button", { type: "submit" });

  const renderCounts = (total: number) => {
    const shown = fitCount(chosenCount, total);
    countChoices.replaceChildren(
      ...countOptions(total).map((option: CountChoice) =>
        h(
          "label",
          null,
          h("input", {
            type: "radio",
            name: "count",
            value: String(option),
            checked: option === shown,
            onchange: () => {
              chosenCount = option;
              update();
            },
          }),
          option === "all" ? `alle (${total})` : String(option),
        ),
      ),
    );
  };

  let shownTotal = -1;
  const update = () => {
    const total = available();
    // Nur bei geänderter Auswahl neu aufbauen, sonst verlöre die gewählte Stufe den Fokus.
    if (total !== shownTotal) renderCounts(total);
    shownTotal = total;
    const cards = effectiveCount(chosenCount, total);
    status.textContent =
      total === 0
        ? "Wähle mindestens eine Sektion."
        : `${count(total, "Vokabel", "Vokabeln")} ausgewählt.`;
    start.textContent = cards === 0 ? "Lernen" : `${count(cards, "Vokabel", "Vokabeln")} lernen`;
    start.disabled = total === 0;
  };
  update();

  const heading = h("h1", { class: "set-title" }, set.title);
  focus(heading);
  return [
    heading,
    h("p", { class: "languages" }, "Lernsitzung einrichten"),
    h(
      "form",
      {
        onsubmit: async (event: Event) => {
          event.preventDefault();
          start.disabled = true;
          problem.textContent = "";
          try {
            await context.startPractice(set, setup());
          } catch (error) {
            console.error("Sitzung nicht gestartet", error);
            problem.textContent = NOT_STARTED;
            start.disabled = false;
          }
        },
      },
      sections,
      directionChoice,
      countChoice,
      shareChoice,
      status,
      h("div", { class: "actions" }, start),
    ),
    problem,
    back(),
  ];
}
