// Empty State der Bibliothek (TDD 13.1, FR-28, AK-14): Kartenstapel, ein Satz zur App und zur lokalen
// Datenhaltung, der nächste Schritt und das Beispielset; darunter Hilfe, „Leeres Set anlegen“ (FR-02)
// und der Weg, ein Backup von einem anderen Gerät zu laden.
import { sampleSetButton } from "../components/sampleSetButton";
import { h } from "../dom";
import { icon, type IconName } from "../icons";
import type { SampleOutcome } from "../sampleSet";

/** Zeile mit Symbol und Pfeil zur Navigation (TDD 13.7). */
function row(href: string, symbol: IconName, label: string): Node {
  return h("li", null, h("a", { href }, icon(symbol), h("span", null, label), icon("chevron")));
}

export function emptyLibrary(loadSampleSet: () => Promise<SampleOutcome>): Node {
  const problem = h("div", { role: "alert" });
  return h(
    "div",
    { class: "empty" },
    h(
      "div",
      { class: "hero" },
      // Drei Karteikarten im Leitmotiv, die vorderste sagt „Hallo!“; reiner Schmuck.
      h(
        "div",
        { class: "stack-cards", "aria-hidden": "true" },
        h("span", null),
        h("span", null),
        h("span", { lang: "en" }, "Hello!"),
      ),
      h("h2", { class: "display" }, "Lerne Vokabeln mit Karteikarten"),
      h(
        "p",
        { class: "lead" },
        "Mach ein Foto von deiner Vokabelliste. Ein KI-Chat macht daraus ein Vokabelset, und du fügst es hier ein. Deine Vokabeln bleiben auf diesem Gerät.",
      ),
    ),
    h(
      "div",
      { class: "start" },
      h(
        "a",
        { href: "#/import", class: "action" },
        icon("plus"),
        h("span", null, "Erstes Vokabelset hinzufügen"),
      ),
      sampleSetButton(loadSampleSet, problem),
    ),
    problem,
    h(
      "ul",
      { class: "rows" },
      row("#/help", "help", "Wie bekomme ich ein Vokabelset?"),
      row("#/new-set", "edit", "Leeres Set anlegen und selbst tippen"),
      row("#/backup", "restore", "Backup von einem anderen Gerät laden"),
    ),
  );
}
