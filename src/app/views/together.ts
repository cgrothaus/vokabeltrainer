// Zusammen lernen (TDD 12.10, FR-39, D-69): Sets eines Sprachpaars als Chips, vorausgewählt die
// gemerkte Zusammenstellung. Hauptaktion ist der Plan über die gewählten Sets („Wiederholen (12)“ bzw.
// „Neue Vokabeln lernen“), darunter die freie Auswahl mit Richtung, Anzahl und Anteil für alle
// Sektionen der gewählten Sets.
import { dayNumber } from "../../domain/learningState";
import { groupSets, pairsToCombine } from "../../domain/library";
import type { StoredSet } from "../../domain/model";
import { type PlanSummary, planSummaryAcross } from "../../domain/plan";
import {
  effectiveCount,
  fitCount,
  togetherEntryCount,
  type TogetherSetup,
} from "../../domain/practiceSetup";
import type { SetStats } from "../../domain/stats";
import { frame } from "../components/frame";
import { planText } from "../components/learningStatus";
import { setupOptions } from "../components/setupOptions";
import { focusSoon, h } from "../dom";
import { languageName } from "../languages";
import { failureMessage } from "../storageMessages";

export interface TogetherContext {
  loadSets: () => Promise<StoredSet[]>;
  loadOverview: (set: StoredSet) => Promise<SetStats>;
  /** Vorbelegung für diese Sets: gemerkte Zusammenstellung, sonst alle. */
  loadSetup: (candidates: StoredSet[]) => Promise<TogetherSetup>;
  /** Plan über die Sets; wechselt bei Erfolg zur Sitzung, `false`, wenn nichts dran ist. */
  startPlanned: (sets: StoredSet[]) => Promise<boolean>;
  /** Freie Auswahl; wechselt bei Erfolg zur Sitzung, lehnt ab, wenn das Speichern scheitert. */
  startPractice: (candidates: StoredSet[], setup: TogetherSetup) => Promise<void>;
}

const NOT_LOADED = "Die Vokabelsets konnten nicht geladen werden. Lade die Seite neu.";
const NOT_STARTED = "Die Lernsitzung wurde nicht gestartet.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Sets mit Einträgen und diesem Sprachpaar, in der Reihenfolge der Bibliothek. */
const ofPair = (sets: StoredSet[], term: string, meaning: string) =>
  groupSets(sets, languageName)
    .filter((group) => group.language === term)
    .flatMap(pairsToCombine)
    .find((pair) => pair.meaningLanguage === meaning)?.sets ?? [];

export function togetherView(context: TogetherContext, term: string, meaning: string): Node {
  const main = h("main", { class: "setup together" });
  const page = frame({ title: "Zusammen lernen", back: { parent: "#/" } }, main);
  void (async () => {
    let candidates: StoredSet[];
    let initial: TogetherSetup;
    try {
      candidates = ofPair(await context.loadSets(), term, meaning);
      if (candidates.length < 2) {
        main.replaceChildren(
          h("p", null, "Für dieses Sprachpaar gibt es nicht genug Sets zum Zusammenlernen."),
        );
        return;
      }
      initial = await context.loadSetup(candidates);
    } catch (error) {
      console.error("Sets nicht lesbar", error);
      main.replaceChildren(h("p", { role: "alert" }, NOT_LOADED));
      return;
    }
    // Ist die Ansicht schon verlassen, hängt `main` nirgends mehr; das Ersetzen bleibt dann folgenlos.
    main.replaceChildren(...form(context, page, candidates, initial, term, meaning));
  })();
  return page.element;
}

function form(
  context: TogetherContext,
  page: ReturnType<typeof frame>,
  candidates: StoredSet[],
  initial: TogetherSetup,
  term: string,
  meaning: string,
): Node[] {
  const selected = new Set(initial.setIds);
  const chosenSets = () => candidates.filter((set) => selected.has(set.id));
  const available = () => togetherEntryCount(candidates, [...selected]);
  const options = setupOptions(
    initial,
    { term: languageName(term), meaning: languageName(meaning) },
    () => update(),
  );
  const setup = (): TogetherSetup => {
    const chosen = options.value();
    const setIds = chosenSets().map((set) => set.id);
    return { ...chosen, setIds, count: fitCount(chosen.count, available()) };
  };

  const boxes = candidates.map((set) =>
    h("input", {
      type: "checkbox",
      value: set.id,
      checked: selected.has(set.id),
      onchange: (event: Event) => {
        if ((event.target as HTMLInputElement).checked) selected.add(set.id);
        else selected.delete(set.id);
        update();
      },
    }),
  );
  const setAll = (checked: boolean) => {
    for (const box of boxes) box.checked = checked;
    selected.clear();
    if (checked) for (const set of candidates) selected.add(set.id);
    update();
  };
  const entries = (set: StoredSet) => togetherEntryCount([set], [set.id]);
  const choice = h(
    "fieldset",
    null,
    h("legend", null, "Sets"),
    h(
      "div",
      { class: "toggles" },
      candidates.map((set, index) =>
        h(
          "label",
          { class: "toggle" },
          boxes[index],
          h(
            "span",
            null,
            h("span", { class: "title" }, set.title),
            " ",
            h(
              "span",
              { class: "count" },
              String(entries(set)),
              h(
                "span",
                { class: "visually-hidden" },
                entries(set) === 1 ? " Vokabel" : " Vokabeln",
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

  // Was der Plan über die gewählten Sets anbietet; der Lernstand wird nachgeladen (TDD 12.6).
  const planLine = h("p", { class: "plan", "aria-live": "polite" });
  const status = h("p", { "aria-live": "polite", class: "selection" });
  const problem = h("div", { role: "alert" });
  const start = h("button", { type: "submit", form: "together-form" });
  const planned: HTMLButtonElement = h("button", {
    type: "button",
    class: "plan",
    onclick: () => void beginPlanned(),
  });

  const stats = new Map<string, SetStats>();
  const summary = (): PlanSummary | null => {
    const sets = chosenSets();
    if (sets.length === 0 || sets.some((set) => !stats.has(set.id))) return null;
    const parts = sets.map((set) => ({ set, cards: stats.get(set.id)!.cards }));
    return planSummaryAcross(parts, dayNumber(new Date()));
  };

  let busy = false;
  const update = () => {
    const total = available();
    options.setAvailable(total);
    const cards = effectiveCount(options.value().count, total);
    status.textContent =
      total === 0
        ? "Wähle mindestens ein Set."
        : `${count(total, "Vokabel", "Vokabeln")} ausgewählt.`;
    start.textContent = cards === 0 ? "Lernen" : `${count(cards, "Vokabel", "Vokabeln")} lernen`;
    start.disabled = busy || total === 0;
    const plan = summary();
    planLine.textContent =
      total === 0 ? "" : plan ? (planText(plan) ?? "Nichts fällig.") : "Lernstand wird geladen …";
    const offer = plan !== null && (plan.due > 0 || plan.fresh > 0);
    if (offer) {
      // Silbentrennung erlaubt wie in der Set-Ansicht.
      planned.textContent = plan.due > 0 ? `Wiederholen (${plan.due})` : "Neue Vokabeln lernen";
      planned.disabled = busy;
    }
    // Mit Plan ist er die Hauptaktion, die freie Auswahl zweitrangig (D-63).
    start.classList.toggle("secondary", offer);
    if (offer !== planned.isConnected) page.setDock(...(offer ? [start, planned] : [start]));
  };

  const run = async (action: () => Promise<unknown>) => {
    busy = true;
    problem.textContent = "";
    update();
    try {
      await action();
    } catch (error) {
      console.error("Sitzung nicht gestartet", error);
      problem.textContent = failureMessage(error, NOT_STARTED);
      focusSoon(problem);
    } finally {
      busy = false;
      update();
    }
  };
  const beginPlanned = () =>
    run(async () => {
      // Inzwischen nichts mehr dran, z. B. in einem anderen Tab gelernt.
      if (!(await context.startPlanned(chosenSets()))) {
        problem.textContent = "Nach Plan ist gerade nichts dran. Wähle unten selbst aus.";
      }
    });

  page.setDock(start);
  update();
  for (const set of candidates) {
    context.loadOverview(set).then(
      (loaded) => {
        stats.set(set.id, loaded);
        update();
      },
      (error: unknown) => console.warn("Lernstand nicht verfügbar", error),
    );
  }

  return [
    h("p", { class: "lead" }, `${languageName(term)} → ${languageName(meaning)}`),
    h(
      "form",
      {
        id: "together-form",
        onsubmit: (event: Event) => {
          event.preventDefault();
          void run(() => context.startPractice(candidates, setup()));
        },
      },
      choice,
      planLine,
      h("h2", { class: "own" }, "Selbst auswählen"),
      h(
        "p",
        { class: "note" },
        "Alle Sektionen der gewählten Sets. Für den Lernstand zählt jede Vokabel einmal am Tag; was noch nicht fällig ist, rückt dadurch nicht weiter.",
      ),
      options.direction,
      options.count,
      options.share,
      options.letters,
      status,
    ),
    problem,
  ];
}
