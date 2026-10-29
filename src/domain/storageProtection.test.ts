import { describe, expect, it } from "vitest";
import {
  type ProtectionNotice,
  protectionNotice,
  type ProtectionSituation,
} from "./storageProtection";

const base: ProtectionSituation = {
  persistence: "not-granted",
  ios: false,
  installed: false,
  hasSets: true,
};

describe("protectionNotice", () => {
  it.each<[string, Partial<ProtectionSituation>, ProtectionNotice]>([
    ["gewährter Speicher braucht keinen Hinweis", { persistence: "granted" }, null],
    ["gewährt auch auf iOS im Tab nicht", { persistence: "granted", ios: true }, null],
    ["iOS im Tab: Anleitung", { ios: true }, "install"],
    ["iOS im Tab schon ohne Sets: Anleitung", { ios: true, hasSets: false }, "install"],
    [
      "iOS im Tab ohne Unterstützung: Anleitung",
      { ios: true, persistence: "unsupported" },
      "install",
    ],
    ["iOS installiert, nicht gewährt: Backup", { ios: true, installed: true }, "backup"],
    ["iOS installiert ohne Sets: nichts", { ios: true, installed: true, hasSets: false }, null],
    ["sonst nicht gewährt mit Sets: Backup", {}, "backup"],
    ["nicht unterstützt mit Sets: Backup", { persistence: "unsupported" }, "backup"],
    ["installiert, nicht gewährt: Backup", { installed: true }, "backup"],
    ["ohne Sets: nichts", { hasSets: false }, null],
  ])("%s", (_name, situation, expected) => {
    expect(protectionNotice({ ...base, ...situation })).toBe(expected);
  });
});
