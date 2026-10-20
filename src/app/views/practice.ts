// Lernsitzung mit Karteikarten (TDD 12.3). In M0 nur Aufdecken per Tippen und Bewerten per Schaltfläche;
// Tastatur und Wischen folgen mit S-18, Zwischenstand, Fehlerliste und „Nur Fehler üben“ mit S-19.
import { cardFaces, currentCard, type Result } from "../../domain/practice";
import { setUpdateBlocked } from "../components/updateNotice";
import { h } from "../dom";
import type { PracticeSession } from "../practice";

const NOT_SAVED = "Die Antwort konnte nicht gespeichert werden. Du kannst trotzdem weiterlernen.";

export function practiceView(practice: PracticeSession | null, signal: AbortSignal): Node {
  // Nach dem Neuladen gibt es keine Sitzung mehr (TDD 12.2).
  if (!practice) {
    location.replace("#/");
    return h("main", null);
  }
  // Keine neue App-Version mitten in der Sitzung (TAK-12).
  setUpdateBlocked(true);
  signal.addEventListener("abort", () => {
    practice.end();
    setUpdateBlocked(false);
  });

  const { set } = practice;
  const main = h("main", { class: "practice" });
  const problem = h("div", { role: "alert" });
  const focus = (element: HTMLElement) => {
    // Beim ersten Anzeigen hängt der Router die Ansicht erst nach der Rückgabe ein.
    if (element.isConnected) element.focus();
    else queueMicrotask(() => element.isConnected && element.focus());
  };

  const showCard = () => {
    const card = currentCard(practice.state)!;
    const faces = cardFaces(practice.entry(card.entryId), card.direction);
    const [promptLanguage, answerLanguage] =
      card.direction === "termToMeaning"
        ? [set.termLanguage, set.meaningLanguage]
        : [set.meaningLanguage, set.termLanguage];
    const { done, total } = practice.state;
    const head = h(
      "div",
      { class: "practice-head" },
      h("p", null, `${done} von ${total} geschafft`),
      h(
        "button",
        { type: "button", class: "secondary", onclick: () => (location.hash = "#/") },
        "Beenden",
      ),
    );
    const title = h("h1", { class: "practice-title" }, set.title);

    const showAnswer = () => {
      const side = h(
        "div",
        { class: "card", tabindex: -1 },
        h("span", { class: "prompt small", lang: promptLanguage }, faces.prompt),
        h("span", { class: "answer", lang: answerLanguage }, faces.answer),
      );
      const rate = async (result: Result) => {
        again.disabled = known.disabled = true;
        // Erst nach dem Speichern erscheint die nächste Karte (TDD 12.4).
        const saved = await practice.answer(result);
        if (signal.aborted) return;
        problem.textContent = saved ? "" : NOT_SAVED;
        if (practice.finished) showResult();
        else showCard();
      };
      const again = h(
        "button",
        { type: "button", class: "secondary", onclick: () => void rate("incorrect") },
        "Nochmal",
      );
      const known = h("button", { type: "button", onclick: () => void rate("correct") }, "Gewusst");
      main.replaceChildren(title, head, side, h("div", { class: "rating" }, again, known), problem);
      focus(side);
    };

    const front = h(
      "button",
      { type: "button", class: "card", onclick: showAnswer },
      h("span", { class: "prompt", lang: promptLanguage }, faces.prompt),
      h("span", { class: "small" }, "Tippen zum Aufdecken"),
    );
    main.replaceChildren(title, head, front, problem);
    focus(front);
  };

  const showResult = () => {
    setUpdateBlocked(false);
    const { firstCorrect, firstAttempts } = practice.state;
    const heading = h("h1", { tabindex: -1 }, "Geschafft");
    main.replaceChildren(
      heading,
      h("p", null, `${firstCorrect} von ${firstAttempts} beim ersten Mal gewusst.`),
      problem,
      h("p", null, h("a", { href: "#/", class: "action" }, "Zurück zur Bibliothek")),
    );
    focus(heading);
  };

  showCard();
  return main;
}
