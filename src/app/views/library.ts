import type { PersistenceState } from "../../platform/persistence";
import { h } from "../dom";

export interface LibraryContext {
  persistence: PersistenceState;
  /** Provisorisch für M0 (Messung in S-11), entfällt spätestens mit S-26. */
  requestPersistence: () => Promise<PersistenceState>;
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
  return h(
    "main",
    null,
    h("h1", null, "Vokabeltrainer"),
    h("p", null, "Noch keine Vokabelsets vorhanden."),
    status,
    context.persistence === "not-granted" && request,
  );
}
