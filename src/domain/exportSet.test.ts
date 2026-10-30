import { describe, expect, it } from "vitest";
import { exportFileName, exportSetFile } from "./exportSet";
import { entryRev, sectionRev, setRev } from "./hash";
import { prepareNewSet } from "./importSet";
import type { StoredSet } from "./model";
import { normalizeSetFile } from "./normalize";
import { validateSetFile } from "./validate";

const set: StoredSet = {
  id: "k3m9q2x7ab",
  editCount: 3,
  createdAt: "2026-10-19T17:00:00.000Z",
  updatedAt: "2026-10-20T17:00:00.000Z",
  title: "Lektion 4 – In der Stadt",
  termLanguage: "en",
  meaningLanguage: "de",
  level: "Klasse 6",
  license: "CC0",
  reviewStatus: "unchecked",
  sections: [
    {
      id: "q7h3kd",
      title: "Unterwegs",
      entries: [
        { id: "a8f2kc", term: { text: "bus stop" }, meanings: [{ text: "Bushaltestelle" }] },
        {
          id: "p3z7rn",
          term: { text: "autumn", acceptedVariants: ["fall"] },
          meanings: [{ text: "Herbst" }, { text: "Spätjahr", acceptedVariants: ["Spaetjahr"] }],
          notes: "Britisch",
          examples: [{ text: "in autumn" }, { text: "It rains.", translation: "Es regnet." }],
          grammar: { partOfSpeech: "noun", forms: ["autumns"] },
          reviewStatus: "checked",
        },
      ],
    },
    { id: "w2n8vb", title: "Leer", entries: [] },
    {
      id: "x9c4kf",
      title: "Einkaufen",
      entries: [{ id: "m5t8hs", term: { text: "money" }, meanings: [{ text: "Geld" }] }],
    },
  ],
};

const exportedAt = new Date("2026-10-30T12:00:00.000Z");

/** Wie eine Datei, die die App wieder einliest. */
const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

describe("exportSetFile", () => {
  it("schreibt Kopf, Scope und Set-Angaben in der Reihenfolge der Spezifikation", () => {
    const file = exportSetFile(set, { type: "set" }, exportedAt);
    expect(Object.keys(file)).toEqual([
      "format",
      "formatVersion",
      "exportedAt",
      "scope",
      "set",
      "sections",
    ]);
    expect(file).toMatchObject({
      format: "vokabeltrainer-set",
      formatVersion: 1,
      exportedAt: "2026-10-30T12:00:00.000Z",
      scope: { type: "set" },
    });
    expect(file.set).toEqual({
      id: "k3m9q2x7ab",
      rev: setRev(set),
      title: "Lektion 4 – In der Stadt",
      termLanguage: "en",
      meaningLanguage: "de",
      level: "Klasse 6",
      license: "CC0",
      reviewStatus: "unchecked",
    });
  });

  it("schreibt IDs und Prüfwerte, Antworten ohne Varianten in Kurzform", () => {
    const file = exportSetFile(set, { type: "set" }, exportedAt);
    const [first, , last] = file.sections;
    expect(first).toEqual({
      id: "q7h3kd",
      rev: sectionRev(set.sections[0]!),
      title: "Unterwegs",
      entries: [
        {
          id: "a8f2kc",
          rev: entryRev(set.sections[0]!.entries[0]!),
          term: "bus stop",
          meanings: ["Bushaltestelle"],
        },
        {
          id: "p3z7rn",
          rev: entryRev(set.sections[0]!.entries[1]!),
          term: { text: "autumn", acceptedVariants: ["fall"] },
          meanings: ["Herbst", { text: "Spätjahr", acceptedVariants: ["Spaetjahr"] }],
          notes: "Britisch",
          examples: ["in autumn", { text: "It rains.", translation: "Es regnet." }],
          grammar: { partOfSpeech: "noun", forms: ["autumns"] },
          reviewStatus: "checked",
        },
      ],
    });
    expect(Object.keys(first!.entries[1]!)).toEqual([
      "id",
      "rev",
      "term",
      "meanings",
      "notes",
      "examples",
      "grammar",
      "reviewStatus",
    ]);
    expect(last).toMatchObject({ id: "x9c4kf", title: "Einkaufen" });
  });

  it("enthält keine Verwaltungsfelder", () => {
    const text = JSON.stringify(exportSetFile(set, { type: "set" }, exportedAt));
    for (const field of ["editCount", "createdAt", "updatedAt"]) expect(text).not.toContain(field);
  });

  it("ergibt nach Prüfen und Normalisieren wieder dasselbe Set", () => {
    const validated = validateSetFile(roundTrip(exportSetFile(set, { type: "set" }, exportedAt)));
    if (!validated.ok) throw new Error(validated.errors.join("\n"));
    expect(validated.warnings).toEqual([]);
    const { id: _id, editCount: _e, createdAt: _c, updatedAt: _u, ...content } = set;
    expect(normalizeSetFile(validated.file)).toEqual({ id: set.id, ...content });
  });

  it("nimmt beim Teil-Export nur die gewählten Sektionen in der Reihenfolge des Sets", () => {
    const file = exportSetFile(
      set,
      { type: "sections", sectionIds: ["x9c4kf", "q7h3kd"] },
      exportedAt,
    );
    expect(file.scope).toEqual({ type: "sections", sectionIds: ["q7h3kd", "x9c4kf"] });
    expect(file.sections.map((section) => section.id)).toEqual(["q7h3kd", "x9c4kf"]);
    expect(file.set.id).toBe(set.id);
    const validated = validateSetFile(roundTrip(file));
    expect(validated.ok && validated.warnings).toEqual([]);
  });

  it("lässt unbekannte Sektionen im Teil-Export weg", () => {
    const file = exportSetFile(
      set,
      { type: "sections", sectionIds: ["w2n8vb", "fehlt"] },
      exportedAt,
    );
    expect(file.scope).toEqual({ type: "sections", sectionIds: ["w2n8vb"] });
    expect(file.sections).toEqual([
      { id: "w2n8vb", rev: sectionRev(set.sections[1]!), title: "Leer", entries: [] },
    ]);
  });

  it("lässt sich als ganzes Set neu importieren, als Teil-Export nicht", () => {
    const options = { now: "2026-10-30T13:00:00.000Z", randomBytes: () => new Uint8Array() };
    const whole = prepareNewSet(
      JSON.stringify(exportSetFile(set, { type: "set" }, exportedAt)),
      options,
    );
    expect(whole.ok && whole.set.sections.map((section) => section.id)).toEqual([
      "q7h3kd",
      "w2n8vb",
      "x9c4kf",
    ]);
    const part = prepareNewSet(
      JSON.stringify(exportSetFile(set, { type: "sections", sectionIds: ["q7h3kd"] }, exportedAt)),
      options,
    );
    expect(part.ok).toBe(false);
  });
});

describe("exportFileName", () => {
  // Mittags, damit das Datum in jeder Zeitzone gleich bleibt.
  const date = new Date(2026, 9, 30, 12);

  it("nennt Titel und Datum", () => {
    expect(exportFileName(set, { type: "set" }, date)).toBe(
      "Lektion 4 – In der Stadt_2026-10-30.json",
    );
  });

  it("nennt beim Teil-Export die Sektion oder die Zahl der Sektionen", () => {
    expect(exportFileName(set, { type: "sections", sectionIds: ["x9c4kf"] }, date)).toBe(
      "Lektion 4 – In der Stadt_Einkaufen_2026-10-30.json",
    );
    expect(exportFileName(set, { type: "sections", sectionIds: ["q7h3kd", "x9c4kf"] }, date)).toBe(
      "Lektion 4 – In der Stadt_2 Sektionen_2026-10-30.json",
    );
  });

  it("ersetzt problematische Zeichen und kürzt auf 80 Zeichen", () => {
    expect(
      exportFileName({ ...set, title: 'A/B\\C: "D"? <E> | F*\tG' }, { type: "set" }, date),
    ).toBe("A-B-C- -D-- -E- - F- G_2026-10-30.json");
    const long = exportFileName({ ...set, title: "x".repeat(200) }, { type: "set" }, date);
    expect(long).toHaveLength(80);
    expect(long.endsWith("x_2026-10-30.json")).toBe(true);
  });
});
