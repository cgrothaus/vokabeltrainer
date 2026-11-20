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
      "Die App merkt sich für jede Vokabel, wie sicher du sie kannst, und fragt sie genau dann wieder ab, wenn es sich lohnt.",
    ),
    h(
      "section",
      { "aria-labelledby": "plan-box" },
      h("h2", { id: "plan-box" }, "Der Karteikasten"),
      h(
        "p",
        null,
        "Stell dir einen Karteikasten mit fünf Fächern vor. Jede Vokabel beginnt vorn. Weißt du sie, rückt sie ein Fach weiter, weißt du sie nicht, geht sie zurück ins erste Fach.",
      ),
      h(
        "p",
        null,
        "Je weiter hinten, desto länger darfst du sie in Ruhe lassen: nach 1, 3, 7, 14 und 30 Tagen kommt sie wieder dran. Dass du dich nach ein paar Tagen erst wieder anstrengen musst, sie dir einzufallen, ist gewollt: So prägt sie sich am besten ein.",
      ),
    ),
    h(
      "section",
      { "aria-labelledby": "plan-stages" },
      h("h2", { id: "plan-stages" }, "neu, im Aufbau, sicher"),
      h(
        "ul",
        null,
        h("li", null, h("b", null, "neu"), ": Du hast diese Vokabel noch nie beantwortet."),
        h(
          "li",
          null,
          h("b", null, "im Aufbau"),
          ": Du hast sie schon geübt, sie ist aber noch in den ersten Fächern.",
        ),
        h(
          "li",
          null,
          h("b", null, "sicher"),
          ": Du hast sie an mehreren Tagen hintereinander gewusst, zuletzt nach einer längeren Pause.",
        ),
      ),
      h(
        "p",
        null,
        "Eine Vokabel wird deshalb nicht an einem Tag „sicher“, auch wenn du sie zehnmal richtig hast: Pro Tag zählt die erste Antwort, und weiter geht es erst nach dem Abstand. Das ist kein Fehler der App, sondern der Weg, auf dem man sich Vokabeln dauerhaft merkt.",
      ),
      h(
        "p",
        null,
        "Englisch → Deutsch und Deutsch → Englisch zählen getrennt. Die Gegenrichtung kommt dazu, sobald die erste sitzt.",
      ),
    ),
    h(
      "section",
      { "aria-labelledby": "plan-ways" },
      h("h2", { id: "plan-ways" }, "Wiederholen, Neues, Selbst auswählen"),
      h(
        "ul",
        null,
        h(
          "li",
          null,
          h("b", null, "Wiederholen (12)"),
          ": Die App stellt dir die Vokabeln zusammen, die heute dran sind, die am längsten überfälligen zuerst.",
        ),
        h(
          "li",
          null,
          h("b", null, "Neue Vokabeln lernen"),
          ": Ist nichts fällig, nimmt die App neue aus dem Set.",
        ),
        h(
          "li",
          null,
          h("b", null, "Selbst auswählen"),
          ": Du bestimmst Sektionen, Richtung und Anzahl, zum Beispiel vor einer Klassenarbeit. Auch das zählt für den Lernstand, aber Vokabeln, die noch nicht fällig sind, rücken dadurch nicht weiter.",
        ),
      ),
      h(
        "p",
        null,
        "Ändert sich ein Eintrag im Set, zum Beispiel durch eine Korrektur, ist er sofort wieder fällig.",
      ),
    ),
  );
  return frame({ title: "Wie lerne ich mit dem Plan?", back: { parent: "#/" } }, main).element;
}
