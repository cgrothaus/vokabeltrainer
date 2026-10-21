import type { StoredSet } from "../../domain/model";
import { groupSets, setSize } from "../../domain/library";
import type { PersistenceState } from "../../platform/persistence";
import { learnButton } from "../components/learnButton";
import { h } from "../dom";
import { languageName } from "../languages";

export interface LibraryContext {
  persistence: PersistenceState;
  /** Provisorisch für M0 (Messung in S-11), entfällt spätestens mit S-26. */
  requestPersistence: () => Promise<PersistenceState>;
  loadSets: () => Promise<StoredSet[]>;
  /** Legt die Sitzung an und wechselt zu ihr; lehnt ab, wenn das Speichern scheitert. */
  startPractice: (set: StoredSet) => Promise<void>;
  /** Meldung aus dem vorigen Schritt, z. B. nach Import oder Löschen; wird beim Abholen geleert. */
  takeMessage: () => string | null;
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
  void showSets(sets, context);
  const text = context.takeMessage();
  const message = text && h("p", { role: "status", class: "message", tabindex: "-1" }, text);
  // Fokus auf die Meldung, sobald die Ansicht eingehängt ist, damit Screenreader sie vorlesen.
  if (message) queueMicrotask(() => message.isConnected && message.focus());
  return h(
    "main",
    null,
    h("h1", null, "Vokabeltrainer"),
    message,
    sets,
    h("p", null, h("a", { href: "#/import", class: "action" }, "Vokabelset importieren")),
    h("p", null, h("a", { href: "#/backup" }, "Backup und Wiederherstellung")),
    status,
    context.persistence === "not-granted" && request,
  );
}

async function showSets(container: HTMLElement, context: LibraryContext): Promise<void> {
  let sets: StoredSet[];
  try {
    sets = await context.loadSets();
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    container.replaceChildren(h("p", null, "Die Vokabelsets konnten nicht geladen werden."));
    return;
  }
  // Empty State mit Hilfe und Beispielset folgt mit S-15; er erscheint auch nach dem Löschen.
  if (sets.length === 0) {
    container.replaceChildren(h("p", null, "Noch keine Vokabelsets vorhanden."));
    return;
  }
  const problem = h("div", { role: "alert" });
  container.replaceChildren(
    ...groupSets(sets, languageName)
      .map((group) => [
        h("h2", { class: "group" }, group.name),
        h(
          "ul",
          { class: "sets" },
          group.sets.map((set) => {
            const { entries } = setSize(set);
            const count = entries === 1 ? "1 Eintrag" : `${entries} Einträge`;
            return h(
              "li",
              null,
              h(
                "div",
                null,
                h("a", { href: `#/set/${encodeURIComponent(set.id)}`, class: "title" }, set.title),
                " ",
                h("span", { class: "count" }, set.level ? `${set.level} · ${count}` : count),
              ),
              entries > 0 && learnButton(set, context.startPractice, problem),
            );
          }),
        ),
      ])
      .flat(),
    problem,
  );
}
