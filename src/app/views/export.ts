// Set exportieren (TDD 11.1, FR-18, D-42, D-54): ganzes Set oder einzelne Sektionen (Segmentschalter
// und Chips) als Datei über das Teilen-Menü bzw. als Download oder als Text in die Zwischenablage, z. B.
// für einen Chat; beides in der Aktionsleiste. Darunter die Korrektur mit dem KI-Chat als Karte (D-44).
import type { ExportScope } from "../../domain/exportSet";
import type { StoredSet } from "../../domain/model";
import type { Delivery } from "../../platform/deliverFile";
import { type Frame, frame } from "../components/frame";
import { promptBox } from "../components/promptBox";
import type { PreparedExport } from "../exportSet";
import { type Child, focusSoon, h } from "../dom";
import { icon } from "../icons";

export interface ExportContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  /** Synchron, damit die Nutzergeste bis zum Ausliefern frisch bleibt. */
  prepareExport: (set: StoredSet, scope: ExportScope) => PreparedExport;
  /** Muss direkt im Klick aufgerufen werden, sonst öffnet sich das Teilen-Menü nicht. */
  deliverExport: (prepared: PreparedExport) => Promise<Delivery>;
  /** Muss direkt im Klick aufgerufen werden (Nutzergeste). */
  copyText: (text: string) => Promise<boolean>;
  /** Mit eingesetztem Link auf die Formatspezifikation. */
  correctionPrompt: string;
}

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";
const NOT_DELIVERED =
  "Die Datei konnte nicht gespeichert werden. Lade die Seite neu und versuche es noch einmal.";
const NOT_COPIED =
  "Kopieren hat nicht geklappt. Der Text ist jetzt unten markiert – kopiere ihn über das Menü deines Geräts.";
const DELIVERED = { shared: "Datei geteilt.", downloaded: "Datei gespeichert." } as const;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function exportView(context: ExportContext, setId: string): Node {
  const main = h("main", { class: "setup export" });
  const page = frame({ back: { parent: `#/set/${encodeURIComponent(setId)}` } }, main);
  const fail = (title: string, text: string, alert = false) => {
    page.setTitle(title);
    main.replaceChildren(h("p", alert ? { role: "alert" } : null, text));
  };
  context.loadSet().then(
    // Ist die Ansicht schon verlassen, hängt `main` nirgends mehr; das Ersetzen bleibt dann folgenlos.
    (set) => {
      if (!set) return fail("Set nicht gefunden", "Dieses Vokabelset gibt es nicht (mehr).");
      page.setTitle("Exportieren");
      main.replaceChildren(...h("div", null, content(set, context, page)).childNodes);
    },
    (error: unknown) => {
      console.error("Set nicht lesbar", error);
      fail("Exportieren", NOT_LOADED, true);
    },
  );
  return page.element;
}

function content(set: StoredSet, context: ExportContext, page: Frame): Child[] {
  let whole = true;
  const selected = new Set<string>();
  const scope = (): ExportScope =>
    whole
      ? { type: "set" }
      : {
          type: "sections",
          sectionIds: set.sections.map((s) => s.id).filter((id) => selected.has(id)),
        };
  const chosen = () =>
    whole ? set.sections : set.sections.filter((section) => selected.has(section.id));

  const status = h("p", { "aria-live": "polite", class: "selection" });
  const result = h("p", { "aria-live": "polite" });
  const problem = h("div", { role: "alert" });
  // Erscheint nur, wenn das Kopieren scheitert: Dann kopiert die Person den markierten Text selbst.
  const fallback = h("div");

  const sectionList = h(
    "div",
    { class: "toggles", hidden: true },
    set.sections.map((section) =>
      h(
        "label",
        { class: "toggle" },
        h("input", {
          type: "checkbox",
          value: section.id,
          onchange: (event: Event) => {
            if ((event.target as HTMLInputElement).checked) selected.add(section.id);
            else selected.delete(section.id);
            update();
          },
        }),
        h(
          "span",
          null,
          h("span", { class: "title" }, section.title),
          " ",
          h(
            "span",
            { class: "count" },
            String(section.entries.length),
            h(
              "span",
              { class: "visually-hidden" },
              section.entries.length === 1 ? " Eintrag" : " Einträge",
            ),
          ),
        ),
      ),
    ),
  );
  const partHint = h(
    "p",
    { class: "muted", hidden: true },
    "Einzelne Sektionen lassen sich nicht als neues Set importieren, nur das ganze Set.",
  );
  const choose = (value: boolean) => {
    whole = value;
    sectionList.hidden = partHint.hidden = value;
    update();
  };
  // Bei nur einer Sektion gibt es nichts zu wählen.
  const scopeChoice =
    set.sections.length > 1 &&
    h(
      "fieldset",
      null,
      h("legend", null, "Umfang"),
      h(
        "div",
        { class: "seg" },
        (
          [
            [true, "Ganzes Set"],
            [false, "Einzelne Sektionen"],
          ] as const
        ).map(([value, label]) =>
          h(
            "label",
            null,
            h("input", {
              type: "radio",
              name: "scope",
              checked: value,
              onchange: () => choose(value),
            }),
            h("span", null, label),
          ),
        ),
      ),
      sectionList,
      partHint,
    );

  const save = h(
    "button",
    {
      type: "button",
      onclick: async () => {
        clear();
        save.disabled = true;
        try {
          // Ohne vorheriges `await`: Das Teilen-Menü braucht die frische Geste (TDD 11.2).
          const delivery = await context.deliverExport(context.prepareExport(set, scope()));
          if (delivery !== "cancelled") result.textContent = DELIVERED[delivery];
        } catch (error) {
          console.error("Export nicht ausgeliefert", error);
          problem.textContent = NOT_DELIVERED;
        } finally {
          save.disabled = chosen().length === 0;
        }
      },
    },
    h("span", null, "Datei speichern"),
  );
  const copy = h(
    "button",
    {
      type: "button",
      class: "secondary",
      onclick: async () => {
        clear();
        const { text } = context.prepareExport(set, scope());
        if (await context.copyText(text)) {
          result.textContent = "Text kopiert.";
          return;
        }
        problem.textContent = NOT_COPIED;
        const area = h("textarea", { readonly: true, rows: 8, "aria-label": "Text zum Kopieren" });
        area.value = text;
        fallback.replaceChildren(area);
        focusSoon(area);
        area.select();
      },
    },
    h("span", null, "Text kopieren"),
  );
  const clear = () => {
    result.textContent = "";
    problem.textContent = "";
    fallback.replaceChildren();
  };

  const update = () => {
    clear();
    const sections = chosen();
    const entries = sections.reduce((sum, section) => sum + section.entries.length, 0);
    status.textContent =
      sections.length === 0
        ? "Wähle mindestens eine Sektion."
        : `${whole ? "Ganzes Set" : "Ausgewählt"}: ${count(sections.length, "Sektion", "Sektionen")} mit ${count(entries, "Eintrag", "Einträgen")}.`;
    save.disabled = copy.disabled = sections.length === 0;
  };
  update();

  page.setDock(copy, save);

  const correction = promptBox(
    {
      id: "export-correction",
      heading: "Mit KI-Chat korrigieren",
      prompt: context.correctionPrompt,
      label: "Korrekturvorlage kopieren",
      copyText: context.copyText,
    },
    h("p", null, "Ein KI-Chat kann das Set prüfen und korrigieren."),
    h(
      "ol",
      { class: "steps" },
      h(
        "li",
        null,
        h(
          "span",
          null,
          h("strong", null, "Datei speichern"),
          " oder ",
          h("strong", null, "Text kopieren"),
          " (unten).",
        ),
      ),
      h(
        "li",
        null,
        h(
          "span",
          null,
          h("strong", null, "Vorlage kopieren"),
          ", in den KI-Chat einfügen und die Datei anhängen – oder den Text darunter einfügen.",
        ),
      ),
      h(
        "li",
        null,
        h(
          "span",
          null,
          "Die ",
          h("strong", null, "Antwort"),
          " unter „Vokabelset hinzufügen“ einfügen. Du siehst vorher, was sich ändert.",
        ),
      ),
    ),
  );
  correction.classList.add("correction");
  correction.append(
    h(
      "a",
      { href: "#/import", class: "action secondary" },
      icon("plus"),
      h("span", null, "Antwort einfügen"),
    ),
  );

  return [
    h("p", { class: "lead" }, set.title),
    h(
      "p",
      null,
      "Die Datei enthält die Vokabeln mit Sektionen und Reihenfolge, aber nicht deinen Lernstand. Alles zusammen sicherst du mit einem ",
      h("a", { href: "#/backup" }, "Backup"),
      ".",
    ),
    scopeChoice,
    status,
    result,
    problem,
    fallback,
    correction,
  ];
}
