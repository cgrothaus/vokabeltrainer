// Set exportieren (TDD 11.1, FR-18, D-42): ganzes Set oder einzelne Sektionen als Datei über das
// Teilen-Menü bzw. als Download, oder als Text in die Zwischenablage, z. B. für einen Chat.
import type { ExportScope } from "../../domain/exportSet";
import type { StoredSet } from "../../domain/model";
import type { Delivery } from "../../platform/deliverFile";
import type { PreparedExport } from "../exportSet";
import { type Child, focusSoon, h } from "../dom";

export interface ExportContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  /** Synchron, damit die Nutzergeste bis zum Ausliefern frisch bleibt. */
  prepareExport: (set: StoredSet, scope: ExportScope) => PreparedExport;
  /** Muss direkt im Klick aufgerufen werden, sonst öffnet sich das Teilen-Menü nicht. */
  deliverExport: (prepared: PreparedExport) => Promise<Delivery>;
  /** Muss direkt im Klick aufgerufen werden (Nutzergeste). */
  copyText: (text: string) => Promise<boolean>;
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
  const back = (href: string, label: string) => h("p", null, h("a", { href }, label));
  const fail = (title: string, text: string, alert = false) =>
    main.replaceChildren(
      h("h1", null, title),
      h("p", alert ? { role: "alert" } : null, text),
      back("#/", "Zurück zur Bibliothek"),
    );
  context.loadSet().then(
    // Ist die Ansicht schon verlassen, hängt `main` nirgends mehr; das Ersetzen bleibt dann folgenlos.
    (set) => {
      if (!set) return fail("Set nicht gefunden", "Dieses Vokabelset gibt es nicht (mehr).");
      main.replaceWith(
        h(
          "main",
          { class: "setup export" },
          content(set, context),
          back(`#/set/${encodeURIComponent(setId)}`, "Zurück zum Set"),
        ),
      );
    },
    (error: unknown) => {
      console.error("Set nicht lesbar", error);
      fail("Exportieren", NOT_LOADED, true);
    },
  );
  return main;
}

function content(set: StoredSet, context: ExportContext): Child[] {
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
    "ul",
    { class: "section-choice", hidden: true },
    set.sections.map((section) =>
      h(
        "li",
        null,
        h(
          "label",
          null,
          h("input", {
            type: "checkbox",
            value: section.id,
            onchange: (event: Event) => {
              if ((event.target as HTMLInputElement).checked) selected.add(section.id);
              else selected.delete(section.id);
              update();
            },
          }),
          h("span", { class: "title" }, section.title),
          h("span", { class: "count" }, count(section.entries.length, "Eintrag", "Einträge")),
        ),
      ),
    ),
  );
  const partHint = h(
    "p",
    { hidden: true },
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
        { class: "choices" },
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
            label,
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
    "Datei speichern",
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
    "Text kopieren",
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

  return [
    h("h1", { class: "set-title" }, set.title),
    h("p", { class: "languages" }, "Exportieren"),
    h(
      "p",
      null,
      "Die Datei enthält die Vokabeln mit Sektionen und Reihenfolge, aber nicht deinen Lernstand. Alles zusammen sicherst du mit einem ",
      h("a", { href: "#/backup" }, "Backup"),
      ".",
    ),
    scopeChoice,
    status,
    h("div", { class: "actions" }, save, copy),
    result,
    problem,
    fallback,
  ];
}
