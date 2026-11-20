// Set bearbeiten (TDD 10, 13.1, D-41, D-54): eigene Ansicht neben der Set-Ansicht, die reine Leseansicht
// bleibt. Normal: Sektionen als aufklappbare Karten mit ihren Einträgen (Links zum Formular), Menü „···“
// je Sektion (Umbenennen am Ort, Löschen), „Sektion hinzufügen“ am Ort. Die Reihenfolge ändert ein
// eigener Modus auf einem zusätzlichen Verlaufseintrag (Marke `sorting`, 3.2): Ziehen am Griff,
// gleichwertig Pfeiltasten am Griff und das Menü „···“ am Eintrag; Sektionen mit Auf/Ab. Jede Aktion
// speichert sofort; danach wird neu gezeichnet, und der Fokus bleibt an der bewegten Stelle.
import type { StoredEntry, StoredSection, StoredSet } from "../../domain/model";
import { type Frame, frame } from "../components/frame";
import { openSheet } from "../components/sheet";
import { sortable } from "../components/sortable";
import type { EditOutcome } from "../editSet";
import { type Child, focusSoon, h } from "../dom";
import { icon, type IconName } from "../icons";
import { languageName } from "../languages";
import { hasMark, pushMark } from "../router";

export interface EditSetContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  addSection: (set: StoredSet, title: string) => Promise<EditOutcome>;
  renameSection: (set: StoredSet, sectionId: string, title: string) => Promise<EditOutcome>;
  removeSection: (set: StoredSet, sectionId: string) => Promise<EditOutcome>;
  moveSection: (set: StoredSet, sectionId: string, step: -1 | 1) => Promise<EditOutcome>;
  moveEntry: (set: StoredSet, entryId: string, step: -1 | 1) => Promise<EditOutcome>;
  placeEntry: (
    set: StoredSet,
    entryId: string,
    sectionId: string,
    index: number,
  ) => Promise<EditOutcome>;
}

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";
const SORTING = "sorting";

/** Offene Sektionen je Set, solange die App läuft, damit man nach dem Formular dort weitermacht. */
const openSections = new Map<string, Set<string>>();

/**
 * Wo man je Set ins Formular abgestiegen ist: Schlüssel des Links, Ersatz (falls der Eintrag gelöscht
 * wurde) und sein Abstand zum oberen Fensterrand. Zurück steht der Link wieder dort und hat den Fokus.
 */
const returnPoints = new Map<string, { key: string; fallback: string; top: number }>();

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const entries = (n: number) => count(n, "Eintrag", "Einträge");

export function editSetView(context: EditSetContext, signal: AbortSignal, setId: string): Node {
  const main = h("main", { class: "edit-set" });
  const page = frame({ back: { parent: `#/set/${encodeURIComponent(setId)}` } }, main);
  void context.loadSet().then(
    (set) => {
      if (signal.aborted) return;
      if (set) return editor(set, context, page, main, signal);
      page.setTitle("Set nicht gefunden");
      main.replaceChildren(h("p", null, "Dieses Vokabelset gibt es nicht (mehr)."));
    },
    (error: unknown) => {
      console.error("Set nicht lesbar", error);
      page.setTitle("Set bearbeiten");
      main.replaceChildren(h("p", { role: "alert" }, NOT_LOADED));
    },
  );
  return page.element;
}

function editor(
  loaded: StoredSet,
  context: EditSetContext,
  page: Frame,
  main: HTMLElement,
  signal: AbortSignal,
): void {
  let set = loaded;
  let busy = false;
  // Nach dem Neuladen oder Neuzeichnen auf dem zusätzlichen Eintrag geht es im Sortiermodus weiter.
  let sorting = hasMark(SORTING);
  /** Offene Sektionen; anfangs die erste, nach der Rückkehr aus dem Formular wie zuvor. */
  const open =
    openSections.get(set.id) ?? new Set(set.sections.slice(0, 1).map((section) => section.id));
  openSections.set(set.id, open);
  /** Feld am Ort: Umbenennen einer Sektion oder neue Sektion, mit Meldung darunter. */
  let inline: { kind: "rename"; sectionId: string } | { kind: "add" } | null = null;
  let inlineError = "";
  let inlineValue = "";

  const status = h("p", { "aria-live": "polite", class: "visually-hidden" });
  const problem = h("div", { role: "alert", class: "problem" });
  const body = h("div", { class: "edit-body" });
  main.replaceChildren(status, problem, body);

  const keyed = (key: string) => body.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);

  /**
   * Führt eine Aktion aus und zeichnet danach neu. `focus` nennt die Schlüssel (`data-key`) der
   * Elemente, die danach den Fokus bekommen sollen; das erste, das bedienbar ist, gewinnt.
   */
  const run = async (
    action: () => Promise<EditOutcome>,
    done: string | ((set: StoredSet) => string),
    focus: string[] = [],
  ): Promise<boolean> => {
    if (busy) return false;
    busy = true;
    problem.textContent = "";
    status.textContent = "";
    const outcome = await action();
    busy = false;
    if (signal.aborted) return false;
    if (!outcome.ok) {
      render();
      problem.textContent = outcome.error;
      focusSoon(problem);
      return false;
    }
    set = outcome.set;
    render();
    status.textContent = typeof done === "string" ? done : done(set);
    const target = focus
      .map(keyed)
      .find((element) => element && !(element as HTMLButtonElement).disabled);
    target?.focus();
    return true;
  };

  /** Wo ein Eintrag jetzt steht, für die Meldung nach einer Bewegung. */
  const movedMessage = (entryId: string, from: string) => (changed: StoredSet) => {
    const section = changed.sections.find((item) =>
      item.entries.some((entry) => entry.id === entryId),
    );
    const entry = section?.entries.find((item) => item.id === entryId);
    if (!section || !entry) return "";
    return section.id === from
      ? `„${entry.term.text}“ verschoben.`
      : `„${entry.term.text}“ steht jetzt in „${section.title}“.`;
  };
  const sectionOf = (entryId: string) =>
    set.sections.find((section) => section.entries.some((entry) => entry.id === entryId))!;

  const moveEntry = (entryId: string, step: -1 | 1, focus: string) =>
    run(() => context.moveEntry(set, entryId, step), movedMessage(entryId, sectionOf(entryId).id), [
      focus,
    ]);
  const placeEntry = (entryId: string, sectionId: string, index: number, focus: string) =>
    run(
      () => context.placeEntry(set, entryId, sectionId, index),
      movedMessage(entryId, sectionOf(entryId).id),
      [focus],
    );

  const remember = (event: Event, key: string, fallback: string) => {
    const top = (event.currentTarget as HTMLElement).getBoundingClientRect().top;
    returnPoints.set(set.id, { key, fallback, top });
  };

  /**
   * Zurück aus dem Formular: Der Link steht wieder an seiner Stelle im Fenster und hat den Fokus, statt
   * dass die Überschrift ihn bekommt und die Seite nach oben springt.
   */
  const returnTo = () => {
    const point = returnPoints.get(set.id);
    returnPoints.delete(set.id);
    if (!point || sorting) return;
    const target = keyed(point.key) ?? keyed(point.fallback);
    if (!target) return;
    target.focus({ preventScroll: true });
    scrollBy(0, target.getBoundingClientRect().top - point.top);
  };

  // ---------- Normalmodus ----------

  const openInline = (next: typeof inline, value: string) => {
    inline = next;
    inlineError = "";
    inlineValue = value;
    render();
    const input = body.querySelector<HTMLInputElement>(".inline input");
    input?.focus();
    input?.select();
  };

  const closeInline = (focus: string) => {
    inline = null;
    render();
    keyed(focus)?.focus();
  };

  /** Feld am Ort (kein Blatt, die Bildschirmtastatur verdeckte es); Enter speichert, Escape bricht ab. */
  const inlineForm = (
    id: string,
    label: string,
    submit: string,
    save: (title: string) => Promise<EditOutcome>,
    done: (title: string) => string,
    focusAfter: (changed: StoredSet) => string,
    cancelFocus: string,
    className: string,
  ): Node => {
    const errorId = `${id}-error`;
    const input = h("input", {
      id,
      type: "text",
      value: inlineValue,
      autocomplete: "off",
      enterkeyhint: "done",
      "aria-invalid": inlineError ? "true" : null,
      "aria-describedby": inlineError ? errorId : null,
      oninput: () => (inlineValue = input.value),
      onkeydown: (event: Event) => {
        if ((event as KeyboardEvent).key === "Escape") closeInline(cancelFocus);
      },
    });
    return h(
      "form",
      {
        class: className,
        novalidate: true,
        onsubmit: async (event: Event) => {
          event.preventDefault();
          if (busy) return;
          busy = true;
          const title = input.value.trim();
          const outcome = await save(input.value);
          busy = false;
          if (signal.aborted) return;
          if (!outcome.ok) {
            inlineError = outcome.error;
            render();
            body.querySelector<HTMLInputElement>(".inline input")?.focus();
            return;
          }
          set = outcome.set;
          inline = null;
          render();
          status.textContent = done(title);
          keyed(focusAfter(set))?.focus();
        },
      },
      h(
        "div",
        { class: "inline" },
        h("label", { for: id }, label),
        input,
        inlineError && h("p", { id: errorId, class: "field-error" }, inlineError),
        h(
          "div",
          { class: "inline-actions" },
          h("button", { type: "submit" }, submit),
          h(
            "button",
            { type: "button", class: "textbtn", onclick: () => closeInline(cancelFocus) },
            "Abbrechen",
          ),
        ),
      ),
    );
  };

  const sectionMenu = (section: StoredSection, opener: HTMLElement) => {
    const only = set.sections.length === 1;
    const sheet = openSheet(page.element, {
      title: section.title,
      returnTo: opener,
      content: [
        h(
          "ul",
          { class: "rows" },
          h(
            "li",
            null,
            h(
              "button",
              {
                type: "button",
                onclick: () => {
                  sheet.close();
                  openInline({ kind: "rename", sectionId: section.id }, section.title);
                },
              },
              icon("edit"),
              h("span", null, "Umbenennen"),
            ),
          ),
          !only &&
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
                    removeSection(section, opener);
                  },
                },
                icon("trash"),
                h("span", null, "Sektion löschen"),
              ),
            ),
        ),
        only &&
          h(
            "p",
            { class: "muted" },
            "Die einzige Sektion lässt sich nicht löschen; lösche stattdessen das ganze Set.",
          ),
      ],
    });
  };

  /** Ohne Einträge sofort, sonst mit Rückfrage im Blatt (TDD 10, 13.7). */
  const removeSection = (section: StoredSection, opener: HTMLElement) => {
    const removed = () =>
      run(() => context.removeSection(set, section.id), `Sektion „${section.title}“ gelöscht.`, [
        "section-add",
      ]);
    const n = section.entries.length;
    if (n === 0) return void removed();
    const text = h(
      "p",
      null,
      `Gelöscht werden die Sektion „${section.title}“ und ${entries(n)}. Dein Lernstand zu diesen Einträgen zählt danach nicht mehr.`,
    );
    const sheet = openSheet(page.element, {
      title: "Sektion löschen?",
      focus: text,
      returnTo: opener,
      content: [
        text,
        h(
          "div",
          { class: "actions" },
          h(
            "button",
            { type: "button", class: "secondary", onclick: () => sheet.dismiss() },
            "Abbrechen",
          ),
          h(
            "button",
            {
              type: "button",
              class: "danger",
              onclick: () => {
                sheet.close();
                void removed();
              },
            },
            `Sektion mit ${count(n, "Eintrag", "Einträgen")} löschen`,
          ),
        ),
      ],
    });
  };

  const sectionCard = (section: StoredSection): Node => {
    if (inline?.kind === "rename" && inline.sectionId === section.id)
      return inlineForm(
        `rename-${section.id}`,
        "Name der Sektion",
        "Speichern",
        (title) => context.renameSection(set, section.id, title),
        () => "Sektion umbenannt.",
        () => `section-${section.id}`,
        `section-menu-${section.id}`,
        "edit-section renaming",
      );
    const setPath = encodeURIComponent(set.id);
    const details = h(
      "details",
      // Mit `id`, damit ein Neuzeichnen aus einem anderen Fenster (TDD 3.4) sie offen lässt.
      {
        class: "edit-section",
        id: `edit-section-${section.id}`,
        open: open.has(section.id),
        ontoggle: () => (details.open ? open.add(section.id) : open.delete(section.id)),
      },
      h(
        "summary",
        { "data-key": `section-${section.id}` },
        icon("chevron"),
        h("span", { class: "title" }, section.title),
        " ",
        h("span", { class: "count" }, entries(section.entries.length)),
      ),
      section.entries.length === 0
        ? h("p", { class: "none" }, "Noch keine Einträge.")
        : h(
            "ul",
            { class: "edit-entries" },
            section.entries.map((entry) =>
              h(
                "li",
                null,
                h(
                  "a",
                  {
                    href: `#/entry/${setPath}/${encodeURIComponent(entry.id)}`,
                    "data-key": `entry-${entry.id}`,
                    onclick: (event: Event) =>
                      remember(event, `entry-${entry.id}`, `add-${section.id}`),
                  },
                  // Ein Element, sonst verschluckt der Flex-Container die Leerzeichen um den Strich.
                  h("span", null, pair(entry, set)),
                  icon("edit"),
                ),
              ),
            ),
          ),
      h(
        "div",
        { class: "section-actions" },
        h(
          "a",
          {
            href: `#/new-entry/${setPath}/${encodeURIComponent(section.id)}`,
            class: "textbtn",
            "data-key": `add-${section.id}`,
            onclick: (event: Event) => remember(event, `add-${section.id}`, `add-${section.id}`),
            // Der sichtbare Text steckt im Namen, damit auch Sprachsteuerung ihn findet.
            "aria-label": `Eintrag hinzufügen zu „${section.title}“`,
          },
          icon("plus"),
          h("span", null, "Eintrag hinzufügen"),
        ),
        iconButton(
          "more",
          `Sektion „${section.title}“: weitere Aktionen`,
          `section-menu-${section.id}`,
          (event) => sectionMenu(section, event.currentTarget as HTMLElement),
        ),
      ),
    );
    return details;
  };

  const normal = (): Child[] => {
    const setPath = encodeURIComponent(set.id);
    const facts = [`${languageName(set.termLanguage)} → ${languageName(set.meaningLanguage)}`];
    if (set.level) facts.push(set.level);
    return [
      h(
        "section",
        { class: "panel edit-head", "aria-label": "Angaben" },
        h(
          "div",
          null,
          h("p", { class: "title" }, set.title),
          h("p", { class: "muted" }, facts.join(" · ")),
        ),
        h(
          "a",
          { href: `#/set-info/${setPath}`, class: "action secondary" },
          icon("edit"),
          h("span", null, "Angaben bearbeiten"),
        ),
      ),
      h(
        "p",
        { class: "muted hint" },
        "Tippe auf einen Eintrag, um ihn zu ändern oder zu löschen. Sektionen benennst du über „···“ um.",
      ),
      set.sections.map(sectionCard),
      inline?.kind === "add"
        ? inlineForm(
            "new-section",
            "Name der neuen Sektion",
            "Hinzufügen",
            (title) => context.addSection(set, title),
            (title) => `Sektion „${title}“ hinzugefügt.`,
            (changed) => {
              const added = changed.sections.at(-1)!;
              open.add(added.id);
              return `section-${added.id}`;
            },
            "section-add",
            "edit-section adding",
          )
        : h(
            "button",
            {
              type: "button",
              class: "addcard",
              "data-key": "section-add",
              onclick: () => openInline({ kind: "add" }, ""),
            },
            icon("plus"),
            h("span", null, "Sektion hinzufügen"),
          ),
    ];
  };

  // ---------- Sortiermodus ----------

  const entryMenu = (entry: StoredEntry, opener: HTMLElement) => {
    const section = sectionOf(entry.id);
    const sectionIndex = set.sections.indexOf(section);
    const position = section.entries.indexOf(entry);
    const first = sectionIndex === 0 && position === 0;
    const last =
      sectionIndex === set.sections.length - 1 && position === section.entries.length - 1;
    const choose = (action: () => void) => () => {
      sheet.close();
      action();
    };
    const row = (symbol: IconName, text: string, onclick: () => void, disabled = false) =>
      h(
        "li",
        null,
        h("button", { type: "button", disabled, onclick }, icon(symbol), h("span", null, text)),
      );
    const sheet = openSheet(page.element, {
      title: `„${entry.term.text}“ verschieben`,
      returnTo: opener,
      content: [
        h(
          "ul",
          { class: "rows" },
          row(
            "up",
            "Nach oben",
            choose(() => void moveEntry(entry.id, -1, `menu-${entry.id}`)),
            first,
          ),
          row(
            "down",
            "Nach unten",
            choose(() => void moveEntry(entry.id, 1, `menu-${entry.id}`)),
            last,
          ),
          set.sections.length > 1 &&
            row(
              "move",
              "In andere Sektion …",
              choose(() => sectionChoice(entry, opener)),
            ),
        ),
      ],
    });
  };

  /** Ziel-Sektion wählen; der Eintrag kommt an ihr Ende. */
  const sectionChoice = (entry: StoredEntry, opener: HTMLElement) => {
    const from = sectionOf(entry.id);
    const sheet = openSheet(page.element, {
      title: `„${entry.term.text}“ verschieben`,
      returnTo: opener,
      content: [
        h("p", { class: "muted" }, "Der Eintrag kommt ans Ende der gewählten Sektion."),
        h(
          "ul",
          { class: "rows" },
          set.sections
            .filter((section) => section.id !== from.id)
            .map((section) =>
              h(
                "li",
                null,
                h(
                  "button",
                  {
                    type: "button",
                    onclick: () => {
                      sheet.close();
                      void placeEntry(
                        entry.id,
                        section.id,
                        section.entries.length,
                        `menu-${entry.id}`,
                      );
                    },
                  },
                  icon("move"),
                  h("span", null, section.title),
                ),
              ),
            ),
        ),
      ],
    });
  };

  const sortSection = (section: StoredSection, index: number): Node => {
    const titleId = `sort-title-${section.id}`;
    const sectionStep = (step: -1 | 1) => {
      const [key, other] =
        step < 0
          ? [`section-up-${section.id}`, `section-down-${section.id}`]
          : [`section-down-${section.id}`, `section-up-${section.id}`];
      const direction = step < 0 ? "nach oben" : "nach unten";
      const button = iconButton(
        step < 0 ? "up" : "down",
        `Sektion „${section.title}“ ${direction}`,
        key,
        () =>
          void run(
            () => context.moveSection(set, section.id, step),
            `Sektion „${section.title}“ ${direction} verschoben.`,
            [key, other],
          ),
      );
      button.disabled = step < 0 ? index === 0 : index === set.sections.length - 1;
      return button;
    };
    return h(
      "section",
      { class: "sort-section", "aria-labelledby": titleId },
      h(
        "div",
        { class: "sort-head" },
        h("h2", { id: titleId }, section.title),
        sectionStep(-1),
        sectionStep(1),
      ),
      h(
        "ul",
        { class: "sort-list", "data-section-id": section.id },
        section.entries.map((entry) =>
          h(
            "li",
            { "data-entry-id": entry.id },
            h(
              "button",
              {
                type: "button",
                class: "grip",
                "data-key": `grip-${entry.id}`,
                "aria-label": `„${entry.term.text}“ verschieben: ziehen oder Pfeiltasten`,
                onkeydown: (event: Event) => {
                  const { key } = event as KeyboardEvent;
                  if (key !== "ArrowUp" && key !== "ArrowDown") return;
                  event.preventDefault();
                  void moveEntry(entry.id, key === "ArrowUp" ? -1 : 1, `grip-${entry.id}`);
                },
              },
              icon("grip"),
            ),
            h("span", { class: "pair" }, pair(entry, set)),
            iconButton("more", `„${entry.term.text}“ verschieben`, `menu-${entry.id}`, (event) =>
              entryMenu(entry, event.currentTarget as HTMLElement),
            ),
          ),
        ),
        h("li", { class: "drop-empty", hidden: section.entries.length > 0 }, "Hierher ziehen"),
      ),
    );
  };

  const sortView = (): Child[] => {
    const board = h("div", { class: "sort-board" }, set.sections.map(sortSection));
    sortable(board, {
      signal: drawn.signal,
      drop: (entryId, sectionId, index) =>
        void placeEntry(entryId, sectionId, index, `grip-${entryId}`),
      cancel: () => render(),
    });
    return [
      h(
        "p",
        { class: "hint-row" },
        icon("info"),
        h(
          "span",
          null,
          "Zieh einen Eintrag am Griff an seinen Platz, auch in eine andere Sektion. Ohne Ziehen geht es mit den Pfeiltasten am Griff oder über „···“ am Eintrag; Sektionen verschiebst du mit den Pfeilen. Alles wird sofort gespeichert.",
        ),
      ),
      board,
    ];
  };

  // ---------- Zeichnen und Modus ----------

  /** Listener der vorigen Zeichnung (Ziehen) enden mit ihr. */
  let drawn = new AbortController();

  const render = () => {
    drawn.abort();
    drawn = new AbortController();
    page.setTitle(sorting ? "Reihenfolge ändern" : `${set.title} bearbeiten`);
    // Über `h()`, damit `false` und `null` wie sonst wegfallen.
    body.replaceChildren(...h("div", null, sorting ? sortView() : normal()).childNodes);
    // Solange ein Feld am Ort offen ist, fehlt die Aktionsleiste: Sie stünde über der Tastatur (D-49).
    if (sorting)
      page.setDock(
        h(
          "button",
          { type: "button", onclick: () => history.back() },
          icon("check"),
          h("span", null, "Fertig"),
        ),
      );
    else if (inline) page.setDock();
    else
      page.setDock(
        h(
          "button",
          { type: "button", class: "secondary", onclick: startSorting },
          icon("sort"),
          h("span", null, "Reihenfolge ändern"),
        ),
      );
  };

  const startSorting = () => {
    inline = null;
    pushMark(SORTING);
    switchMode(true);
  };

  const switchMode = (next: boolean) => {
    sorting = next;
    problem.textContent = "";
    render();
    window.scrollTo(0, 0);
    focusSoon(page.setTitle(sorting ? "Reihenfolge ändern" : `${set.title} bearbeiten`));
  };

  // Zurück (Taste, Geste, „Fertig“, App-Leiste) beendet den Modus; Vorwärts öffnet ihn wieder.
  const hash = location.hash;
  window.addEventListener(
    "popstate",
    () => {
      if (location.hash !== hash) return;
      const next = hasMark(SORTING);
      if (next !== sorting) switchMode(next);
    },
    { signal },
  );
  signal.addEventListener("abort", () => drawn.abort());

  render();
  returnTo();
}

function iconButton(
  symbol: IconName,
  label: string,
  key: string,
  onclick: (event: Event) => void,
): HTMLButtonElement {
  return h(
    "button",
    { type: "button", class: "iconbtn", "aria-label": label, "data-key": key, onclick },
    icon(symbol),
  );
}

/** „autumn – Herbst; Spätzeit“, Wort und Bedeutungen in ihrer Sprache. */
function pair(entry: StoredEntry, set: StoredSet): Child[] {
  return [
    h("span", { lang: set.termLanguage }, entry.term.text),
    " – ",
    h(
      "span",
      { lang: set.meaningLanguage },
      entry.meanings.map((meaning) => meaning.text).join("; "),
    ),
  ];
}
