// Empty State der Bibliothek (TDD 13.1, FR-28, AK-14): erklärt knapp die App und zeigt den nächsten
// Schritt. „Leeres Set anlegen“ folgt mit S-31.
import { sampleSetButton } from "../components/sampleSetButton";
import { h } from "../dom";
import type { SampleOutcome } from "../sampleSet";

export function emptyLibrary(loadSampleSet: () => Promise<SampleOutcome>): Node {
  const problem = h("div", { role: "alert" });
  return h(
    "div",
    { class: "empty" },
    h("h2", null, "Noch keine Vokabelsets"),
    h(
      "p",
      null,
      "Mit dieser App lernst du Vokabeln mit Karteikarten. Deine Vokabeln holst du dir aus einem Foto deiner Vokabelliste: Ein KI-Chat macht daraus ein Vokabelset, das du hier einfügst.",
    ),
    h("p", null, h("a", { href: "#/import", class: "action" }, "Erstes Vokabelset importieren")),
    h("p", null, sampleSetButton(loadSampleSet, problem)),
    problem,
    h("p", null, h("a", { href: "#/help" }, "Wie bekomme ich ein Vokabelset?")),
  );
}
