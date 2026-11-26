// Sitzung einrichten (TDD 12.1, FR-07, FR-08, D-27): oben „Wie beim letzten Mal“ mit der gemerkten
// Einrichtung, darunter Sektionen als Chips, Richtung und Anzahl als Segmentschalter und der Anteil an
// Multiple Choice, vorbelegt mit der gemerkten Einrichtung oder der Voreinstellung.
import type { StoredSet } from "../../domain/model";
import {
  defaultSetup,
  describeSetup,
  effectiveCount,
  fitCount,
  type PracticeSetup,
  selectedEntryCount,
} from "../../domain/practiceSetup";
import { type Frame, frame } from "../components/frame";
import { setupOptions } from "../components/setupOptions";
import { focusSoon, h } from "../dom";
import { icon } from "../icons";
import { languageName } from "../languages";
import { failureMessage } from "../storageMessages";

export interface LearnContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  /** Die gemerkte Einrichtung; `null`, wenn es keine gibt oder sie nicht lesbar ist. */
  loadSetup: (set: StoredSet) => Promise<PracticeSetup | null>;
  /** Legt die Sitzung an und wechselt zu ihr; lehnt ab, wenn das Speichern scheitert. */
  startPractice: (set: StoredSet, setup: PracticeSetup) => Promise<void>;
}

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function learnView(context: LearnContext, setId: string): Node {
  const main = h("main", { class: "setup" });
  const page = frame({ back: { parent: `#/set/${encodeURIComponent(setId)}` } }, main);
  const fail = (title: string, text: string, alert = false) => {
    page.setTitle(title);
    main.replaceChildren(h("p", alert ? { role: "alert" } : null, text));
  };
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
    main.replaceChildren(
      ...h("div", null, form(set, await context.loadSetup(set), context, page)).childNodes,
    );
  })();
  return page.element;
}

function form(
  set: StoredSet,
  remembered: PracticeSetup | null,
  context: LearnContext,
  page: Frame,
): Node[] {
  const initial = remembered ?? defaultSetup(set);
  const selected = new Set(initial.sectionIds);
  const options = setupOptions(
    initial,
    { term: languageName(set.termLanguage), meaning: languageName(set.meaningLanguage) },
    () => update(),
  );

  const sectionIds = () => set.sections.map((s) => s.id).filter((id) => selected.has(id));
  const available = () => selectedEntryCount(set, sectionIds());
  const setup = (): PracticeSetup => {
    const chosen = options.value();
    return { ...chosen, sectionIds: sectionIds(), count: fitCount(chosen.count, available()) };
  };

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
        { class: "toggles" },
        set.sections.map((section, index) =>
          h(
            "label",
            { class: "toggle" },
            boxes[index],
            h(
              "span",
              null,
              h("span", { class: "title" }, section.title),
              " ",
              h(
                "span",
                { class: "count" },
                String(section.entries.length),
                h(
                  "span",
                  { class: "visually-hidden" },
                  section.entries.length === 1 ? " Vokabel" : " Vokabeln",
                ),
              ),
            ),
          ),
        ),
      ),
      h(
        "div",
        { class: "quick-choice" },
        h("button", { type: "button", class: "textbtn", onclick: () => setAll(true) }, "Alle"),
        h("button", { type: "button", class: "textbtn", onclick: () => setAll(false) }, "Keine"),
      ),
    );

  const status = h("p", { "aria-live": "polite", class: "selection" });
  const problem = h("div", { role: "alert" });
  // In der Aktionsleiste, also außerhalb des Formulars; `form` verbindet beide (TDD 13.7).
  // Mit gemerkter Einrichtung ist „Wie beim letzten Mal“ der Hauptweg, der Start unten zweitrangig.
  const start = h("button", {
    type: "submit",
    form: "setup-form",
    class: remembered ? "secondary" : null,
  });

  const update = () => {
    const total = available();
    options.setAvailable(total);
    const cards = effectiveCount(options.value().count, total);
    status.textContent =
      total === 0
        ? "Wähle mindestens eine Sektion."
        : `${count(total, "Vokabel", "Vokabeln")} ausgewählt.`;
    start.textContent = cards === 0 ? "Lernen" : `${count(cards, "Vokabel", "Vokabeln")} lernen`;
    start.disabled = total === 0;
  };
  update();

  const begin = async (chosen: PracticeSetup, buttons: HTMLButtonElement[]) => {
    for (const button of buttons) button.disabled = true;
    problem.textContent = "";
    try {
      await context.startPractice(set, chosen);
    } catch (error) {
      console.error("Sitzung nicht gestartet", error);
      problem.textContent = failureMessage(error, "Die Lernsitzung wurde nicht gestartet.");
      for (const button of buttons) button.disabled = false;
      update();
    }
  };

  const again: HTMLButtonElement | null =
    remembered &&
    h(
      "button",
      { type: "button", onclick: () => void begin(remembered, [again!, start]) },
      icon("play"),
      h("span", null, "Los geht’s"),
    );
  const quick = remembered && [
    h(
      "section",
      { class: "quick", "aria-labelledby": "setup-again" },
      h("h2", { id: "setup-again" }, "Wie beim letzten Mal"),
      h(
        "ul",
        { class: "pills" },
        describeSetup(set, remembered, languageName).map((part) => h("li", null, part)),
      ),
      again,
    ),
    h("p", { class: "or" }, "oder anpassen"),
  ];

  focusSoon(page.setTitle(set.title));
  page.setDock(start);
  return [
    h("p", { class: "lead" }, "Lernsitzung einrichten"),
    h(
      "p",
      { class: "note" },
      "Hier wählst du selbst aus. Für den Lernstand zählt jede Vokabel einmal am Tag; was noch nicht fällig ist, rückt dadurch nicht weiter. ",
      h("a", { href: "#/help/learning" }, "Wie funktioniert das?"),
    ),
    ...(quick || []),
    h(
      "form",
      {
        id: "setup-form",
        onsubmit: (event: Event) => {
          event.preventDefault();
          void begin(setup(), again ? [again, start] : [start]);
        },
      },
      sections,
      options.direction,
      options.count,
      options.share,
      options.letters,
      status,
    ),
    problem,
  ];
}
