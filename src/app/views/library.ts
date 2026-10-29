import type { StoredSet } from "../../domain/model";
import { groupSets, setSize } from "../../domain/library";
import type { ProtectionNotice } from "../../domain/storageProtection";
import { learnButton } from "../components/learnButton";
import { protectionHint } from "../components/protectionHint";
import { h } from "../dom";
import { languageName } from "../languages";
import type { SampleOutcome } from "../sampleSet";
import { failureMessage } from "../storageMessages";
import { emptyLibrary } from "./emptyLibrary";

export interface LibraryContext {
  /** Welcher Speicherschutz-Hinweis passt (TDD 6.6); hängt davon ab, ob Sets vorhanden sind. */
  protection: (hasSets: boolean) => ProtectionNotice;
  loadSets: () => Promise<StoredSet[]>;
  /** Speichert das Beispielset (Empty State); bei Erfolg wechselt die App zur Set-Ansicht. */
  loadSampleSet: () => Promise<SampleOutcome>;
  /** Meldung aus dem vorigen Schritt, z. B. nach Import oder Löschen; wird beim Abholen geleert. */
  takeMessage: () => string | null;
}

export function libraryView(context: LibraryContext): Node {
  // Hinweise über der Liste (TDD 13.1); sie hängen vom Bestand ab und erscheinen nach dem Laden.
  const hints = h("div", { class: "hints" });
  const sets = h("section", { "aria-label": "Vokabelsets" });
  // Erst nach dem Laden zeigen: Bei leerer Bibliothek bietet der Empty State dieselben Wege an.
  const more = h(
    "div",
    { hidden: true },
    h("p", null, h("a", { href: "#/import", class: "action" }, "Vokabelset importieren")),
    h("p", null, h("a", { href: "#/help" }, "Wie bekomme ich ein Vokabelset?")),
  );
  void showSets(sets, context).then((empty) => {
    more.hidden = empty;
    const hint = protectionHint(context.protection(!empty), !empty);
    if (hint) hints.replaceChildren(hint);
  });
  const text = context.takeMessage();
  const message = text && h("p", { role: "status", class: "message", tabindex: "-1" }, text);
  // Fokus auf die Meldung, sobald die Ansicht eingehängt ist, damit Screenreader sie vorlesen.
  if (message) queueMicrotask(() => message.isConnected && message.focus());
  return h(
    "main",
    null,
    h("h1", null, "Vokabeltrainer"),
    message,
    hints,
    sets,
    more,
    h("p", null, h("a", { href: "#/backup" }, "Backup und Wiederherstellung")),
    h("p", null, h("a", { href: "#/settings" }, "Einstellungen")),
  );
}

/** Liefert `true`, wenn die Bibliothek leer ist und der Empty State erscheint. */
async function showSets(container: HTMLElement, context: LibraryContext): Promise<boolean> {
  let sets: StoredSet[];
  try {
    sets = await context.loadSets();
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    const message = failureMessage(error, "Die Vokabelsets konnten nicht geladen werden.");
    container.replaceChildren(h("p", { role: "alert" }, message));
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
