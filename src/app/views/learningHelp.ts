// Hilfe „Wie lerne ich mit dem Plan?“ (TDD 13.1, FR-42, D-64): Karteikasten, Abstände, die drei Stufen
// des Lernstands und der Unterschied zwischen dem Plan und „Selbst auswählen“. Der Text beschreibt
// 12.7 und 12.8 in Alltagssprache; wer dort Zahlen oder Regeln ändert, passt ihn an.
import { frame } from "../components/frame";
import { h } from "../dom";

export function learningHelpView(): Node {
  const main = h(
    "main",
    { class: "help" },
    h(
      "p",
      { class: "lead" },
      "Die App merkt sich für jede Vokabel, wie gut du sie kannst, und plant, wann sie wieder drankommt: nicht zu früh, damit du dich anstrengen musst, und nicht zu spät, damit du sie nicht vergisst.",
    ),
    h(
      "section",
      { "aria-labelledby": "plan-box" },
      h("h2", { id: "plan-box" }, "Der Karteikasten"),
      h(
        "p",
        null,
        "Stell dir einen Karteikasten mit fünf Fächern vor. Beim ersten Abfragen kommt jede Vokabel ins erste Fach. Weißt du sie, wenn sie wieder dran ist, rückt sie ein Fach weiter. Weißt du sie nicht, geht sie zurück ins erste Fach.",
      ),
      h(
        "p",
        null,
        "Je weiter hinten eine Vokabel steht, desto länger hat sie Pause: Aus dem ersten Fach ist sie nach einem Tag wieder dran, aus den nächsten nach 3, 7, 14 und 30 Tagen. Dann ist sie „fällig“.",
      ),
      h(
        "p",
        null,
        "Nach ein paar Tagen Pause fällt dir eine Vokabel oft erst nach kurzem Nachdenken wieder ein. Das ist gewollt: Gerade dieses Erinnern hilft dir, sie dauerhaft zu behalten.",
      ),
    ),
    h(
      "section",
      { "aria-labelledby": "plan-stages" },
      h("h2", { id: "plan-stages" }, "Neu, im Aufbau, sicher"),
      h(
        "ul",
        null,
        h("li", null, h("b", null, "neu"), ": Du hast diese Vokabel noch nie beantwortet."),
        h("li", null, h("b", null, "im Aufbau"), ": Sie liegt in einem der ersten drei Fächer."),
        h(
          "li",
          null,
          h("b", null, "sicher"),
          ": Sie liegt im vierten oder fünften Fach. Du hast sie also an mehreren Tagen mit wachsendem Abstand gewusst, zuletzt nach mindestens einer Woche Pause.",
        ),
      ),
      h(
        "p",
        null,
        "Deshalb wird eine Vokabel nicht an einem Tag „sicher“, auch wenn du sie zehnmal richtig beantwortest: Pro Tag zählt nur die erste Antwort, und ins nächste Fach rückt sie erst, wenn ihre Pause vorbei ist. Das ist kein Fehler der App, sondern der Weg, auf dem man sich Vokabeln dauerhaft merkt.",
      ),
      h(
        "p",
        null,
        "Bei Multiple Choice erkennst du die Antwort nur wieder. Das bringt eine Vokabel höchstens ins dritte Fach. Weiter kommt sie, wenn du sie ohne Auswahl selbst weißt.",
      ),
      h(
        "p",
        null,
        "Deshalb fragt dich der Plan neue Vokabeln und solche im ersten Fach als Multiple Choice ab. Ab dem zweiten Fach kommen sie als Karteikarte: Dann sagst du die Antwort selbst, bevor du aufdeckst. Ab dem vierten Fach setzt du sie in Richtung Fremdsprache aus Buchstaben zusammen und übst so die Schreibweise, wie sie im Vokabeltest verlangt wird.",
      ),
      h(
        "p",
        null,
        "Beide Richtungen zählen getrennt, zum Beispiel Englisch → Deutsch und Deutsch → Englisch. Im Plan lernst du neue Vokabeln zuerst von der Fremdsprache in deine Sprache. Die Gegenrichtung kommt dazu, sobald die Vokabel im zweiten Fach liegt, du sie also nach einem Tag Pause noch wusstest.",
      ),
    ),
    h(
      "section",
      { "aria-labelledby": "plan-ways" },
      h("h2", { id: "plan-ways" }, "Drei Wege zum Lernen"),
      h(
        "ul",
        null,
        h(
          "li",
          null,
          h("b", null, "Wiederholen"),
          ": Die App stellt dir die Vokabeln zusammen, die heute fällig sind, höchstens 30, die am längsten überfälligen zuerst. Ist noch Platz, kommen ein paar neue dazu. Die Zahl auf dem Knopf sagt, wie viele fällig sind.",
        ),
        h(
          "li",
          null,
          h("b", null, "Neue Vokabeln lernen"),
          ": Ist nichts fällig, nimmt die App zehn neue aus dem Set, der Reihe nach.",
        ),
        h(
          "li",
          null,
          h("b", null, "Selbst auswählen"),
          ": Du bestimmst Sektionen, Richtung, Anzahl und den Anteil an Multiple Choice, zum Beispiel vor einer Klassenarbeit. Mit „Schreiben mit Buchstaben“ setzt du in Richtung Fremdsprache die Wörter zusammen, statt Karten aufzudecken. Auch das zählt für den Lernstand: Weißt du eine Vokabel nicht, geht sie zurück ins erste Fach. Weißt du eine, die noch nicht fällig ist, rückt sie dadurch aber nicht weiter.",
        ),
      ),
      h(
        "p",
        null,
        "Änderst du eine Vokabel, zum Beispiel weil sie falsch eingetragen war, ist sie sofort wieder fällig. Ihr Fach behält sie.",
      ),
    ),
  );
  return frame({ title: "Wie lerne ich mit dem Plan?", back: { parent: "#/" } }, main).element;
}
