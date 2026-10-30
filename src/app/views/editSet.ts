// Set bearbeiten (TDD 10, 13.1, D-41): eigene Ansicht neben der Set-Ansicht, die reine Leseansicht
// bleibt. Angaben, Sektionen anlegen, umbenennen, verschieben und löschen, Einträge verschieben und zum
// Bearbeiten öffnen. Jede Aktion speichert sofort; danach wird neu gezeichnet und der Fokus bleibt an
// der bewegten Stelle.
import type { StoredEntry, StoredSection, StoredSet } from "../../domain/model";
import type { EditOutcome } from "../editSet";
import { type Child, focusSoon, h } from "../dom";
import { languageName } from "../languages";

export interface EditSetContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  addSection: (set: StoredSet, title: string) => Promise<EditOutcome>;
  renameSection: (set: StoredSet, sectionId: string, title: string) => Promise<EditOutcome>;
  removeSection: (set: StoredSet, sectionId: string) => Promise<EditOutcome>;
  moveSection: (set: StoredSet, sectionId: string, step: -1 | 1) => Promise<EditOutcome>;
  moveEntry: (set: StoredSet, entryId: string, step: -1 | 1) => Promise<EditOutcome>;
}

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const back = () => h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek"));

export function editSetView(context: EditSetContext): Node {
  const main = h("main", { class: "edit-set" });
  void context.loadSet().then(
    (set) => {
      if (set) return main.replaceWith(editor(set, context));
      main.replaceChildren(
        h("h1", null, "Set nicht gefunden"),
        h("p", null, "Dieses Vokabelset gibt es nicht (mehr)."),
        back(),
      );
    },
    (error: unknown) => {
      console.error("Set nicht lesbar", error);
      main.replaceChildren(
        h("h1", null, "Set bearbeiten"),
        h("p", { role: "alert" }, NOT_LOADED),
        back(),
      );
    },
  );
  return main;
}

function editor(loaded: StoredSet, context: EditSetContext): Node {
  let set = loaded;
  let busy = false;
  const heading = h("h1", { class: "set-title" });
  const status = h("p", { "aria-live": "polite", class: "selection" });
  const problem = h("div", { role: "alert" });
  const body = h("div");

  /**
   * Führt eine Aktion aus und zeichnet danach neu. `focus` nennt die Schlüssel (`data-key`) der
   * Elemente, die danach den Fokus bekommen sollen; das erste, das bedienbar ist, gewinnt.
   */
  const run = async (
    action: () => Promise<EditOutcome>,
    done: string,
    focus: string[] = [],
  ): Promise<boolean> => {
    if (busy) return false;
    busy = true;
    problem.textContent = "";
    status.textContent = "";
    const outcome = await action();
    busy = false;
    if (!outcome.ok) {
      problem.textContent = outcome.error;
      focusSoon(problem);
      return false;
    }
    set = outcome.set;
    render();
    status.textContent = done;
    const target = focus
      .map((key) => body.querySelector<HTMLElement>(`[data-key="${key}"]`))
      .find((element) => element && !(element as HTMLButtonElement).disabled);
    if (target) target.focus();
    else focusSoon(status);
    return true;
  };

  /** Auf/Ab-Schaltfläche; `name` nennt das Objekt für Screenreader. */
  const moveButton = (
    key: string,
    step: -1 | 1,
    name: string,
    disabled: boolean,
    move: () => Promise<EditOutcome>,
  ) => {
    const other = key.replace(step < 0 ? "-up-" : "-down-", step < 0 ? "-down-" : "-up-");
    const direction = step < 0 ? "nach oben" : "nach unten";
    return h(
      "button",
      {
        type: "button",
        class: "secondary icon",
        "data-key": key,
        "aria-label": `„${name}“ ${direction}`,
        disabled,
        onclick: () => void run(move, `„${name}“ ${direction} verschoben.`, [key, other]),
      },
      step < 0 ? "↑" : "↓",
    );
  };

  const sectionView = (section: StoredSection, index: number): Node => {
    const setPath = encodeURIComponent(set.id);
    const slot = h("div");
    const only = set.sections.length === 1;
    const titleKey = `section-${section.id}`;

    const rename = () => {
      const id = `rename-${section.id}`;
      const input = h("input", { id, type: "text", value: section.title, autocomplete: "off" });
      slot.replaceChildren(
        h(
          "form",
          {
            class: "confirm",
            onsubmit: (event: Event) => {
              event.preventDefault();
              void run(
                () => context.renameSection(set, section.id, input.value),
                `Sektion umbenannt in „${input.value.trim()}“.`,
                [`section-rename-${section.id}`],
              );
            },
          },
          h("label", { for: id }, "Neuer Titel der Sektion"),
          input,
          h(
            "div",
            { class: "actions" },
            h("button", { type: "submit" }, "Umbenennen"),
            h(
              "button",
              {
                type: "button",
                class: "secondary",
                onclick: () => {
                  slot.replaceChildren();
                  body
                    .querySelector<HTMLElement>(`[data-key="section-rename-${section.id}"]`)
                    ?.focus();
                },
              },
              "Abbrechen",
            ),
          ),
        ),
      );
      input.focus();
      input.select();
    };

    const remove = () => {
      const removed = () =>
        run(() => context.removeSection(set, section.id), `Sektion „${section.title}“ gelöscht.`);
      const entries = section.entries.length;
      if (entries === 0) return void removed();
      const text = h(
        "p",
        null,
        `Gelöscht werden die Sektion „${section.title}“ und ${count(entries, "Eintrag", "Einträge")}. Dein Lernstand zu diesen Einträgen zählt danach nicht mehr.`,
      );
      slot.replaceChildren(
        h(
          "div",
          { class: "confirm" },
          text,
          h(
            "div",
            { class: "actions" },
            h(
              "button",
              { type: "button", onclick: () => void removed() },
              `Sektion mit ${count(entries, "Eintrag", "Einträgen")} löschen`,
            ),
            h(
              "button",
              {
                type: "button",
                class: "secondary",
                onclick: () => {
                  slot.replaceChildren();
                  body
                    .querySelector<HTMLElement>(`[data-key="section-delete-${section.id}"]`)
                    ?.focus();
                },
              },
              "Abbrechen",
            ),
          ),
        ),
      );
      focusSoon(text);
    };

    return h(
      "section",
      { class: "edit-section" },
      h(
        "h2",
        { "data-key": titleKey, tabindex: "-1" },
        section.title,
        " ",
        h("span", { class: "count" }, count(section.entries.length, "Eintrag", "Einträge")),
      ),
      h(
        "div",
        { class: "tools" },
        moveButton(`section-up-${section.id}`, -1, section.title, index === 0, () =>
          context.moveSection(set, section.id, -1),
        ),
        moveButton(
          `section-down-${section.id}`,
          1,
          section.title,
          index === set.sections.length - 1,
          () => context.moveSection(set, section.id, 1),
        ),
        h(
          "button",
          {
            type: "button",
            class: "secondary",
            "data-key": `section-rename-${section.id}`,
            "aria-label": `Umbenennen: „${section.title}“`,
            onclick: rename,
          },
          "Umbenennen",
        ),
        !only &&
          h(
            "button",
            {
              type: "button",
              class: "secondary",
              "data-key": `section-delete-${section.id}`,
              "aria-label": `Löschen: „${section.title}“`,
              onclick: remove,
            },
            "Löschen",
          ),
      ),
      only &&
        h(
          "p",
          { class: "hint-text" },
          "Die einzige Sektion lässt sich nicht löschen; lösche stattdessen das ganze Set.",
        ),
      slot,
      section.entries.length === 0
        ? h("p", null, "Diese Sektion hat noch keine Einträge.")
        : h(
            "ul",
            { class: "edit-entries" },
            section.entries.map((entry, position) =>
              h(
                "li",
                null,
                h(
                  "a",
                  { href: `#/entry/${setPath}/${encodeURIComponent(entry.id)}` },
                  // Ein Element, sonst verschluckt der Flex-Container die Leerzeichen um den Strich.
                  h("span", null, pair(entry, set)),
                ),
                h(
                  "span",
                  { class: "tools" },
                  moveButton(`entry-up-${entry.id}`, -1, entry.term.text, position === 0, () =>
                    context.moveEntry(set, entry.id, -1),
                  ),
                  moveButton(
                    `entry-down-${entry.id}`,
                    1,
                    entry.term.text,
                    position === section.entries.length - 1,
                    () => context.moveEntry(set, entry.id, 1),
                  ),
                ),
              ),
            ),
          ),
      h(
        "p",
        null,
        h(
          "a",
          {
            href: `#/new-entry/${setPath}/${encodeURIComponent(section.id)}`,
            class: "action secondary",
            // Der sichtbare Text steckt im Namen, damit auch Sprachsteuerung ihn findet.
            "aria-label": `Eintrag hinzufügen zu „${section.title}“`,
          },
          "Eintrag hinzufügen",
        ),
      ),
    );
  };

  const addSection = (): Node => {
    const input = h("input", {
      id: "new-section",
      type: "text",
      autocomplete: "off",
      "data-key": "section-add",
    });
    return h(
      "form",
      {
        class: "add-section",
        onsubmit: (event: Event) => {
          event.preventDefault();
          const title = input.value.trim();
          void run(() => context.addSection(set, input.value), `Sektion „${title}“ hinzugefügt.`, [
            "section-add",
          ]);
        },
      },
      h("label", { for: "new-section" }, "Titel der neuen Sektion"),
      input,
      h("button", { type: "submit", class: "secondary" }, "Sektion hinzufügen"),
    );
  };

  const render = () => {
    const setPath = encodeURIComponent(set.id);
    heading.textContent = `${set.title} bearbeiten`;
    body.replaceChildren(
      h(
        "div",
        null,
        h(
          "p",
          { class: "languages" },
          `${languageName(set.termLanguage)} → ${languageName(set.meaningLanguage)}`,
        ),
        h(
          "p",
          null,
          h(
            "a",
            { href: `#/set-info/${setPath}`, class: "action secondary" },
            "Angaben bearbeiten",
          ),
        ),
        h("p", null, "Tippe auf einen Eintrag, um ihn zu ändern oder zu löschen."),
        set.sections.map(sectionView),
        addSection(),
        h("p", null, h("a", { href: `#/set/${setPath}`, class: "action" }, "Fertig")),
      ),
    );
  };
  render();

  return h("main", { class: "edit-set" }, heading, status, problem, body);
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
