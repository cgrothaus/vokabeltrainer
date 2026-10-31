// Hilfe „Wie bekomme ich ein Vokabelset?“ (TDD 13.1, FR-20, FR-28): Weg über einen KI-Chat, Vorlage zum
// Kopieren, Formatbeschreibung als Datei für Chats ohne Linkzugriff, ein Beispiel des Formats und der Weg
// zum Korrigieren eines Sets (D-44).
import { FORMAT_EXAMPLE } from "../../content/help";
import type { Delivery } from "../../platform/deliverFile";
import { promptBox } from "../components/promptBox";
import { h } from "../dom";

export interface HelpContext {
  /** Vorlage mit eingesetztem Link auf die Formatspezifikation. */
  prompt: string;
  /** Korrekturvorlage, ebenfalls mit Link. */
  correctionPrompt: string;
  /** Muss direkt im Klick aufgerufen werden (Nutzergeste). */
  copyText: (text: string) => Promise<boolean>;
  loadSpec: () => Promise<Blob>;
  /** Muss direkt im Klick aufgerufen werden, sonst öffnet sich das Teilen-Menü nicht. */
  shareSpec: (spec: Blob) => Promise<Delivery>;
}

const NOT_LOADED =
  "Die Formatbeschreibung konnte nicht geladen werden. Lade die Seite neu und versuche es noch einmal.";
const DELIVERED = {
  shared: "Formatbeschreibung geteilt.",
  downloaded: "Formatbeschreibung gespeichert. Hänge die Datei im Chat an.",
} as const;

export function helpView(context: HelpContext): Node {
  return h(
    "main",
    { class: "help" },
    h("h1", null, "Wie bekomme ich ein Vokabelset?"),
    h(
      "p",
      null,
      "Ein KI-Chat wie ChatGPT, Claude oder Gemini macht aus einem Foto deiner Vokabelliste ein Vokabelset für diese App.",
    ),
    h(
      "ol",
      { class: "steps" },
      h("li", null, "Fotografiere deine Vokabelliste."),
      h(
        "li",
        null,
        "Kopiere die Vorlage unten, füge sie in deinen KI-Chat ein und hänge die Fotos an.",
      ),
      h(
        "li",
        null,
        "Kopiere die Antwort des Chats und füge sie unter ",
        h("a", { href: "#/import" }, "Vokabelset importieren"),
        " ein. Du siehst vor dem Speichern, was übernommen wird.",
      ),
    ),
    promptBox({
      id: "help",
      heading: "Vorlage für den KI-Chat",
      prompt: context.prompt,
      label: "Vorlage kopieren",
      copyText: context.copyText,
    }),
    shareSection(context),
    h(
      "details",
      { class: "example" },
      h("summary", null, "So sieht ein Vokabelset aus"),
      h(
        "p",
        null,
        "Der Chat schreibt die Vokabeln in diesem Format. Du musst es nicht verstehen – die App prüft es beim Import.",
      ),
      h("pre", null, FORMAT_EXAMPLE),
    ),
    promptBox(
      {
        id: "help-correction",
        heading: "Ein Set korrigieren",
        prompt: context.correctionPrompt,
        label: "Korrekturvorlage kopieren",
        copyText: context.copyText,
      },
      h(
        "p",
        null,
        "Ein KI-Chat kann ein Set auch prüfen und korrigieren. Exportiere es dazu in der Set-Ansicht unter „Exportieren“, kopiere diese Vorlage in den Chat und hänge die Datei an. Die Antwort fügst du wie ein neues Set unter „Vokabelset importieren“ ein – die App erkennt das Set und zeigt, was sich ändert.",
      ),
    ),
    h("p", null, h("a", { href: "#/import", class: "action" }, "Vokabelset importieren")),
    h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek")),
  );
}

function shareSection(context: HelpContext): Node {
  let spec: Blob | null = null;
  const status = h("p", { "aria-live": "polite" });
  const share = h(
    "button",
    {
      type: "button",
      class: "secondary",
      disabled: true,
      onclick: async () => {
        if (!spec) return;
        share.disabled = true;
        status.textContent = "";
        try {
          const delivery = await context.shareSpec(spec);
          if (delivery !== "cancelled") status.textContent = DELIVERED[delivery];
        } catch (error) {
          console.error("Formatbeschreibung nicht geteilt", error);
          status.textContent = NOT_LOADED;
        } finally {
          share.disabled = false;
        }
      },
    },
    "Formatbeschreibung teilen",
  );
  // Vorab laden: `share()` braucht eine frische Nutzergeste, ein Laden im Klick käme zu spät.
  context.loadSpec().then(
    (loaded) => {
      spec = loaded;
      share.disabled = false;
    },
    (error: unknown) => {
      console.error("Formatbeschreibung nicht geladen", error);
      status.textContent = NOT_LOADED;
    },
  );
  return h(
    "section",
    { "aria-labelledby": "help-share-heading" },
    h("h2", { id: "help-share-heading" }, "Kann der Chat den Link nicht öffnen?"),
    h(
      "p",
      null,
      "Dann hänge die Formatbeschreibung als Datei an: Teile sie direkt mit der Chat-App oder speichere sie und wähle sie im Chat aus.",
    ),
    share,
    status,
  );
}
