import { describe, expect, it } from "vitest";
import {
  type InstallSituation,
  installOffer,
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

describe("installOffer", () => {
  const offer: InstallSituation = {
    canInstall: true,
    hasSets: true,
    dismissed: false,
    notice: null,
  };
  it.each<[string, Partial<InstallSituation>, boolean]>([
    ["mit Set und Angebot des Browsers", {}, true],
    [
      "ohne Angebot des Browsers nicht (Safari, Firefox, installiert)",
      { canInstall: false },
      false,
    ],
    ["ohne Set nicht", { hasSets: false }, false],
    ["nach „Später“ nicht mehr", { dismissed: true }, false],
    // Der Hinweis auf nicht geschützte Daten bietet das Installieren dann selbst an.
    ["nicht neben dem Hinweis auf Backups", { notice: "backup" }, false],
  ])("%s", (_name, situation, expected) => {
    expect(installOffer({ ...offer, ...situation })).toBe(expected);
  });
});
