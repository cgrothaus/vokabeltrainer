import type { StoredSet } from "../../domain/model";
import { groupSets, setSize } from "../../domain/library";
import type { PersistenceState } from "../../platform/persistence";
import { learnButton } from "../components/learnButton";
import { h } from "../dom";
import { languageName } from "../languages";
import type { SampleOutcome } from "../sampleSet";
import { emptyLibrary } from "./emptyLibrary";

export interface LibraryContext {
  persistence: PersistenceState;
  /** Provisorisch für M0 (Messung in S-11), entfällt spätestens mit S-26. */
  requestPersistence: () => Promise<PersistenceState>;
  loadSets: () => Promise<StoredSet[]>;
  /** Speichert das Beispielset (Empty State); bei Erfolg wechselt die App zur Set-Ansicht. */
  loadSampleSet: () => Promise<SampleOutcome>;
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
  // Erst nach dem Laden zeigen: Bei leerer Bibliothek bietet der Empty State dieselben Wege an.
  const more = h(
    "div",
    { hidden: true },
    h("p", null, h("a", { href: "#/import", class: "action" }, "Vokabelset importieren")),
    h("p", null, h("a", { href: "#/help" }, "Wie bekomme ich ein Vokabelset?")),
  );
  void showSets(sets, context).then((empty) => (more.hidden = empty));
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
    more,
    h("p", null, h("a", { href: "#/backup" }, "Backup und Wiederherstellung")),
    h("p", null, h("a", { href: "#/settings" }, "Einstellungen")),
    status,
    context.persistence === "not-granted" && request,
  );
}

/** Liefert `true`, wenn die Bibliothek leer ist und der Empty State erscheint. */
async function showSets(container: HTMLElement, context: LibraryContext): Promise<boolean> {
  let sets: StoredSet[];
  try {
    sets = await context.loadSets();
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    container.replaceChildren(h("p", null, "Die Vokabelsets konnten nicht geladen werden."));
    return false;
  }
  // Ergibt sich aus dem Bestand, erscheint also auch nach dem Löschen des letzten Sets (TDD 13.1).
  if (sets.length === 0) {
    container.replaceChildren(emptyLibrary(context.loadSampleSet));
    return true;
  }
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
              entries > 0 && learnButton(set),
            );
          }),
        ),
      ])
      .flat(),
  );
  return false;
}
