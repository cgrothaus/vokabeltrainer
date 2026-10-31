import { describe, expect, it } from "vitest";
import { diffImport, type EntryChange, type ImportDiff, type ImportMode } from "./diff";
import { exportSetFile, type ExportScope } from "./exportSet";
import { readSetFile } from "./importSet";
import { applyImport, type ImportDecisions, NO_DECISIONS } from "./merge";
import type { StoredEntry, StoredSet } from "./model";

const entry = (id: string, term: string, meaning: string, extra: Partial<StoredEntry> = {}) =>
  ({ id, term: { text: term }, meanings: [{ text: meaning }], ...extra }) as StoredEntry;

const local: StoredSet = {
  id: "k3m9q2x7ab",
  editCount: 4,
  createdAt: "2026-10-19T17:00:00.000Z",
  updatedAt: "2026-10-20T17:00:00.000Z",
  title: "Lektion 4",
  termLanguage: "en",
  meaningLanguage: "de",
  level: "Klasse 6",
  sections: [
    {
      id: "wet111",
      title: "Wetter",
      entries: [
        entry("rain11", "rain", "Regen", {
          notes: "auch: Niederschlag",
          grammar: { partOfSpeech: "noun", plural: "rains" },
        }),
        entry("snow11", "snow", "Schnee"),
        entry("sun111", "sun", "Sonne"),
      ],
    },
    {
      id: "eat111",
      title: "Essen",
      entries: [entry("appl11", "apple", "Apfel"), entry("brea11", "bread", "Brot")],
    },
    { id: "emp111", title: "Leer", entries: [] },
  ],
};

/** Ein Export, wie ihn die App schreibt, als veränderbares JSON. */
type Json = Record<string, any>;
const exported = (set: StoredSet, scope: ExportScope = { type: "set" }): Json =>
  JSON.parse(JSON.stringify(exportSetFile(set, scope, new Date("2026-10-30T12:00:00Z"))));

const sectionOf = (file: Json, id: string): Json =>
  file.sections.find((section: Json) => section.id === id);
const entryOf = (file: Json, id: string): Json =>
  file.sections.flatMap((section: Json) => section.entries).find((item: Json) => item.id === id);

function diff(base: StoredSet, file: Json, mode: ImportMode = "update"): ImportDiff {
  const read = readSetFile(JSON.stringify(file));
  if (!read.ok) throw new Error(read.errors.join("\n"));
  const result = diffImport(base, read.file, mode);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.diff;
}

function errors(base: StoredSet, file: Json): string[] {
  const read = readSetFile(JSON.stringify(file));
  if (!read.ok) throw new Error(read.errors.join("\n"));
  const result = diffImport(base, read.file, "update");
  return result.ok ? [] : result.errors;
}

let counter = 0;
const randomBytes = (count: number) => Uint8Array.from({ length: count }, () => counter++ % 31);
const apply = (base: StoredSet, result: ImportDiff, decisions: ImportDecisions = NO_DECISIONS) =>
  applyImport(base, result, decisions, randomBytes);

const change = (result: ImportDiff, key: string): EntryChange => {
  const found = result.entries.find((item) => item.key === key);
  if (!found) throw new Error(`keine Änderung ${key}`);
  return found;
};

/** Das Set mit einem geänderten Eintrag, wie nach einer Bearbeitung in der App. */
function editedLocally(id: string, edit: (item: StoredEntry) => StoredEntry): StoredSet {
  return {
    ...local,
    sections: local.sections.map((section) => ({
      ...section,
      entries: section.entries.map((item) => (item.id === id ? edit(item) : item)),
    })),
  };
}

const terms = (set: StoredSet) =>
  set.sections.map((section) => [section.title, section.entries.map((item) => item.term.text)]);

describe("diffImport – Rundweg", () => {
  it("findet in einem unveränderten Export keine Änderungen, beim Aktualisieren wie beim Ersetzen", () => {
    for (const mode of ["update", "replace"] as const) {
      const result = diff(local, exported(local), mode);
      expect(result.hasChanges).toBe(false);
      expect(result.entries.every((item) => item.kind === "unchanged")).toBe(true);
      expect(result.counts.unchanged).toBe(5);
      expect(apply(local, result)).toStrictEqual(local);
    }
  });
});

describe("diffImport – Konflikttabelle (TDD 9.5)", () => {
  it("Schritt 1: in der Datei unverändert → der lokale Stand bleibt, auch wenn er geändert wurde", () => {
    const file = exported(local);
    const changed = editedLocally("snow11", (item) => ({ ...item, notes: "neu in der App" }));
    for (const mode of ["update", "replace"] as const) {
      const result = diff(changed, file, mode);
      expect(change(result, "entry:snow11").kind).toBe("unchanged");
      expect(apply(changed, result)).toStrictEqual(changed);
    }
  });

  it("Schritt 2: Datei entspricht dem lokalen Stand → keine Änderung", () => {
    const changed = editedLocally("snow11", (item) => ({ ...item, notes: "gleich" }));
    const file = exported(local);
    entryOf(file, "snow11").notes = "gleich";
    expect(change(diff(changed, file), "entry:snow11").kind).toBe("unchanged");
  });

  it("Schritt 3: nur in der Datei geändert → die Datei wird übernommen", () => {
    const file = exported(local);
    entryOf(file, "snow11").meanings = ["Schnee", "Schneefall"];
    const result = diff(local, file);
    const snow = change(result, "entry:snow11");
    expect(snow.kind).toBe("changed");
    expect(snow.file?.meanings).toEqual([{ text: "Schnee" }, { text: "Schneefall" }]);
    expect(result.counts.changed).toBe(1);
    expect(result.hasChanges).toBe(true);
    const applied = apply(local, result);
    expect(applied.sections[0]!.entries[1]).toStrictEqual(
      entry("snow11", "snow", "Schnee", { meanings: [{ text: "Schnee" }, { text: "Schneefall" }] }),
    );
  });

  it("Schritt 4: in App und Datei geändert → Konflikt; ohne Wahl bleibt die App, sonst die Datei", () => {
    const file = exported(local);
    entryOf(file, "snow11").notes = "aus der Datei";
    const changed = editedLocally("snow11", (item) => ({ ...item, notes: "aus der App" }));
    const result = diff(changed, file);
    const snow = change(result, "entry:snow11");
    expect(snow.kind).toBe("conflict");
    expect(snow.local?.notes).toBe("aus der App");
    expect(snow.file?.notes).toBe("aus der Datei");
    expect(result.counts.conflict).toBe(1);
    expect(apply(changed, result).sections[0]!.entries[1]!.notes).toBe("aus der App");
    const taken = apply(changed, result, { takeFile: new Set(["entry:snow11"]), adopt: new Set() });
    expect(taken.sections[0]!.entries[1]!.notes).toBe("aus der Datei");
  });

  it("ohne Prüfwert: gleich → keine Änderung, verschieden → Konflikt", () => {
    const file = exported(local);
    delete entryOf(file, "sun111").rev;
    delete entryOf(file, "snow11").rev;
    entryOf(file, "snow11").notes = "ohne rev";
    const result = diff(local, file);
    expect(change(result, "entry:sun111").kind).toBe("unchanged");
    expect(change(result, "entry:snow11").kind).toBe("conflict");
  });

  it("Kurz- und Langform ergeben denselben Prüfwert", () => {
    const file = exported(local);
    entryOf(file, "snow11").term = { text: "snow" };
    entryOf(file, "snow11").meanings = [{ text: "Schnee", acceptedVariants: [] }];
    expect(change(diff(local, file), "entry:snow11").kind).toBe("unchanged");
  });

  it("vergleicht Sektionstitel und Set-Angaben nach derselben Tabelle", () => {
    const file = exported(local);
    sectionOf(file, "wet111").title = "Das Wetter";
    file.set.title = "Lektion 4 – Wetter";
    const renamed: StoredSet = {
      ...local,
      sections: local.sections.map((section) =>
        section.id === "eat111" ? { ...section, title: "Essen und Trinken" } : section,
      ),
    };
    sectionOf(file, "eat111").title = "Mahlzeiten";
    const result = diff(renamed, file);
    expect(result.sections.find((item) => item.key === "section:wet111")).toMatchObject({
      kind: "changed",
      title: "Wetter",
      fileTitle: "Das Wetter",
    });
    expect(result.sections.find((item) => item.key === "section:eat111")?.kind).toBe("conflict");
    expect(result.setInfo?.kind).toBe("changed");
    const applied = apply(renamed, result);
    expect(applied.title).toBe("Lektion 4 – Wetter");
    expect(applied.sections.map((section) => section.title)).toEqual([
      "Das Wetter",
      "Essen und Trinken",
      "Leer",
    ]);
    const taken = apply(renamed, result, {
      takeFile: new Set(["section:eat111"]),
      adopt: new Set(),
    });
    expect(taken.sections[1]!.title).toBe("Mahlzeiten");
  });

  it("Set-Angaben im Konflikt: ohne Wahl bleiben sie, mit Wahl gilt die Datei", () => {
    const file = exported(local);
    file.set.level = "Klasse 7";
    const changed: StoredSet = { ...local, level: "Klasse 5" };
    const result = diff(changed, file);
    expect(result.setInfo?.kind).toBe("conflict");
    expect(apply(changed, result).level).toBe("Klasse 5");
    expect(apply(changed, result, { takeFile: new Set(["set"]), adopt: new Set() }).level).toBe(
      "Klasse 7",
    );
  });
});

describe("diffImport – Aktualisieren und Ersetzen (TDD 9.3, 9.4)", () => {
  it("Aktualisieren: fehlende Felder bleiben, beim Ersetzen werden sie entfernt", () => {
    const file = exported(local);
    delete entryOf(file, "rain11").notes;
    expect(change(diff(local, file, "update"), "entry:rain11").kind).toBe("unchanged");
    const replaced = diff(local, file, "replace");
    expect(change(replaced, "entry:rain11").kind).toBe("changed");
    expect(apply(local, replaced).sections[0]!.entries[0]).not.toHaveProperty("notes");
  });

  it("Aktualisieren: `null` löscht ein Feld, auch einzeln in der Grammatik", () => {
    const file = exported(local);
    entryOf(file, "rain11").notes = null;
    entryOf(file, "rain11").grammar = { plural: null };
    const result = diff(local, file);
    expect(change(result, "entry:rain11").kind).toBe("changed");
    expect(apply(local, result).sections[0]!.entries[0]).toStrictEqual(
      entry("rain11", "rain", "Regen", { grammar: { partOfSpeech: "noun" } }),
    );
  });

  it("Aktualisieren: `null` für die Grammatik löscht sie ganz", () => {
    const file = exported(local);
    entryOf(file, "rain11").grammar = null;
    const applied = apply(local, diff(local, file));
    expect(applied.sections[0]!.entries[0]).not.toHaveProperty("grammar");
  });

  it("ersetzt Listen als Ganzes", () => {
    const file = exported(local);
    entryOf(file, "rain11").meanings = ["Regenwetter"];
    entryOf(file, "rain11").grammar = { forms: ["rained"] };
    const applied = apply(local, diff(local, file)).sections[0]!.entries[0]!;
    expect(applied.meanings).toEqual([{ text: "Regenwetter" }]);
    expect(applied.grammar).toEqual({ partOfSpeech: "noun", plural: "rains", forms: ["rained"] });
  });

  it("legt Einträge und Sektionen ohne ID neu an, auch bei gleichem Text", () => {
    const file = exported(local);
    sectionOf(file, "wet111").entries.splice(1, 0, { term: "rain", meanings: ["Regen"] });
    file.sections.push({ title: "Wetter", entries: [{ term: "fog", meanings: ["Nebel"] }] });
    const result = diff(local, file);
    expect(result.counts.added).toBe(2);
    expect(result.sections.at(-1)).toMatchObject({ kind: "added", title: "Wetter" });
    const applied = apply(local, result);
    expect(terms(applied)).toEqual([
      ["Wetter", ["rain", "rain", "snow", "sun"]],
      ["Essen", ["apple", "bread"]],
      ["Leer", []],
      ["Wetter", ["fog"]],
    ]);
    const ids = applied.sections.flatMap((section) => [
      section.id,
      ...section.entries.map((item) => item.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(applied.sections[0]!.entries[1]!.id).toHaveLength(6);
    expect(applied.sections[3]!.id).toHaveLength(6);
  });

  it("Aktualisieren: nicht enthaltene Einträge und Sektionen bleiben", () => {
    const file = exported(local);
    sectionOf(file, "wet111").entries = [entryOf(file, "rain11")];
    file.sections = file.sections.filter((section: Json) => section.id !== "eat111");
    const result = diff(local, file);
    expect(result.hasChanges).toBe(false);
    expect(apply(local, result)).toStrictEqual(local);
  });

  it("Ersetzen: fehlende Einträge und Sektionen werden gelöscht und einzeln aufgeführt", () => {
    const file = exported(local);
    sectionOf(file, "wet111").entries = [entryOf(file, "rain11")];
    file.sections = file.sections.filter((section: Json) => section.id !== "eat111");
    const result = diff(local, file, "replace");
    expect(result.counts.removed).toBe(4);
    expect(
      result.entries.filter((item) => item.kind === "removed").map((item) => item.local?.id),
    ).toEqual(["snow11", "sun111", "appl11", "brea11"]);
    expect(result.sections.find((item) => item.key === "section:eat111")?.kind).toBe("removed");
    expect(terms(apply(local, result))).toEqual([
      ["Wetter", ["rain"]],
      ["Leer", []],
    ]);
  });
});

describe("diffImport – Reihenfolge", () => {
  it("Aktualisieren: Reihenfolge der Datei, nicht enthaltene Einträge danach; die Vorschau nennt sie", () => {
    const file = exported(local);
    const weather = sectionOf(file, "wet111");
    weather.entries = [weather.entries[2], weather.entries[0]];
    const result = diff(local, file);
    expect(result.sections.find((item) => item.key === "section:wet111")?.reordered).toBe(true);
    expect(result.hasChanges).toBe(true);
    expect(terms(apply(local, result))[0]).toEqual(["Wetter", ["sun", "rain", "snow"]]);
  });

  it("ohne Umstellung ist keine Sektion umsortiert, auch wenn Einträge dazukommen", () => {
    const file = exported(local);
    sectionOf(file, "wet111").entries.unshift({ term: "fog", meanings: ["Nebel"] });
    const result = diff(local, file);
    expect(result.sections.some((item) => item.reordered)).toBe(false);
  });

  it("bekannte Sektionen behalten ihre Position, außer beim Ersetzen des ganzen Sets", () => {
    const file = exported(local);
    file.sections.reverse();
    const updated = diff(local, file, "update");
    expect(updated.sectionsReordered).toBe(false);
    expect(apply(local, updated).sections.map((section) => section.id)).toEqual([
      "wet111",
      "eat111",
      "emp111",
    ]);
    const replaced = diff(local, file, "replace");
    expect(replaced.sectionsReordered).toBe(true);
    expect(replaced.hasChanges).toBe(true);
    expect(apply(local, replaced).sections.map((section) => section.id)).toEqual([
      "emp111",
      "eat111",
      "wet111",
    ]);
  });
});

describe("diffImport – Sonderfälle (TDD 9.6)", () => {
  it("unbekannte Eintrags-ID: nicht mehr vorhanden, auf Wunsch neu mit neuer ID an ihrer Stelle", () => {
    const file = exported(local);
    sectionOf(file, "wet111").entries.splice(1, 0, {
      id: "gone11",
      term: "hail",
      meanings: ["Hagel"],
    });
    const result = diff(local, file);
    const hail = change(result, "entry:gone11");
    expect(hail).toMatchObject({ kind: "missingLocally", section: "Wetter" });
    expect(result.counts.missingLocally).toBe(1);
    expect(apply(local, result)).toStrictEqual(local);
    const adopted = apply(local, result, { takeFile: new Set(), adopt: new Set(["entry:gone11"]) });
    const added = adopted.sections[0]!.entries[1]!;
    expect(added.term.text).toBe("hail");
    expect(added.id).not.toBe("gone11");
  });

  it("verschiebt einen Eintrag in eine andere Sektion im Scope", () => {
    const file = exported(local);
    const snow = entryOf(file, "snow11");
    sectionOf(file, "wet111").entries.splice(1, 1);
    sectionOf(file, "eat111").entries.push(snow);
    const result = diff(local, file);
    expect(change(result, "entry:snow11")).toMatchObject({
      kind: "unchanged",
      section: "Essen",
      movedFrom: "Wetter",
    });
    expect(result.counts.moved).toBe(1);
    expect(result.hasChanges).toBe(true);
    expect(terms(apply(local, result)).slice(0, 2)).toEqual([
      ["Wetter", ["rain", "sun"]],
      ["Essen", ["apple", "bread", "snow"]],
    ]);
  });

  it("übernimmt keinen Eintrag aus einer Sektion außerhalb des Scopes", () => {
    const file = exported(local, { type: "sections", sectionIds: ["wet111"] });
    sectionOf(file, "wet111").entries.push({ ...entryOf(exported(local), "appl11") });
    const result = diff(local, file);
    expect(change(result, "entry:appl11")).toMatchObject({
      kind: "notApplicable",
      section: "Essen",
    });
    expect(result.counts.notApplicable).toBe(1);
    expect(result.hasChanges).toBe(false);
    expect(apply(local, result)).toStrictEqual(local);
  });

  it("lässt Sektionen außerhalb des Scopes unberührt, auch beim Ersetzen", () => {
    const file = exported(local, { type: "sections", sectionIds: ["eat111"] });
    sectionOf(file, "eat111").entries = [{ term: "milk", meanings: ["Milch"] }];
    file.set.title = "Anders";
    const result = diff(local, file, "replace");
    const applied = apply(local, result);
    expect(applied.sections[0]).toStrictEqual(local.sections[0]);
    expect(applied.sections[2]).toStrictEqual(local.sections[2]);
    expect(applied.title).toBe("Lektion 4");
    expect(terms(applied)[1]).toEqual(["Essen", ["milk"]]);
  });

  it("warnt, wenn ein Teil-Export die Set-Angaben ändert, und übernimmt sie nicht", () => {
    const file = exported(local, { type: "sections", sectionIds: ["eat111"] });
    file.set.title = "Anders";
    const result = diff(local, file);
    expect(result.setInfo).toBeUndefined();
    expect(result.warnings).toEqual([
      "Die Angaben zum Set wurden in der Datei geändert. Die Datei enthält nur einen Teil des Sets, deshalb werden sie nicht übernommen.",
    ]);
    expect(
      diff(local, exported(local, { type: "sections", sectionIds: ["eat111"] })).warnings,
    ).toEqual([]);
  });

  it("Ersetzen eines Teils: eine genannte Sektion, die im Inhalt fehlt, wird gelöscht", () => {
    const file = exported(local, { type: "sections", sectionIds: ["wet111", "eat111"] });
    file.sections = file.sections.filter((section: Json) => section.id !== "eat111");
    const replaced = diff(local, file, "replace");
    expect(replaced.sections.find((item) => item.key === "section:eat111")?.kind).toBe("removed");
    expect(apply(local, replaced).sections.map((section) => section.id)).toEqual([
      "wet111",
      "emp111",
    ]);
    expect(apply(local, diff(local, file, "update"))).toStrictEqual(local);
  });

  it("lehnt einen Scope mit einer lokal unbekannten Sektion ab", () => {
    const file = exported(local, { type: "sections", sectionIds: ["eat111"] });
    file.scope.sectionIds = ["gone22"];
    sectionOf(file, "eat111").id = "gone22";
    expect(errors(local, file)).toEqual([
      "Die Sektion „Essen“ gibt es in „Lektion 4“ nicht mehr. Die Datei passt nicht mehr zum Set und wird nicht übernommen.",
    ]);
    sectionOf(file, "gone22").id = "eat111";
    expect(errors(local, file)).toEqual([
      "Die Datei bezieht sich auf eine Sektion, die es in „Lektion 4“ nicht mehr gibt. Die Datei passt nicht mehr zum Set und wird nicht übernommen.",
      "Die Sektion „Essen“ steht in der Datei, gehört aber nicht zum exportierten Teil. Die Datei ist widersprüchlich und wird nicht übernommen.",
    ]);
  });

  it("lehnt eine bekannte Sektion außerhalb des Scopes ab", () => {
    const file = exported(local, { type: "sections", sectionIds: ["eat111"] });
    file.sections.push(exported(local).sections[0]);
    expect(errors(local, file)).toEqual([
      "Die Sektion „Wetter“ steht in der Datei, gehört aber nicht zum exportierten Teil. Die Datei ist widersprüchlich und wird nicht übernommen.",
    ]);
  });

  it("eine lokal gelöschte Sektion gilt beim ganzen Set als nicht mehr vorhanden", () => {
    const file = exported(local);
    file.sections.push({
      id: "gone33",
      rev: "abcdefgh",
      title: "Kleidung",
      entries: [{ id: "shoe11", term: "shoe", meanings: ["Schuh"] }],
    });
    const result = diff(local, file);
    expect(result.sections.at(-1)).toMatchObject({ kind: "missingLocally", title: "Kleidung" });
    expect(change(result, "entry:shoe11").kind).toBe("missingLocally");
    expect(apply(local, result)).toStrictEqual(local);
    const adopted = apply(local, result, { takeFile: new Set(), adopt: new Set(["entry:shoe11"]) });
    expect(terms(adopted).at(-1)).toEqual(["Kleidung", ["shoe"]]);
    expect(adopted.sections.at(-1)!.id).not.toBe("gone33");
  });

  it("ein bekannter Eintrag in einer lokal gelöschten Sektion legt sie mit ihm neu an", () => {
    const file = exported(local);
    const sun = entryOf(file, "sun111");
    sectionOf(file, "wet111").entries.splice(2, 1);
    file.sections.push({ id: "gone33", title: "Himmel", entries: [sun] });
    const result = diff(local, file);
    expect(change(result, "entry:sun111")).toMatchObject({
      section: "Himmel",
      movedFrom: "Wetter",
    });
    expect(terms(apply(local, result)).at(-1)).toEqual(["Himmel", ["sun"]]);
  });
});

describe("applyImport", () => {
  it("behält Verwaltungsfelder; editCount und updatedAt setzt erst das Speichern", () => {
    const file = exported(local);
    entryOf(file, "snow11").notes = "neu";
    const applied = apply(local, diff(local, file));
    expect(applied).toMatchObject({
      id: local.id,
      editCount: 4,
      createdAt: local.createdAt,
      updatedAt: local.updatedAt,
    });
  });

  it("zählt alle Arten", () => {
    const file = exported(local);
    entryOf(file, "snow11").notes = "neu";
    sectionOf(file, "eat111").entries.push({ term: "milk", meanings: ["Milch"] });
    expect(diff(local, file).counts).toEqual({
      unchanged: 4,
      changed: 1,
      conflict: 0,
      added: 1,
      removed: 0,
      moved: 0,
      missingLocally: 0,
      notApplicable: 0,
    });
  });
});
