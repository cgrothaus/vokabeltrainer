// Weg zum Home-Bildschirm auf iOS und iPadOS (TDD 6.6, D-38): Im Browser kann das Gerät die Daten
// löschen, auf dem Home-Bildschirm nicht. Die App dort hat einen eigenen Speicher; wer schon Sets hat,
// zieht per Backup um. Die Bedienelemente von Safari erscheinen als kleine Symbole im Text.
import { type Child, h } from "../dom";
import { icon, type IconName } from "../icons";
import { openSheet } from "./sheet";

export type IosDevice = "iPhone" | "iPad";

const key = (symbol: IconName, label: string) =>
  h("span", { class: "kbd" }, icon(symbol), h("span", null, label));

/** Die Schritte zum Home-Bildschirm, mit Sets samt Umzug per Backup. */
export function homeScreenSteps(hasSets: boolean): HTMLOListElement {
  return h(
    "ol",
    { class: "home-steps" },
    hasSets &&
      h(
        "li",
        null,
        h("span", null, "Speichere hier ein ", h("a", { href: "#/backup" }, "Backup"), "."),
      ),
    h(
      "li",
      null,
      h(
        "span",
        null,
        "Tippe in Safari auf ",
        key("share", "Teilen"),
        " (manchmal hinter „···“) und wähle ",
        key("home", "Zum Home-Bildschirm"),
        ". „Als Web-App öffnen“ bleibt an.",
      ),
    ),
    h(
      "li",
      null,
      h(
        "span",
        null,
        hasSets
          ? "Öffne den Vokabeltrainer über das neue Symbol und lade dort unter „Backup“ dein Backup."
          : "Öffne den Vokabeltrainer über das neue Symbol und leg dort los.",
      ),
    ),
  );
}

/** Begründung für den Weg zum Home-Bildschirm, passend zum Gerät. */
export function homeScreenReason(device: IosDevice): string {
  return `Im Browser löscht dein ${device} die Vokabeln, wenn du ein paar Tage nicht lernst. Auf dem Home-Bildschirm bleiben sie.`;
}

/** Karte über dem Einstieg des Empty State: Die Schritte stehen sichtbar da, nicht aufgeklappt. */
export function homeScreenCard(device: IosDevice): HTMLElement {
  return h(
    "section",
    { class: "install-card hint", "aria-labelledby": "home-screen" },
    h(
      "div",
      { class: "head" },
      icon("phone"),
      h(
        "div",
        null,
        h("h2", { id: "home-screen" }, "Zuerst auf den Home-Bildschirm"),
        h("p", null, homeScreenReason(device)),
      ),
    ),
    homeScreenSteps(false),
  );
}

/** Blatt mit dem Umzug auf den Home-Bildschirm, z. B. nach „Schützen“ (TDD 6.6, 13.7). */
export function openHomeScreenSheet(
  within: Element,
  options: { device: IosDevice; hasSets: boolean; returnTo?: HTMLElement },
): void {
  const intro = h(
    "p",
    null,
    options.hasSets
      ? "Die App auf dem Home-Bildschirm hat einen eigenen Speicher. Nimm deine Vokabeln so mit:"
      : homeScreenReason(options.device),
  );
  const content: Child[] = [intro, homeScreenSteps(options.hasSets)];
  if (options.hasSets)
    content.push(
      h(
        "div",
        { class: "actions" },
        h("a", { href: "#/backup", class: "action" }, icon("download"), "Erst Backup speichern"),
      ),
    );
  openSheet(within, {
    title: "Auf den Home-Bildschirm",
    focus: intro,
    content,
    returnTo: options.returnTo,
  });
}
