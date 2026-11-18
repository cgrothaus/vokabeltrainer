// Speicherschutz-Hinweis in der Bibliothek (TDD 6.6, FR-31, AK-20, D-38): welcher Hinweis passt zum
// Gerät. Auf iOS und iPadOS schützt erst der Home-Bildschirm die Daten (S-11); die App dort hat einen
// eigenen Speicher, deshalb erscheint die Anleitung schon vor dem ersten Set.

export type PersistenceState = "granted" | "not-granted" | "unsupported";

export interface ProtectionSituation {
  persistence: PersistenceState;
  /** iPhone, iPad oder iPod, gleich in welchem Browser. */
  ios: boolean;
  /** Als App vom Home-Bildschirm gestartet. */
  installed: boolean;
  hasSets: boolean;
}

/** `install`: Anleitung zum Home-Bildschirm; `backup`: Empfehlung regelmäßiger Backups. */
export type ProtectionNotice = "install" | "backup" | null;

export function protectionNotice(situation: ProtectionSituation): ProtectionNotice {
  if (situation.persistence === "granted") return null;
  if (situation.ios && !situation.installed) return "install";
  return situation.hasSets ? "backup" : null;
}

export interface InstallSituation {
  /** Der Browser hat die Installation angeboten (`beforeinstallprompt`, TDD 5.1). */
  canInstall: boolean;
  hasSets: boolean;
  /** „Später“ wurde schon gewählt. */
  dismissed: boolean;
  /** Der Speicherschutz-Hinweis daneben; der Hinweis auf Backups bietet das Installieren selbst an. */
  notice: ProtectionNotice;
}

/** Ob die Bibliothek einmal die ruhige Zeile „Als App installieren?“ zeigt (TDD 5.1, FR-35). */
export function installOffer(situation: InstallSituation): boolean {
  return (
    situation.canInstall &&
    situation.hasSets &&
    !situation.dismissed &&
    situation.notice !== "backup"
  );
}
