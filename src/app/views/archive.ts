// Archiv (TDD 13.1, FR-43, D-72): archivierte Sets nach Lernstufe, ab zwei Lernstufen mit Filter. Ein
// Set öffnet seine Set-Ansicht; Zurückholen und Lernstufe für mehrere Sets im Auswahlmodus auf einem
// zusätzlichen Verlaufseintrag (Marke `selecting`, wie in der Bibliothek).
import { groupByLevel, type LevelGroup, setSize } from "../../domain/library";
import type { StoredSet } from "../../domain/model";
import type { ArrangeOutcome } from "../archive";
import { filterPills, focusChosen } from "../components/filterPills";
import { frame } from "../components/frame";
import { focusPick, pickCard } from "../components/pickCard";
import { focusSoon, h } from "../dom";
import { icon } from "../icons";
import { languageName } from "../languages";
import { hasMark, pushMark } from "../router";
import { failureMessage } from "../storageMessages";
import { levelHref } from "./library";

export interface ArchiveContext {
  loadSets: () => Promise<StoredSet[]>;
  loadArchived: () => Promise<Set<string>>;
  unarchive: (setIds: string[]) => Promise<ArrangeOutcome>;
  takeMessage: () => string | null;
}

const SELECTING = "selecting";
const TITLE = "Archiv";
const WITHOUT_LEVEL = "Ohne Lernstufe";

/** Auswahl, solange die App läuft: Nach „Lernstufe …“ und Zurück ist sie noch da. */
const picked = new Set<string>();
/** Gewählte Lernstufe des Filters, solange die App läuft; `""` steht für „ohne Lernstufe“. */
let levelFilter: string | null = null;

const levelKey = (group: LevelGroup) => group.level ?? "";

const detail = (set: StoredSet) => {
  const { entries } = setSize(set);
  return `${languageName(set.termLanguage)} · ${entries === 1 ? "1 Eintrag" : `${entries} Einträge`}`;
};

export function archiveView(context: ArchiveContext, signal: AbortSignal): Node {
  const body = h("div", { class: "archive-list" });
  const problem = h("p", { role: "alert", class: "problem" });
  const messageSlot = h("div", { class: "message-slot" });
  const showMessage = (text: string) => {
    const message = h("p", { role: "status", class: "message", tabindex: "-1" }, text);
    messageSlot.replaceChildren(message);
    focusSoon(message);
  };
  const text = context.takeMessage();
  if (text) showMessage(text);
  const lead = h(
    "p",
    { class: "lead" },
    "Hier liegen Sets, die du gerade nicht lernst. Vokabeln und Lernstand bleiben erhalten.",
  );
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
  const page = frame(
    { title: TITLE, back: { parent: "#/" }, actions: [selectButton] },
    h("main", { class: "library archive" }, messageSlot, problem, lead, body),
  );

  let archived: StoredSet[] | null = null;
  let selecting = hasMark(SELECTING);
  if (!selecting) picked.clear();
  const selectionTitle = () => (picked.size === 0 ? "Sets auswählen" : `${picked.size} ausgewählt`);
  const endSelection = () => history.back();

  const unarchive = async (button: HTMLButtonElement) => {
    button.disabled = true;
    problem.replaceChildren();
    const outcome = await context
      .unarchive([...picked])
      .catch((error: unknown): ArrangeOutcome => ({
        ok: false,
        error: failureMessage(error, "Nichts wurde zurückgeholt."),
      }));
    if (!outcome.ok) {
      button.disabled = false;
      problem.textContent = outcome.error;
      return focusSoon(problem);
    }
    picked.clear();
    archived = await load(context).catch(() => archived);
    endSelection();
    showMessage(outcome.message);
  };

  const render = () => {
    if (!archived) return;
    for (const id of picked) if (!archived.some((set) => set.id === id)) picked.delete(id);
    const groups = groupByLevel(archived, languageName);
    if (levelFilter !== null && !groups.some((group) => levelKey(group) === levelFilter))
      levelFilter = null;
    const filter =
      groups.length > 1 &&
      filterPills(
        "Lernstufe",
        [
          { value: null, label: "Alle", count: archived.length },
          ...groups.map((group) => ({
            value: levelKey(group),
            label: group.level ?? WITHOUT_LEVEL,
            count: group.sets.length,
          })),
        ],
        levelFilter,
        (value) => {
          levelFilter = value;
          render();
          focusChosen(body);
        },
      );
    const shown = groups.filter((group) => levelFilter === null || levelKey(group) === levelFilter);
    body.replaceChildren(
      ...(archived.length === 0
        ? [h("p", { class: "muted" }, "Im Archiv liegt nichts.")]
        : [
            filter,
            ...shown.map((group) => levelSection(group, shown.length > 1 || groups.length === 1)),
          ]
      ).filter((node): node is HTMLElement => !!node),
    );
    selectButton.hidden = selecting || archived.length < 2;
    lead.hidden = selecting;
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
          onclick: () => (location.hash = levelHref("archive", picked)),
        },
        "Lernstufe …",
      );
      const restore: HTMLButtonElement = h(
        "button",
        { type: "button", disabled: none, onclick: () => unarchive(restore) },
        "Zurückholen",
      );
      page.setDock(level, restore);
    } else {
      page.setTitle(TITLE);
      page.setBack({ parent: "#/" });
      // Ein einzelnes Set holt man über seine Set-Ansicht zurück (Menü „···“).
      page.setDock();
    }
  };

  const levelSection = (group: LevelGroup, withHeading: boolean) => {
    const name = group.level ?? WITHOUT_LEVEL;
    const ids = group.sets.map((set) => set.id);
    const all = ids.every((id) => picked.has(id));
    const selectAll =
      selecting &&
      h(
        "button",
        {
          type: "button",
          class: "textbtn",
          "data-group": levelKey(group),
          "aria-label": `${all ? "Keine" : "Alle"} aus ${name} auswählen`,
          onclick: () => {
            for (const id of ids) all ? picked.delete(id) : picked.add(id);
            render();
            body
              .querySelector<HTMLElement>(`[data-group="${CSS.escape(levelKey(group))}"]`)
              ?.focus();
          },
        },
        all ? "Keine auswählen" : "Alle auswählen",
      );
    const heading = withHeading && h("h2", { class: "group" }, name);
    return h(
      "section",
      { class: "language", ...(!withHeading && { "aria-label": name }) },
      (heading || selectAll) && h("div", { class: "group-line" }, heading || h("span"), selectAll),
      h(
        "ul",
        { class: "sets" },
        group.sets.map((set) =>
          selecting
            ? pickCard(set, detail(set), picked.has(set.id), (on) => {
                on ? picked.add(set.id) : picked.delete(set.id);
                render();
                focusPick(body, set.id);
              })
            : archivedCard(set),
        ),
      ),
    );
  };

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
    (loaded) => {
      archived = loaded;
      render();
    },
    (error: unknown) => {
      console.error("Archiv nicht lesbar", error);
      body.replaceChildren(
        h("p", { role: "alert" }, failureMessage(error, "Das Archiv konnte nicht geladen werden.")),
      );
    },
  );
  return page.element;
}

async function load(context: ArchiveContext): Promise<StoredSet[]> {
  const [sets, archived] = await Promise.all([context.loadSets(), context.loadArchived()]);
  return sets.filter((set) => archived.has(set.id));
}

/** Ohne Lernen-Knopf und Lernstand: Wer ein archiviertes Set lernen will, öffnet es. */
function archivedCard(set: StoredSet): Node {
  return h(
    "li",
    { class: "setcard" },
    h(
      "div",
      null,
      h("a", { href: `#/set/${encodeURIComponent(set.id)}`, class: "title" }, set.title),
      " ",
      h("span", { class: "count" }, detail(set)),
    ),
  );
}
