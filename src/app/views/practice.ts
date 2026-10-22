// Lernsitzung (TDD 12.2, 12.3, FR-09, FR-10, FR-12) mit Karteikarten und Multiple Choice. Karteikarte:
// Tippen, Enter, Leertaste oder Wischen deckt auf; erst danach bewerten Schaltflächen, Pfeil
// links/rechts oder Wischen. Jede Eingabe löst genau eine Aktion aus. „Beenden“ und die Zurück-Taste
// zeigen den Zwischenstand; Ergebnis und Zwischenstand listen die Fehler mit „Nur Fehler üben“ (D-29).
import type { StoredEntry } from "../../domain/model";
import { cardFaces, currentCard, type Result, sideText } from "../../domain/practice";
import { entryDetails, hasDetails } from "../components/entryDetails";
import { onSwipe } from "../components/swipe";
import { setUpdateBlocked } from "../components/updateNotice";
import { h } from "../dom";
import type { PracticeSession, Question } from "../practice";

const NOT_SAVED = "Die Antwort konnte nicht gespeichert werden. Du kannst trotzdem weiterlernen.";
const NOT_STARTED =
  "Die Lernsitzung konnte nicht gestartet werden. Lade die Seite neu und versuche es noch einmal.";

/** Markiert den zusätzlichen Verlaufseintrag, auf dem die Karten liegen. */
const CARDS = "practice-cards";

/** Tasten, die ein Eingabefeld oder eine fokussierte Schaltfläche selbst behandelt. */
const handledByTarget = (event: KeyboardEvent) =>
  event.target instanceof Element &&
  event.target.closest("input, textarea, select, [contenteditable], button, a") !== null;

export function practiceView(started: PracticeSession | null, signal: AbortSignal): Node {
  // Nach dem Neuladen gibt es keine Sitzung mehr (TDD 12.2).
  if (!started) {
    location.replace("#/");
    return h("main", null);
  }
  // Nach „Nur Fehler üben“ die neue Sitzung; das Set bleibt dasselbe.
  let practice = started;
  // Keine neue App-Version mitten in der Sitzung, auch nicht im Zwischenstand (TAK-12).
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

  // Was gerade zu sehen ist; eine Antwort, die erst danach gespeichert ist, rückt nicht mehr vor.
  let screen: "cards" | "pause" | "result" = "cards";
  let shown = {};
  const show = (next: typeof screen, ...children: Node[]) => {
    onKey = null;
    screen = next;
    shown = {};
    main.replaceChildren(...children);
  };

  // Die Karten liegen auf einem zusätzlichen Verlaufseintrag mit derselben Adresse: Zurück löst so
  // kein `hashchange` aus und führt zum Zwischenstand statt aus der Sitzung (D-29).
  const onCards = () => history.state === CARDS;
  const enterCards = () => {
    if (!onCards()) history.pushState(CARDS, "");
  };
  // Eine Antwort, die gerade gespeichert wird, zählt schon: Zurück direkt danach zeigt den Zwischenstand.
  let saving = false;
  const answered = () => saving || practice.state.firstAttempts > 0;
  window.addEventListener(
    "popstate",
    () => {
      // Zurück auf eine andere Seite: Der Router verlässt die Ansicht.
      if (location.hash !== "#/practice") return;
      if (onCards()) {
        // Vorwärts aus dem Zwischenstand: weiterlernen.
        if (screen === "pause") proceed();
      } else if (screen === "cards" && answered() && !practice.finished) showPause();
      // Ohne Antwort und nach dem Ende gibt es keinen Zwischenstand: gleich weiter zurück.
      else if (screen !== "pause") history.back();
    },
    { signal },
  );

  const proceed = () => (practice.finished ? showResult() : showCard());

  const showCard = () => {
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
        {
          type: "button",
          class: "secondary",
          // Wie die Zurück-Taste; ohne Antwort gleich zur Bibliothek (D-29).
          onclick: () => (answered() ? history.back() : (location.hash = "#/")),
        },
        "Beenden",
      ),
    );
    const title = h("h1", { class: "practice-title" }, set.title);

    /** Speichert die Antwort; erst danach geht es weiter (TDD 12.4). */
    const save = async (result: Result): Promise<boolean> => {
      onKey = null;
      const at = shown;
      saving = true;
      const saved = await practice.answer(result);
      saving = false;
      if (signal.aborted) return false;
      problem.textContent = saved ? "" : NOT_SAVED;
      // Inzwischen zum Zwischenstand gewechselt: mit dem neuen Stand zeigen, statt vorzurücken.
      if (shown !== at && screen === "pause") {
        if (practice.finished) showResult();
        else showPause();
      }
      return shown === at;
    };

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
        show(
          "cards",
          title,
          head,
          side,
          h("div", { class: "rating" }, again, known),
          ...details(entry),
          problem,
        );
        onKey = (event) => {
          if (event.key === "ArrowRight") void rate("correct");
          else if (event.key === "ArrowLeft") void rate("incorrect");
          else return false;
          return true;
        };
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
      show("cards", title, head, front, problem);
      onKey = (event) => {
        if ((event.key !== "Enter" && event.key !== " ") || handledByTarget(event)) return false;
        reveal();
        return true;
      };
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
      show(
        "cards",
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

  const quota = () => {
    const { firstCorrect, firstAttempts } = practice.state;
    return h("p", null, `${firstCorrect} von ${firstAttempts} beim ersten Mal gewusst.`);
  };
  const toLibrary = () =>
    h("p", null, h("a", { href: "#/", class: "action" }, "Zurück zur Bibliothek"));

  /** Die beim Erstversuch falschen Einträge mit „Nur Fehler üben“ (TDD 12.2); leer ohne Fehler. */
  const mistakes = (primary: boolean): Node[] => {
    const { missed } = practice.state;
    if (missed.length === 0) return [];
    const again = async () => {
      repeat.disabled = true;
      let next: PracticeSession;
      try {
        next = await practice.repeatMistakes();
      } catch (error) {
        console.error("Lernsitzung nicht gestartet", error);
        if (!signal.aborted) {
          problem.textContent = NOT_STARTED;
          repeat.disabled = false;
        }
        return;
      }
      practice = next;
      // Inzwischen verlassen: Die neue Sitzung gleich wieder beenden.
      if (signal.aborted) return next.end();
      problem.textContent = "";
      setUpdateBlocked(true);
      enterCards();
      showCard();
    };
    const repeat = h(
      "button",
      { type: "button", class: primary ? null : "secondary", onclick: () => void again() },
      `Nur Fehler üben (${missed.length})`,
    );
    return [
      h("h2", null, "Zum Nachlernen"),
      h(
        "ul",
        { class: "mistakes" },
        missed.map((card) => {
          const entry = practice.entry(card.entryId);
          return h(
            "li",
            null,
            h("span", { class: "term", lang: set.termLanguage }, sideText(entry, "term")),
            " – ",
            h("span", { lang: set.meaningLanguage }, sideText(entry, "meanings")),
          );
        }),
      ),
      h("div", { class: "actions" }, repeat),
    ];
  };

  /** Zwischenstand (FR-12): Die Sitzung läuft weiter, bis sie verlassen wird. */
  const showPause = () => {
    const { queue, total } = practice.state;
    const heading = h("h1", { tabindex: -1 }, "Zwischenstand");
    const resume = h(
      "button",
      {
        type: "button",
        onclick: () => {
          enterCards();
          proceed();
        },
      },
      `Weiterlernen (${queue.length} offen)`,
    );
    show(
      "pause",
      heading,
      quota(),
      h("p", null, `Noch offen: ${queue.length} von ${total} Vokabeln.`),
      h("div", { class: "actions" }, resume),
      ...mistakes(false),
      problem,
      toLibrary(),
    );
    focus(heading);
  };

  const showResult = () => {
    setUpdateBlocked(false);
    const heading = h("h1", { tabindex: -1 }, "Geschafft");
    show("result", heading, quota(), ...mistakes(true), problem, toLibrary());
    focus(heading);
  };

  enterCards();
  showCard();
  return main;
}
