import type { StoredSet } from "../../domain/model";
import type { PersistenceState } from "../../platform/persistence";
import { h } from "../dom";

export interface LibraryContext {
  persistence: PersistenceState;
  /** Provisorisch für M0 (Messung in S-11), entfällt spätestens mit S-26. */
  requestPersistence: () => Promise<PersistenceState>;
  loadSets: () => Promise<StoredSet[]>;
}

const persistenceText: Record<PersistenceState, string> = {
  granted: "Deine Daten sind auf diesem Gerät dauerhaft geschützt.",
  "not-granted": "Deine Daten sind auf diesem Gerät nicht dauerhaft geschützt.",
  unsupported: "Dieser Browser kann deine Daten nicht dauerhaft schützen.",
};

export function libraryView(context: LibraryContext): Node {
  const status = h("p", { "aria-live": "polite" }, persistenceText[context.persistence]);
  const request = h(
    "button",
    {
      type: "button",
      onclick: async () => {
        request.disabled = true;
        const state = await context.requestPersistence();
        status.textContent = persistenceText[state];
        if (state === "granted") request.remove();
        else request.disabled = false;
      },
    },
    "Dauerhaften Speicher anfordern",
  );
  const sets = h("section", { "aria-label": "Vokabelsets" });
  void showSets(sets, context.loadSets);
  return h(
    "main",
    null,
    h("h1", null, "Vokabeltrainer"),
    sets,
    h("p", null, h("a", { href: "#/import", class: "action" }, "Vokabelset importieren")),
    status,
    context.persistence === "not-granted" && request,
  );
}

/** Minimal für M0; Gruppierung nach Sprache, Set-Ansicht und Löschen folgen mit S-14. */
async function showSets(container: HTMLElement, load: () => Promise<StoredSet[]>): Promise<void> {
  let sets: StoredSet[];
  try {
    sets = await load();
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    container.replaceChildren(h("p", null, "Die Vokabelsets konnten nicht geladen werden."));
    return;
  }
  if (sets.length === 0) {
    container.replaceChildren(h("p", null, "Noch keine Vokabelsets vorhanden."));
    return;
  }
  const sorted = [...sets].sort((a, b) => a.title.localeCompare(b.title, "de"));
  container.replaceChildren(
    h(
      "ul",
      { class: "sets" },
      sorted.map((set) => {
        const count = set.sections.reduce((sum, section) => sum + section.entries.length, 0);
        return h(
          "li",
          null,
          h("span", { class: "title" }, set.title),
          " ",
          h("span", { class: "count" }, count === 1 ? "1 Eintrag" : `${count} Einträge`),
        );
      }),
    ),
  );
}
