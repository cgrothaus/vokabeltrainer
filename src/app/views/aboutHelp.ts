// „Über den Vokabeltrainer“ (TDD 13.1, FR-44, D-74): wo die Daten liegen, was beim KI-Chat passiert
// und wie man lernt, für Kinder und Eltern in kurzen Abschnitten. Erreichbar aus den Einstellungen.
import { frame } from "../components/frame";
import { h } from "../dom";

export function aboutHelpView(): Node {
  const main = h(
    "main",
    { class: "help" },
    h(
      "p",
      { class: "lead" },
      "Fotografiere deine Vokabelliste, lass einen KI-Chat daraus ein Vokabelset machen und lerne es hier mit Karteikarten.",
    ),
    h(
      "section",
      { "aria-labelledby": "about-data" },
      h("h2", { id: "about-data" }, "Deine Daten bleiben hier"),
      h(
        "p",
        null,
        "Vokabeln, Lernstand und Einstellungen liegen nur auf diesem Gerät. Es gibt kein Konto und keinen Server, der etwas von dir speichert. Nach dem ersten Öffnen funktioniert die App auch ohne Internet.",
      ),
      h(
        "p",
        null,
        "Weil alles nur hier liegt, ist es weg, wenn das Gerät verloren geht. Ein Backup sichert alles in einer Datei.",
      ),
      h("a", { class: "action secondary", href: "#/backup" }, "Backup und Wiederherstellung"),
    ),
    h(
      "section",
      { "aria-labelledby": "about-ai" },
      h("h2", { id: "about-ai" }, "Der KI-Chat"),
      h(
        "p",
        null,
        "Die App selbst nutzt keine KI. Das Foto deiner Vokabelliste schickst du an einen KI-Chat deiner Wahl, zum Beispiel ChatGPT, Claude oder Gemini. Für das Foto gelten dann die Regeln dieses Dienstes.",
      ),
      h(
        "p",
        null,
        "Achte darauf, dass auf dem Foto nur die Vokabeln zu sehen sind, nicht dein Name oder andere Seiten aus dem Heft.",
      ),
    ),
    h(
      "section",
      { "aria-labelledby": "about-learn" },
      h("h2", { id: "about-learn" }, "So lernst du"),
      h(
        "p",
        null,
        "Die App plant für jede Vokabel, wann sie wieder drankommt, wie in einem Karteikasten. ",
        h("a", { href: "#/help/learning" }, "Wie lerne ich mit dem Plan?"),
      ),
    ),
    h(
      "section",
      { "aria-labelledby": "about-free" },
      h("h2", { id: "about-free" }, "Kostenlos und offen"),
      h(
        "p",
        null,
        "Der Vokabeltrainer ist kostenlos und ohne Werbung. Sein Quelltext ist öffentlich und darf von allen frei genutzt werden.",
      ),
    ),
  );
  return frame({ title: "Über den Vokabeltrainer", back: { parent: "#/settings" } }, main).element;
}
