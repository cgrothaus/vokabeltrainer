// Richtung, Anzahl und Anteil an Multiple Choice für die Einrichtung (TDD 12.1) und „Zusammen lernen“
// (12.10): Richtung und Anzahl als Segmentschalter, der Anteil als Regler in Schritten von 5, dazu der
// Schalter für Buchstaben in Richtung Lernsprache (12.3, D-70).
import type { Direction } from "../../domain/model";
import {
  type CountChoice,
  countOptions,
  fitCount,
  MC_SHARE_STEP,
  type PracticeSetup,
} from "../../domain/practiceSetup";
import { h } from "../dom";

type Options = Pick<PracticeSetup, "direction" | "count" | "mcShare" | "letters">;

export interface SetupOptions {
  readonly direction: HTMLElement;
  readonly count: HTMLElement;
  readonly share: HTMLElement;
  /** Nur sichtbar, wenn die Richtung Karten in die Lernsprache enthält. */
  readonly letters: HTMLElement;
  /** Die gewählte Stufe bleibt, auch wenn sie bei kleinerer Auswahl zeitweise als „alle“ erscheint. */
  value(): Options;
  /** Baut die Stufen der Anzahl für so viele verfügbare Einträge, wenn sich die Zahl geändert hat. */
  setAvailable(total: number): void;
}

/**
 * `term` und `meaning` sind die Namen der Sprachen; `onChange` folgt jeder Wahl der Anzahl, damit die
 * Schaltfläche die Folge nennt.
 */
export function setupOptions(
  initial: Options,
  languages: { term: string; meaning: string },
  onChange: () => void,
): SetupOptions {
  let { direction, count: chosenCount, mcShare, letters } = initial;
  const { term, meaning } = languages;
  const directions: [Direction | "mixed", string][] = [
    ["termToMeaning", `${term} → ${meaning}`],
    ["meaningToTerm", `${meaning} → ${term}`],
    ["mixed", "Gemischt"],
  ];

  const directionChoice = h(
    "fieldset",
    null,
    h("legend", null, "Richtung"),
    h(
      "div",
      { class: "seg" },
      directions.map(([value, label]) =>
        h(
          "label",
          null,
          h("input", {
            type: "radio",
            name: "direction",
            value,
            checked: value === direction,
            onchange: () => {
              direction = value;
              showLetters();
            },
          }),
          h("span", null, label),
        ),
      ),
    ),
  );

  const countChoices = h("div", { class: "seg" });
  const countChoice = h("fieldset", null, h("legend", null, "Anzahl"), countChoices);
  // Was neben Multiple Choice gestellt wird: mit Buchstaben je nach Richtung.
  const restText = () =>
    !letters || direction === "termToMeaning"
      ? "Karteikarten"
      : direction === "meaningToTerm"
        ? "Buchstaben"
        : "Karteikarten und Buchstaben";
  const shareText = () => `${mcShare} % (Rest: ${restText()})`;
  const shareValue = h("span", { class: "share-value" }, shareText());
  const slider = h("input", {
    type: "range",
    id: "mc-share",
    min: 0,
    max: 100,
    step: MC_SHARE_STEP,
    value: mcShare,
    "aria-valuetext": `${mcShare} Prozent`,
    oninput: () => {
      mcShare = slider.valueAsNumber;
      shareValue.textContent = shareText();
      slider.setAttribute("aria-valuetext", `${mcShare} Prozent`);
    },
  });
  const shareChoice = h(
    "div",
    { class: "share" },
    h("label", { for: "mc-share" }, "Multiple Choice"),
    slider,
    shareValue,
  );

  const lettersBox = h("input", {
    type: "checkbox",
    role: "switch",
    checked: letters,
    onchange: () => {
      letters = lettersBox.checked;
      shareValue.textContent = shareText();
    },
  });
  const lettersChoice = h(
    "label",
    { class: "switch-row" },
    h(
      "span",
      null,
      h("span", { class: "label" }, "Schreiben mit Buchstaben"),
      h(
        "span",
        { class: "muted" },
        `In Richtung ${term} setzt du das Wort aus Buchstaben zusammen, statt die Karte aufzudecken.`,
      ),
    ),
    lettersBox,
  );
  const showLetters = () => {
    lettersChoice.hidden = direction === "termToMeaning";
    shareValue.textContent = shareText();
  };
  showLetters();

  let shownTotal = -1;
  const renderCounts = (total: number) => {
    const shown = fitCount(chosenCount, total);
    countChoices.replaceChildren(
      ...countOptions(total).map((option: CountChoice) =>
        h(
          "label",
          null,
          h("input", {
            type: "radio",
            name: "count",
            value: String(option),
            checked: option === shown,
            onchange: () => {
              chosenCount = option;
              onChange();
            },
          }),
          h("span", null, option === "all" ? `alle (${total})` : String(option)),
        ),
      ),
    );
  };

  return {
    direction: directionChoice,
    count: countChoice,
    share: shareChoice,
    letters: lettersChoice,
    value: () => ({ direction, count: chosenCount, mcShare, letters }),
    setAvailable(total) {
      // Nur bei geänderter Auswahl neu aufbauen, sonst verlöre die gewählte Stufe den Fokus.
      if (total !== shownTotal) renderCounts(total);
      shownTotal = total;
    },
  };
}
