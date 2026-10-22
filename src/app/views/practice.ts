// Lernsitzung (TDD 12.3, FR-09) mit Karteikarten und Multiple Choice. Karteikarte: Tippen, Enter,
// Leertaste oder Wischen deckt auf; erst danach bewerten Schaltflächen, Pfeil links/rechts oder Wischen.
// Jede Eingabe löst genau eine Aktion aus. Zwischenstand, Fehlerliste und „Nur Fehler üben“ folgen mit S-19.
import type { StoredEntry } from "../../domain/model";
import { cardFaces, currentCard, type Result } from "../../domain/practice";
import { entryDetails, hasDetails } from "../components/entryDetails";
import { onSwipe } from "../components/swipe";
import { setUpdateBlocked } from "../components/updateNotice";
import { h } from "../dom";
import type { PracticeSession, Question } from "../practice";

const NOT_SAVED = "Die Antwort konnte nicht gespeichert werden. Du kannst trotzdem weiterlernen.";

/** Tasten, die ein Eingabefeld oder eine fokussierte Schaltfläche selbst behandelt. */
const handledByTarget = (event: KeyboardEvent) =>
  event.target instanceof Element &&
  event.target.closest("input, textarea, select, [contenteditable], button, a") !== null;

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

  // Tastenkürzel der gerade gezeigten Karte; liefert `true`, wenn die Taste etwas ausgelöst hat.
  let onKey: ((event: KeyboardEvent) => boolean) | null = null;
  document.addEventListener(
    "keydown",
    (event) => {
      // Eine gehaltene Taste löst nur einmal aus (FR-09).
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (onKey?.(event)) event.preventDefault();
    },
    { signal },
  );

  const details = (entry: StoredEntry): Node[] =>
    hasDetails(entry) ? [h("div", { class: "details" }, entryDetails(entry, set))] : [];

  const showCard = () => {
    onKey = null;
    const card = currentCard(practice.state)!;
    const entry = practice.entry(card.entryId);
    const faces = cardFaces(entry, card.direction);
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

    /** Speichert die Antwort; erst danach geht es weiter (TDD 12.4). */
    const save = async (result: Result): Promise<boolean> => {
      onKey = null;
      const saved = await practice.answer(result);
      if (!signal.aborted) problem.textContent = saved ? "" : NOT_SAVED;
      return !signal.aborted;
    };
    const proceed = () => (practice.finished ? showResult() : showCard());

    const showFlashcard = () => {
      let revealed = false;
      const reveal = () => {
        // Ein Klick nach einer Wischgeste darf nicht ein zweites Mal aufdecken.
        if (revealed) return;
        revealed = true;
        showAnswer();
      };

      const showAnswer = () => {
        let rating = false;
        const rate = async (result: Result) => {
          if (rating) return;
          rating = true;
          again.disabled = known.disabled = true;
          if (await save(result)) proceed();
        };
        const side = h(
          "div",
          { class: "card swipeable", tabindex: -1 },
          h("span", { class: "prompt small", lang: promptLanguage }, faces.prompt),
          h("span", { class: "answer", lang: answerLanguage }, faces.answer),
          h("span", { class: "small" }, "← Nochmal · Gewusst →"),
        );
        // Eine neue Geste auf der Rückseite bewertet: rechts „Gewusst“, links „Nochmal“.
        onSwipe(
          side,
          (direction) => void rate(direction === "right" ? "correct" : "incorrect"),
          true,
        );
        const again = h(
          "button",
          { type: "button", class: "secondary", onclick: () => void rate("incorrect") },
          "Nochmal",
        );
        const known = h(
          "button",
          { type: "button", onclick: () => void rate("correct") },
          "Gewusst",
        );
        onKey = (event) => {
          if (event.key === "ArrowRight") void rate("correct");
          else if (event.key === "ArrowLeft") void rate("incorrect");
          else return false;
          return true;
        };
        main.replaceChildren(
          title,
          head,
          side,
          h("div", { class: "rating" }, again, known),
          ...details(entry),
          problem,
        );
        // Fokus auf die Antwort, nicht auf eine Schaltfläche: Ein gehaltenes Enter bewertet so nicht.
        focus(side);
      };

      const front = h(
        "button",
        { type: "button", class: "card", onclick: reveal },
        h("span", { class: "prompt", lang: promptLanguage }, faces.prompt),
        h("span", { class: "small" }, "Tippen zum Aufdecken"),
      );
      // Wischen vor dem Aufdecken deckt nur auf, in beide Richtungen (FR-09).
      onSwipe(front, reveal);
      onKey = (event) => {
        if ((event.key !== "Enter" && event.key !== " ") || handledByTarget(event)) return false;
        reveal();
        return true;
      };
      main.replaceChildren(title, head, front, problem);
      focus(front);
    };

    const showChoice = (question: Extract<Question, { mode: "multipleChoice" }>) => {
      const prompt = h(
        "div",
        { class: "card question", tabindex: -1 },
        h("span", { class: "small" }, "Multiple Choice"),
        h("span", { class: "prompt", lang: promptLanguage }, faces.prompt),
      );
      const feedback = h("p", { class: "feedback", "aria-live": "polite" });
      const after = h("div", null);
      const pick = async (index: number) => {
        for (const option of options) option.disabled = true;
        const right = index === question.correct;
        // Markiert mit Zeichen und Rahmen, nicht nur mit Farbe (TDD 13.4).
        options[question.correct]!.classList.add("right");
        options[question.correct]!.prepend(h("span", { class: "mark" }, "✓ "));
        if (!right) {
          options[index]!.classList.add("wrong");
          options[index]!.prepend(h("span", { class: "mark" }, "✗ "));
        }
        feedback.textContent = right
          ? "Richtig."
          : `Leider falsch. Richtig ist: ${question.options[question.correct]}`;
        if (!(await save(right ? "correct" : "incorrect"))) return;
        const next = h("button", { type: "button", onclick: proceed }, "Weiter");
        after.replaceChildren(...details(entry), h("div", { class: "actions" }, next));
        focus(next);
      };
      const options = question.options.map((option, index) =>
        h(
          "button",
          {
            type: "button",
            class: "option",
            lang: answerLanguage,
            onclick: () => void pick(index),
          },
          option,
        ),
      );
      main.replaceChildren(
        title,
        head,
        prompt,
        h("div", { class: "options" }, options),
        feedback,
        after,
        problem,
      );
      focus(prompt);
    };

    const question = practice.question();
    if (question.mode === "multipleChoice") showChoice(question);
    else showFlashcard();
  };

  const showResult = () => {
    onKey = null;
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
