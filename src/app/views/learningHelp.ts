// Hilfe „Wie lerne ich mit dem Plan?“ (TDD 13.1, FR-42, FR-44, D-64, D-74): Karteikasten mit Pausen,
// die drei Stufen des Lernstands, die Übungsformen, Hinweise zum ehrlichen Bewerten und ein Abschnitt für
// Eltern. Der Text beschreibt 12.7 und 12.8 in Alltagssprache; wer dort Zahlen oder Regeln ändert,
// passt ihn und die Fächer-Liste an.
import { frame } from "../components/frame";
import { h } from "../dom";

/** Pause je Fach (TDD 12.7). */
const BOXES = ["1 Tag", "3 Tage", "7 Tage", "14 Tage", "30 Tage"];

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
        "Je weiter hinten eine Vokabel steht, desto länger hat sie Pause. Ist die Pause vorbei, ist sie „fällig“.",
      ),
      h(
        "ol",
        { class: "boxes", "aria-label": "Pause je Fach" },
        BOXES.map((days, index) =>
          h(
            "li",
            { class: index >= 3 ? "safe" : null },
            h("b", null, String(index + 1)),
            h("span", null, `Pause ${days}`),
          ),
        ),
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
    ),
    h(
      "section",
      { "aria-labelledby": "plan-ladder" },
      h("h2", { id: "plan-ladder" }, "Erst erkennen, dann sagen, dann schreiben"),
      h(
        "ol",
        { class: "ladder" },
        h(
          "li",
          null,
          h("small", null, "Neu und erstes Fach"),
          h("b", null, "Multiple Choice"),
          "Du erkennst die richtige Antwort unter mehreren.",
        ),
        h(
          "li",
          null,
          h("small", null, "Ab dem zweiten Fach"),
          h("b", null, "Karteikarte"),
          "Du sagst die Antwort, bevor du aufdeckst.",
        ),
        h(
          "li",
          null,
          h("small", null, "Ab dem vierten Fach, in die Fremdsprache"),
          h("b", null, "Buchstaben"),
          "Du setzt das Wort zusammen und übst die Schreibweise, wie im Vokabeltest.",
        ),
      ),
      h(
        "p",
        null,
        "Jede Stufe ist etwas schwerer als die vorige: Wiedererkennen ist leichter, als selbst draufzukommen, und selbst draufkommen ist leichter, als das Wort richtig zu schreiben. So wächst die Aufgabe mit dem, was du schon kannst.",
      ),
      h(
        "p",
        null,
        "Bei Multiple Choice erkennst du die Antwort nur wieder. Das bringt eine Vokabel höchstens ins dritte Fach. Weiter kommt sie, wenn du sie ohne Auswahl selbst weißt.",
      ),
      h(
        "p",
        null,
        h("b", null, "Sag es laut."),
        " Denkst du die Antwort nur, merkst du oft nicht, dass sie noch wackelt. Sagst du sie laut, bevor du aufdeckst, weißt du genau, ob du sie wirklich wusstest.",
      ),
      h(
        "p",
        null,
        h("b", null, "Tipp ehrlich."),
        " Bei der Karteikarte entscheidest du selbst, ob du die Vokabel gewusst hast. Tipp nur auf „Gewusst“, wenn sie ganz richtig war. Sonst schiebt die App sie zu weit nach hinten, und du vergisst sie, bevor sie wieder drankommt.",
      ),
      h(
        "p",
        null,
        h("b", null, "Nochmal heißt zweimal."),
        " Tippst du auf „Nochmal“, kommt die Karte in dieser Runde wieder. Geschafft ist sie erst, wenn du sie danach zweimal gewusst hast.",
      ),
    ),
    h(
      "section",
      { "aria-labelledby": "plan-directions" },
      h("h2", { id: "plan-directions" }, "Beide Richtungen"),
      h(
        "p",
        null,
        "Beide Richtungen zählen getrennt, zum Beispiel Englisch → Deutsch und Deutsch → Englisch. Im Plan lernst du neue Vokabeln zuerst von der Fremdsprache in deine Sprache. Die Gegenrichtung kommt dazu, sobald die Vokabel im zweiten Fach liegt, du sie also nach einem Tag Pause noch wusstest.",
      ),
      h(
        "p",
        null,
        "Die Gegenrichtung ist schwerer: Ein Wort zu verstehen ist leichter, als selbst darauf zu kommen. Im Vokabeltest brauchst du meist beides.",
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
    h(
      "section",
      { class: "parents", "aria-labelledby": "plan-parents" },
      h("h2", { id: "plan-parents" }, "Für Eltern"),
      h(
        "ul",
        null,
        h(
          "li",
          null,
          "Die App arbeitet mit der ",
          h("b", null, "Lernkartei nach Leitner"),
          ": Vokabeln wandern durch Fächer, und die Pausen dazwischen werden länger. Dahinter stehen zwei gut untersuchte Effekte: verteiltes Wiederholen und das aktive Abrufen aus dem Gedächtnis.",
        ),
        h(
          "li",
          null,
          "Bei der Karteikarte ",
          h("b", null, "bewertet sich das Kind selbst"),
          ". Ehrliches Bewerten ist wichtiger als eine hohe Quote; gemeinsam abfragen und laut antworten lassen hilft dabei.",
        ),
        h(
          "li",
          null,
          h("b", null, "Kurz und regelmäßig"),
          " wirkt besser als lang und selten: lieber jeden Tag zehn Minuten als einmal in der Woche eine Stunde. Die Zahl auf dem runden Knopf zeigt, was heute fällig ist.",
        ),
        h(
          "li",
          null,
          h("b", null, "Vor einer Klassenarbeit"),
          " hilft „Selbst auswählen“: nur die Sektionen der Arbeit, beide Richtungen, mit „Schreiben mit Buchstaben“.",
        ),
        h(
          "li",
          null,
          h("b", null, "„Sicher“ braucht Tage."),
          " Ist eine Vokabel nach einer Woche noch „im Aufbau“, ist das normal und kein Zeichen von schlechtem Lernen.",
        ),
      ),
      h(
        "p",
        { class: "muted" },
        "Wo die Daten liegen und was beim KI-Chat passiert: ",
        h("a", { href: "#/help/about" }, "Über den Vokabeltrainer"),
      ),
    ),
  );
  return frame({ title: "Wie lerne ich mit dem Plan?", back: { parent: "#/" } }, main).element;
}
