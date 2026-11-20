// Hilfe „Wie bekomme ich ein Vokabelset?“ (TDD 13.1, FR-20, FR-28): Weg über einen KI-Chat in drei
// Schritten, Vorlage mit der Formatspezifikation zum Kopieren (D-65); zugeklappt ein Beispiel des
// Formats und der Weg zum Korrigieren eines Sets über „Exportieren“ (D-44, D-53).
import { FORMAT_EXAMPLE, NEW_SET_SHOWN, newSetPrompt } from "../../content/help";
import { frame } from "../components/frame";
import { promptBox } from "../components/promptBox";
import { h } from "../dom";
import { icon } from "../icons";

export interface HelpContext {
  /** Muss direkt im Klick aufgerufen werden (Nutzergeste). */
  copyText: (text: string) => Promise<boolean>;
}

export function helpView(context: HelpContext): Node {
  const main = h(
    "main",
    { class: "help" },
    h(
      "p",
      { class: "lead" },
      "Ein KI-Chat wie ChatGPT, Claude oder Gemini macht aus einem Foto deiner Vokabelliste ein Vokabelset für diese App.",
    ),
    h(
      "ol",
      { class: "steps" },
      h("li", null, h("span", null, h("b", null, "Fotografiere"), " deine Vokabelliste.")),
      h(
        "li",
        null,
        h(
          "span",
          null,
          h("b", null, "Kopiere die Vorlage"),
          ", füge sie in deinen KI-Chat ein und hänge die Fotos an.",
        ),
      ),
      h(
        "li",
        null,
        h(
          "span",
          null,
          h("b", null, "Kopiere die Antwort"),
          " und füge sie unter ",
          h("a", { href: "#/import" }, "Vokabelset hinzufügen"),
          " ein. Du siehst vor dem Speichern, was übernommen wird.",
        ),
      ),
    ),
    promptBox({
      id: "help",
      heading: "Vorlage für den KI-Chat",
      shown: NEW_SET_SHOWN,
      text: newSetPrompt,
      label: "Vorlage kopieren",
      copyText: context.copyText,
    }).element,
    h(
      "details",
      { class: "about", id: "help-example" },
      h("summary", null, "So sieht ein Vokabelset aus"),
      h(
        "div",
        { class: "inside" },
        h(
          "p",
          null,
          "Der Chat schreibt die Vokabeln in diesem Format. Du musst es nicht verstehen – die App prüft es beim Import.",
        ),
        h("pre", null, FORMAT_EXAMPLE),
      ),
    ),
    h(
      "details",
      { class: "about", id: "help-correction-details" },
      h("summary", null, "Ein Set korrigieren"),
      h(
        "div",
        { class: "inside" },
        h(
          "p",
          null,
          "Ein KI-Chat kann ein Set auch prüfen und korrigieren. Öffne dazu das Set und wähle im Menü „Exportieren“: Dort kopiert „Korrekturvorlage kopieren“ die Vorlage zusammen mit deinem Set. Füge sie in den Chat ein. Die Antwort fügst du wie ein neues Set unter „Vokabelset hinzufügen“ ein – die App erkennt das Set und zeigt, was sich ändert.",
        ),
      ),
    ),
  );
  return frame(
    {
      title: "Wie bekomme ich ein Vokabelset?",
      back: { parent: "#/" },
      dock: [
        h(
          "a",
          { href: "#/import", class: "action" },
          icon("plus"),
          h("span", null, "Vokabelset hinzufügen"),
        ),
      ],
    },
    main,
  ).element;
}
