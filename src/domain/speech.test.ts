import { describe, expect, it } from "vitest";
import { pickVoice, readSpeakAloud } from "./speech";

const voice = (lang: string, localService = true, name = lang) => ({ lang, localService, name });

describe("pickVoice", () => {
  it("nimmt zuerst den genauen Sprachcode, ohne Groß- und Kleinschreibung", () => {
    const voices = [voice("en-US"), voice("en-GB"), voice("de-DE")];
    expect(pickVoice(voices, "en-GB")?.name).toBe("en-GB");
    expect(pickVoice(voices, "EN-gb")?.name).toBe("en-GB");
  });

  it("nimmt sonst eine Stimme derselben Sprache", () => {
    expect(pickVoice([voice("de-DE"), voice("en-US")], "en")?.name).toBe("en-US");
    expect(pickVoice([voice("en-US")], "en-AU")?.name).toBe("en-US");
  });

  it("versteht Codes mit Unterstrich, wie sie Android liefert", () => {
    expect(pickVoice([voice("en_US")], "en-US")?.name).toBe("en_US");
    expect(pickVoice([voice("fr_FR")], "fr")?.name).toBe("fr_FR");
  });

  it("nimmt nur Stimmen auf dem Gerät", () => {
    expect(pickVoice([voice("en-US", false)], "en")).toBeUndefined();
    const voices = [voice("en-GB", false, "online"), voice("en-US", true, "local")];
    expect(pickVoice(voices, "en-GB")?.name).toBe("local");
  });

  it("findet nichts ohne passende Stimme", () => {
    expect(pickVoice([], "en")).toBeUndefined();
    expect(pickVoice([voice("de-DE")], "en")).toBeUndefined();
  });
});

describe("readSpeakAloud", () => {
  it("gilt nur bei true, alles andere ist aus", () => {
    expect(readSpeakAloud(true)).toBe(true);
    for (const value of [false, undefined, null, "true", 1, {}]) {
      expect(readSpeakAloud(value)).toBe(false);
    }
  });
});
