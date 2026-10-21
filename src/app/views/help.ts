// Hilfe „Wie bekomme ich ein Vokabelset?“ (TDD 13.1, FR-20, FR-28): Weg über einen KI-Chat, Vorlage zum
// Kopieren, Formatbeschreibung als Datei für Chats ohne Linkzugriff und ein Beispiel des Formats.
import { FORMAT_EXAMPLE } from "../../content/help";
import type { Delivery } from "../../platform/deliverFile";
import { h } from "../dom";

export interface HelpContext {
  /** Vorlage mit eingesetztem Link auf die Formatspezifikation. */
  prompt: string;
  /** Muss direkt im Klick aufgerufen werden (Nutzergeste). */
  copyText: (text: string) => Promise<boolean>;
  loadSpec: () => Promise<Blob>;
  /** Muss direkt im Klick aufgerufen werden, sonst öffnet sich das Teilen-Menü nicht. */
  shareSpec: (spec: Blob) => Promise<Delivery>;
}

const NOT_COPIED =
  "Kopieren hat nicht geklappt. Die Vorlage ist jetzt markiert – kopiere sie über das Menü deines Geräts.";
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
    promptSection(context),
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
    h("p", null, h("a", { href: "#/import", class: "action" }, "Vokabelset importieren")),
    h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek")),
  );
}

function promptSection(context: HelpContext): Node {
  const text = h("pre", { class: "prompt", id: "help-prompt" }, context.prompt);
  const status = h("p", { "aria-live": "polite" });
  const copy = h(
    "button",
    {
      type: "button",
      onclick: async () => {
        // Ohne vorheriges `await` schreiben, sonst verfällt die Nutzergeste.
        const copied = await context.copyText(context.prompt);
        status.textContent = copied ? "Vorlage kopiert." : NOT_COPIED;
        if (!copied) getSelection()?.selectAllChildren(text);
      },
    },
    "Vorlage kopieren",
  );
  return h(
    "section",
    { "aria-labelledby": "help-prompt-heading" },
    h("h2", { id: "help-prompt-heading" }, "Vorlage für den KI-Chat"),
    text,
    copy,
    status,
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
