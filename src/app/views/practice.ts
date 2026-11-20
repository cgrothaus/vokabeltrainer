// Lernsitzung (TDD 12.2, 12.3, FR-09, FR-10, FR-12) mit Karteikarten und Multiple Choice. Karteikarte:
// Tippen, Enter, Leertaste oder Wischen deckt auf, die Karte wendet sich; erst danach bewerten die
// Schaltflächen unten, Pfeil links/rechts oder Wischen. Jede Eingabe löst genau eine Aktion aus.
// „Beenden“ und die Zurück-Taste zeigen den Zwischenstand als Blatt über der Karte (D-51); das
// Ergebnis listet die Fehler mit „Nur Fehler üben“ (D-29).
import type { StoredEntry } from "../../domain/model";
import { cardFaces, currentCard, type Result, sideText } from "../../domain/practice";
import { entryDetails, hasDetails } from "../components/entryDetails";
import { frame } from "../components/frame";
import { openSheet, type Sheet } from "../components/sheet";
import { speakButton } from "../components/speakButton";
import { flyOut, onSwipe, type SwipeDirection } from "../components/swipe";
import { setUpdateBlocked } from "../components/updateNotice";
import { focusSoon, h } from "../dom";
import { icon } from "../icons";
import { languageName } from "../languages";
import type { PracticeSession, Question } from "../practice";
import { hasMark, pushMark, replaceRoute } from "../router";
import { failureMessage } from "../storageMessages";
import { type Say, stopSpeaking } from "../../platform/speech";

/** Markiert den zusätzlichen Verlaufseintrag, auf dem die Karten liegen. */
const CARDS = "practice-cards";

const SVG = "http://www.w3.org/2000/svg";

/** Pause vor den Antworten bei Multiple Choice in Millisekunden (TDD 12.3, D-60). */
const CHOICE_DELAY = 3000;

/** Sperre, bevor eine Karte aufgedeckt werden kann, in Millisekunden: gegen Durchrasen (TDD 12.3). */
const REVEAL_LOCK = 500;

/** Tasten, die ein Eingabefeld oder eine fokussierte Schaltfläche selbst behandelt. */
const handledByTarget = (event: KeyboardEvent) =>
  event.target instanceof Element &&
  event.target.closest("input, textarea, select, [contenteditable], button, a") !== null;

/** Vorlesen der Lernsprache (TDD 12.11, D-61). */
export interface PracticeSpeech {
  /** Vorlesen in der Sprache, `null` ohne passende Stimme. */
  speaker: (lang: string) => Promise<Say | null>;
  /** „Automatisch vorlesen“ aus den Einstellungen. */
  auto: () => boolean;
}

export function practiceView(
  started: PracticeSession | null,
  signal: AbortSignal,
  speech: PracticeSpeech,
): Node {
  // Nach dem Neuladen gibt es keine Sitzung mehr (TDD 12.2).
  if (!started) {
    replaceRoute("#/");
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

  // Vorlesen nur der Lernsprache (TDD 12.11): Der Knopf erscheint, sobald das Wort zu sehen ist und die
  // Stimme bereitsteht. Automatisch nur im Klick, der das Wort zeigt; iOS spricht sonst nicht.
  let say: Say | null = null;
  let offered: { slot: HTMLElement; text: string } | null = null;
  const offerSpeech = (slot: HTMLElement, text: string) => {
    offered = { slot, text };
    if (!say) return;
    slot.replaceChildren(speakButton(text, say));
    if (speech.auto()) say(text);
  };
  void speech.speaker(set.termLanguage).then((found) => {
    say = found;
    // Die erste Karte steht meist schon da, bevor die Stimme bereit ist: für sie nachholen.
    if (found && offered?.slot.isConnected) offerSpeech(offered.slot, offered.text);
  });
  signal.addEventListener("abort", stopSpeaking);
  // Fortschritt statt Titel in der App-Leiste; die `h1` mit dem Set-Titel bleibt für Screenreader.
  const fill = h("span", null);
  const count = h("span", { class: "count", id: "practice-count" });
  const bar = h(
    "span",
    {
      class: "progress",
      role: "progressbar",
      "aria-labelledby": "practice-count",
      "aria-valuemin": 0,
    },
    fill,
  );
  const progress = h("div", { class: "session-progress" }, bar, count);
  const page = frame({ actions: [progress] }, main);
  const problem = h("div", { role: "alert" });
  // Tastenkürzel der gerade gezeigten Karte; liefert `true`, wenn die Taste etwas ausgelöst hat.
  let onKey: ((event: KeyboardEvent) => boolean) | null = null;
  document.addEventListener(
    "keydown",
    (event) => {
      // Eine gehaltene Taste löst nur einmal aus (FR-09); unter dem Zwischenstand ruht die Karte.
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (screen !== "cards") return;
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
    offered = null;
    main.replaceChildren(...children);
  };

  // Die Karten liegen auf einem zusätzlichen Verlaufseintrag mit derselben Adresse: Zurück löst so
  // kein `hashchange` aus und öffnet den Zwischenstand, statt die Sitzung zu verlassen (D-29).
  const onCards = () => hasMark(CARDS);
  const enterCards = () => {
    if (!onCards()) pushMark(CARDS);
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
        if (screen === "pause") resume();
      } else if (screen === "cards" && answered() && !practice.finished) showPause();
      // Ohne Antwort und nach dem Ende gibt es keinen Zwischenstand: gleich weiter zurück.
      else if (screen !== "pause") history.back();
    },
    { signal },
  );

  const proceed = () => (practice.finished ? showResult() : showCard());

  /** Fortschritt in der App-Leiste; „3 von 12 geschafft“ liest der Screenreader am Balken vor. */
  const showProgress = () => {
    const { done, total } = practice.state;
    page.element.classList.add("in-session");
    count.replaceChildren(
      `${done} von ${total}`,
      h("span", { class: "visually-hidden" }, " geschafft"),
    );
    bar.setAttribute("aria-valuemax", String(total));
    bar.setAttribute("aria-valuenow", String(done));
    fill.style.width = `${total === 0 ? 0 : Math.round((done / total) * 100)}%`;
  };

  const showCard = () => {
    const card = currentCard(practice.state)!;
    const entry = practice.entry(card.entryId);
    const faces = cardFaces(entry, card.direction);
    // Das Wort der Lernsprache: Frage in Richtung Muttersprache, sonst die Antwort.
    const term = sideText(entry, "term");
    const asksTerm = card.direction === "termToMeaning";
    const speakSlot = h("span", { class: "speak-slot" });
    const [promptLanguage, answerLanguage] =
      card.direction === "termToMeaning"
        ? [set.termLanguage, set.meaningLanguage]
        : [set.meaningLanguage, set.termLanguage];
    page.setTitle(set.title);
    page.setBack({
      label: "Beenden",
      icon: "close",
      // Wie die Zurück-Taste; ohne Antwort gleich zur Bibliothek (D-29).
      onclick: () => (answered() ? history.back() : (location.hash = "#/")),
    });
    showProgress();

    /** Speichert die Antwort; erst danach geht es weiter (TDD 12.4). */
    const save = async (result: Result): Promise<boolean> => {
      onKey = null;
      const at = shown;
      saving = true;
      const saved = await practice.answer(result);
      saving = false;
      if (signal.aborted) return false;
      if (!saved.ok && saved.setGone) {
        showGone(saved.error);
        return false;
      }
      problem.textContent = saved.ok ? "" : saved.error;
      // Inzwischen zum Zwischenstand gewechselt: ihn mit dem neuen Stand zeigen, statt vorzurücken;
      // „Weiterlernen“ zeigt dann die nächste Karte.
      if (screen === "pause") {
        if (practice.finished) showResult();
        else showPause();
        return false;
      }
      return shown === at;
    };

    const showFlashcard = () => {
      let revealed = false;
      let rating = false;
      // Wie beim Wischen: „Gewusst“ schiebt die Karte nach rechts, „Nochmal“ nach links, während die
      // Antwort gespeichert wird. Inzwischen geöffneter Zwischenstand: nicht vorrücken.
      const rate = async (result: Result) => {
        if (!revealed || rating) return;
        rating = true;
        again.disabled = known.disabled = true;
        const direction: SwipeDirection = result === "correct" ? "right" : "left";
        const gone = flyOut(cardWithSpeaker, direction);
        const saved = save(result);
        await gone;
        if ((await saved) && screen === "cards") proceed();
      };
      const again = h(
        "button",
        { type: "button", class: "secondary", onclick: () => void rate("incorrect") },
        "Nochmal",
      );
      const known = h(
        "button",
        { type: "button", class: "right", onclick: () => void rate("correct") },
        icon("check"),
        h("span", null, "Gewusst"),
      );

      const front = h(
        "button",
        { type: "button", class: "face front", "aria-disabled": "true" },
        h("span", { class: "lang-tag" }, languageName(promptLanguage)),
        h("span", { class: "prompt", lang: promptLanguage }, faces.prompt),
        // Lädt ein, sich vor dem Aufdecken festzulegen (FR-09, D-60).
        h("span", { class: "small" }, "Sag es laut, dann tipp zum Aufdecken"),
      );
      const back = h(
        "div",
        { class: "face back", tabindex: -1, inert: true },
        h("span", { class: "lang-tag" }, languageName(answerLanguage)),
        h("span", { class: "prompt small", lang: promptLanguage }, faces.prompt),
        h("span", { class: "answer", lang: answerLanguage }, faces.answer),
        ...details(entry),
        h("span", { class: "small swipe-hint" }, "← Nochmal · Gewusst →"),
      );
      const flash = h(
        "div",
        { class: "flash", onclick: () => reveal() },
        h("div", { class: "flash-inner" }, front, back),
      );
      // Neben der Karte, nicht darin: Die Karte fängt den Zeiger fürs Wischen ein.
      const cardWithSpeaker = h("div", { class: "card-wrap" }, flash, speakSlot);

      // Erst nach einer kurzen Sperre lässt sich die Karte wenden (TDD 12.3); `aria-disabled` statt
      // `disabled`, damit die Vorderseite den Fokus behält.
      let ready = false;
      const lock = setTimeout(() => {
        ready = true;
        front.removeAttribute("aria-disabled");
        uncover.removeAttribute("aria-disabled");
      }, REVEAL_LOCK);
      signal.addEventListener("abort", () => clearTimeout(lock));

      const reveal = () => {
        // Ein Klick nach einer Wischgeste darf nicht ein zweites Mal aufdecken.
        if (revealed || !ready) return;
        revealed = true;
        flash.classList.add("flipped");
        front.inert = true;
        back.inert = false;
        page.setDock(again, known);
        if (!asksTerm) offerSpeech(speakSlot, term);
        onKey = (event) => {
          if (event.key === "ArrowRight") void rate("correct");
          else if (event.key === "ArrowLeft") void rate("incorrect");
          else return false;
          return true;
        };
        // Fokus auf die Antwort, nicht auf eine Schaltfläche: Ein gehaltenes Enter bewertet so nicht.
        focusSoon(back);
      };

      // Vor dem Aufdecken deckt Wischen nur auf, in beide Richtungen (FR-09); danach bewertet eine neue
      // Geste: rechts „Gewusst“, links „Nochmal“. Erst die Rückseite folgt dem Finger.
      onSwipe(
        flash,
        (direction) => {
          if (!revealed) reveal();
          else void rate(direction === "right" ? "correct" : "incorrect");
        },
        () => revealed,
        cardWithSpeaker,
      );
      const uncover = h(
        "button",
        { type: "button", "aria-disabled": "true", onclick: reveal },
        "Aufdecken",
      );
      page.setDock(uncover);
      show("cards", h("p", { class: "kind" }, "Karteikarte"), cardWithSpeaker, problem);
      if (asksTerm) offerSpeech(speakSlot, term);
      onKey = (event) => {
        if ((event.key !== "Enter" && event.key !== " ") || handledByTarget(event)) return false;
        reveal();
        return true;
      };
      focusSoon(front);
    };

    const showChoice = (question: Extract<Question, { mode: "multipleChoice" }>) => {
      const prompt = h(
        "div",
        { class: "question", tabindex: -1 },
        h("span", { class: "lang-tag" }, languageName(promptLanguage)),
        h("span", { class: "prompt", lang: promptLanguage }, faces.prompt),
        speakSlot,
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
        feedback.classList.add(right ? "good" : "bad");
        feedback.textContent = right
          ? "Richtig."
          : `Leider falsch. Richtig ist: ${question.options[question.correct]}`;
        if (!asksTerm) offerSpeech(speakSlot, term);
        if (!(await save(right ? "correct" : "incorrect"))) return;
        const next = h("button", { type: "button", onclick: proceed }, "Weiter");
        after.replaceChildren(...details(entry));
        page.setDock(next);
        focusSoon(next);
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
      // Erst erinnern, dann wählen (FR-09, D-60): Die Antworten folgen nach einer Pause oder sofort auf
      // „Antworten zeigen“. Der Zwischenstand hält die Pause an; danach beginnt sie neu.
      const choices = h("div", { class: "options", hidden: true }, options);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const reveal = () => {
        clearTimeout(timer);
        if (!choices.hidden) return;
        choices.hidden = false;
        onKey = null;
        page.setDock();
      };
      // Vorzeitig erst nach einer kurzen Sperre (TDD 12.3).
      const showNow = h(
        "button",
        {
          type: "button",
          class: "secondary",
          "aria-disabled": "true",
          onclick: () => ready && reveal(),
        },
        "Antworten zeigen",
      );
      let ready = false;
      const lock = setTimeout(() => {
        ready = true;
        showNow.removeAttribute("aria-disabled");
      }, REVEAL_LOCK);
      // „Weiterlernen“ zeichnet die Karte neu und beginnt damit eine neue Pause.
      const wait = () => {
        timer = setTimeout(() => {
          if (screen === "cards" && current === shown) reveal();
        }, CHOICE_DELAY);
      };
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        clearTimeout(lock);
      });
      page.setDock(showNow);
      show(
        "cards",
        h("p", { class: "kind" }, "Multiple Choice"),
        prompt,
        feedback,
        after,
        choices,
        problem,
      );
      const current = shown;
      if (asksTerm) offerSpeech(speakSlot, term);
      onKey = (event) => {
        if ((event.key !== "Enter" && event.key !== " ") || handledByTarget(event)) return false;
        if (ready) reveal();
        return true;
      };
      wait();
      focusSoon(prompt);
    };

    const question = practice.question();
    if (question.mode === "multipleChoice") showChoice(question);
    else showFlashcard();
  };

  const quota = (): Node[] => {
    const { firstCorrect, firstAttempts } = practice.state;
    return [
      h(
        "p",
        { class: "quota" },
        h("span", { class: "hl" }, `${firstCorrect} von ${firstAttempts}`),
        " beim ersten Mal gewusst.",
      ),
      ...unsavedNote(),
    ];
  };
  // Ehrlich bleiben (AK-26, D-32): Was nicht gespeichert ist, fehlt im Lernstand.
  const unsavedNote = (): Node[] => {
    const { unsaved } = practice;
    if (unsaved === 0) return [];
    return [
      h(
        "p",
        null,
        unsaved === 1
          ? "1 Antwort wurde nicht gespeichert und zählt nicht zum Lernstand."
          : `${unsaved} Antworten wurden nicht gespeichert und zählen nicht zum Lernstand.`,
      ),
    ];
  };
  const toLibrary = (secondary: boolean) =>
    h("a", { href: "#/", class: secondary ? "action secondary" : "action" }, "Zur Bibliothek");

  /** Die beim Erstversuch falschen Einträge mit „Nur Fehler üben“ (TDD 12.2); ohne Fehler nichts. */
  const mistakes = (): { list: Node; repeat: HTMLButtonElement } | null => {
    const { missed } = practice.state;
    if (missed.length === 0) return null;
    const again = async () => {
      repeat.disabled = true;
      let next: PracticeSession;
      try {
        next = await practice.repeatMistakes();
      } catch (error) {
        console.error("Lernsitzung nicht gestartet", error);
        if (!signal.aborted) {
          problem.textContent = failureMessage(error, "Die Lernsitzung wurde nicht gestartet.");
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
      { type: "button", class: "secondary", onclick: () => void again() },
      `Nur Fehler üben (${missed.length})`,
    );
    const list = h(
      "section",
      { class: "panel", "aria-labelledby": "practice-missed" },
      h("h2", { id: "practice-missed" }, "Zum Nachlernen"),
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
    );
    return { list, repeat };
  };

  /** Zwischenstand (FR-12, D-51) als Blatt über der Karte; die Sitzung läuft weiter. */
  let pause: Sheet | null = null;
  const closePause = () => {
    const open = pause;
    pause = null;
    open?.close();
  };
  /** „Weiterlernen“, Vorwärts oder das Blatt ohne Wahl schließen: weiter mit der aktuellen Karte. */
  const resume = () => {
    if (signal.aborted || screen !== "pause") return;
    closePause();
    enterCards();
    proceed();
  };
  const showPause = () => {
    const { queue, total } = practice.state;
    closePause();
    screen = "pause";
    // Nicht gespeicherte Antworten nennt der Zwischenstand selbst.
    problem.textContent = "";
    const open = queue.length;
    const proceedButton = h(
      "button",
      { type: "button", onclick: resume },
      `Weiterlernen (${open} offen)`,
    );
    // Den Fokus bekommt der Satz mit dem Stand, damit Screenreader ihn ansagen (TDD 13.7).
    const [rate, ...note] = quota();
    pause = openSheet(page.element, {
      title: "Zwischenstand",
      focus: rate as HTMLElement,
      content: [
        rate,
        ...note,
        h("p", null, `Noch offen: ${open} von ${total} Vokabeln.`),
        practice.unsaved === 0 && h("p", null, "Was du schon beantwortet hast, ist gespeichert."),
        h("div", { class: "actions" }, toLibrary(true), proceedButton),
      ],
      onDismiss: () => {
        pause = null;
        // Erst danach, sonst holt das Blatt den Fokus zurück auf „Beenden“ statt auf die Karte.
        queueMicrotask(resume);
      },
    });
  };

  /** Erstversuchsquote als Ring (TDD 12.3); der Text daneben sagt dasselbe. */
  const ring = (correct: number, of: number): Element => {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "ring");
    svg.setAttribute("viewBox", "0 0 132 132");
    svg.setAttribute("aria-hidden", "true");
    const circle = (cls: string) => {
      const shape = document.createElementNS(SVG, "circle");
      for (const [key, value] of Object.entries({ class: cls, cx: "66", cy: "66", r: "54" }))
        shape.setAttribute(key, value);
      svg.appendChild(shape);
      return shape;
    };
    circle("bg");
    const fg = circle("fg");
    const length = 2 * Math.PI * 54;
    fg.setAttribute("stroke-dasharray", String(length));
    fg.setAttribute("stroke-dashoffset", String(length));
    const text = document.createElementNS(SVG, "text");
    for (const [key, value] of Object.entries({ x: "66", y: "76", "text-anchor": "middle" }))
      text.setAttribute(key, value);
    text.textContent = `${correct}/${of}`;
    svg.appendChild(text);
    // Erst nach dem Einhängen füllen, damit der Ring sichtbar wächst.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        fg.setAttribute(
          "stroke-dashoffset",
          String(of === 0 ? length : length * (1 - correct / of)),
        ),
      ),
    );
    return svg;
  };

  const showResult = () => {
    closePause();
    setUpdateBlocked(false);
    problem.textContent = "";
    page.element.classList.remove("in-session");
    const missed = mistakes();
    const { firstCorrect, firstAttempts } = practice.state;
    show(
      "result",
      h("div", { class: "trophy" }, ring(firstCorrect, firstAttempts), ...quota()),
      missed?.list ??
        h(
          "section",
          { class: "panel", "aria-labelledby": "practice-flawless" },
          h("h2", { id: "practice-flawless" }, "Fehlerfrei"),
          h("p", null, "Alles beim ersten Mal gewusst."),
        ),
      problem,
    );
    page.setBack(null);
    page.setDock(missed?.repeat, toLibrary(false));
    focusSoon(page.setTitle("Geschafft"));
  };

  /** Das Set wurde inzwischen gelöscht, z. B. in einem anderen Tab (TDD 3.4): Es geht nicht weiter. */
  const showGone = (message: string) => {
    closePause();
    setUpdateBlocked(false);
    problem.textContent = "";
    page.element.classList.remove("in-session");
    show("result", h("p", null, message));
    page.setBack(null);
    page.setDock(toLibrary(false));
    focusSoon(page.setTitle("Lernsitzung beendet"));
  };

  enterCards();
  showCard();
  return page.element;
}
