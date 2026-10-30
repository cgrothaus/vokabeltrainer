import { describe, expect, it } from "vitest";
import type { StoredSet } from "./model";
import {
  checkSectionTitle,
  emptySetInfoForm,
  formToSetInfo,
  type SetInfoForm,
  setInfoChanged,
  setInfoToForm,
} from "./setInfoForm";

const set: StoredSet = {
  id: "m4x8c2r9tw",
  editCount: 2,
  createdAt: "2026-10-20T18:00:00.000Z",
  updatedAt: "2026-10-21T18:00:00.000Z",
  title: "Englisch – Wetter",
  termLanguage: "en-GB",
  meaningLanguage: "de",
  level: "Klasse 6",
  source: "Eigene Zusammenstellung",
  notes: "Für die Probe",
  reviewStatus: "checked",
  sections: [],
};

const form = (overrides: Partial<SetInfoForm> = {}): SetInfoForm => ({
  ...emptySetInfoForm(),
  title: "Englisch – Wetter",
  ...overrides,
});

const errors = (value: SetInfoForm, previous?: StoredSet) => {
  const result = formToSetInfo(value, previous);
  return result.ok ? [] : result.errors;
};

describe("emptySetInfoForm und setInfoToForm", () => {
  it("beginnt leer mit Englisch → Deutsch", () => {
    expect(emptySetInfoForm()).toEqual({
      title: "",
      termLanguage: "en",
      meaningLanguage: "de",
      level: "",
      textbook: "",
      edition: "",
      source: "",
      license: "",
      notes: "",
      checked: false,
    });
  });

  it("ergibt mit formToSetInfo wieder dieselben Angaben", () => {
    expect(formToSetInfo(setInfoToForm(set), set)).toEqual({
      ok: true,
      info: {
        title: "Englisch – Wetter",
        termLanguage: "en-GB",
        meaningLanguage: "de",
        level: "Klasse 6",
        source: "Eigene Zusammenstellung",
        notes: "Für die Probe",
        reviewStatus: "checked",
      },
    });
  });
});

describe("formToSetInfo", () => {
  it("trimmt, kanonisiert Sprachcodes und lässt leere Angaben weg", () => {
    expect(
      formToSetInfo(form({ title: "  Wetter ", termLanguage: " EN-gb ", level: " ", notes: "" })),
    ).toEqual({
      ok: true,
      info: { title: "Wetter", termLanguage: "en-GB", meaningLanguage: "de" },
    });
  });

  it("verlangt Titel und gültige Sprachen", () => {
    expect(errors(form({ title: " ", termLanguage: "", meaningLanguage: "deutsch" }))).toEqual([
      { field: "title", message: "Der Titel fehlt." },
      { field: "termLanguage", message: "Die Lernsprache fehlt." },
      {
        field: "meaningLanguage",
        message: "„deutsch“ ist kein gültiger Sprachcode, z. B. „en“ oder „en-GB“.",
      },
    ]);
  });

  it("prüft die Höchstlängen", () => {
    expect(errors(form({ title: "x".repeat(201), notes: "x".repeat(2001) }))).toEqual([
      { field: "title", message: "Der Titel ist länger als 200 Zeichen." },
      { field: "notes", message: "Die Notiz ist länger als 2.000 Zeichen." },
    ]);
    expect(errors(form({ license: "x".repeat(201) }))).toEqual([
      { field: "license", message: "Die Lizenz ist länger als 200 Zeichen." },
    ]);
  });

  it("setzt den Prüfstatus wie beim Eintrag", () => {
    const status = (checked: boolean, previous?: StoredSet) => {
      const result = formToSetInfo(form({ checked }), previous);
      return result.ok ? result.info.reviewStatus : "Fehler";
    };
    expect(status(true)).toBe("checked");
    expect(status(false)).toBeUndefined();
    expect(status(false, set)).toBe("unchecked");
    expect(status(false, { ...set, reviewStatus: undefined })).toBeUndefined();
  });
});

describe("setInfoChanged", () => {
  it("übersieht Leerraum am Rand und erkennt echte Änderungen", () => {
    const original = setInfoToForm(set);
    expect(setInfoChanged({ ...original, title: ` ${original.title} ` }, original)).toBe(false);
    expect(setInfoChanged({ ...original, level: "Klasse 7" }, original)).toBe(true);
    expect(setInfoChanged({ ...original, termLanguage: "en" }, original)).toBe(true);
    expect(setInfoChanged({ ...original, checked: false }, original)).toBe(true);
  });
});

describe("checkSectionTitle", () => {
  it("trimmt und verlangt einen Titel bis 200 Zeichen", () => {
    expect(checkSectionTitle("  Wetter ")).toEqual({ ok: true, title: "Wetter" });
    expect(checkSectionTitle(" ")).toEqual({ ok: false, error: "Der Titel der Sektion fehlt." });
    expect(checkSectionTitle("x".repeat(201))).toEqual({
      ok: false,
      error: "Der Titel der Sektion ist länger als 200 Zeichen.",
    });
  });
});
