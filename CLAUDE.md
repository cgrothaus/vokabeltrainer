# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projektstand

Mobiler, offlinefähiger Vokabeltrainer als installierbare Web-App (PWA), ohne Backend. Meilenstein M0 (Walking Skeleton) läuft; aktueller Stand siehe TDD Kap. 21.

Maßgebliche Dokumente in `docs/`:

| Dokument | Inhalt |
|---|---|
| `PRD_Vokabeltrainer_Allgemein_v2.md` | Was und warum: Anforderungen (FR, NFR, DF), Akzeptanzkriterien (AK), Risiken (R), Meilensteine |
| `TDD_Vokabeltrainer_Allgemein_v2.md` | Wie: Architektur, Datenmodell, Abläufe, Tests, Entscheidungen (D-xx, Kap. 17), technische Akzeptanzkriterien (TAK-xx, Kap. 16), **Umsetzungsplan (Kap. 21)** |
| `Formatspezifikation_Vokabelset_v1.md` | Austauschformat `vokabeltrainer-set` für Menschen, LLMs und Validator; gilt bei Widerspruch zum JSON Schema |
| `20261019_TDD_v1_Review_Notizen.md` | Abgeschlossenes Protokoll (F-xx, T-xx); wird nicht fortgeschrieben |

Vor einer Umsetzung das betreffende Arbeitspaket (S-xx) in TDD Kap. 21 und die dort verlinkten Kapitel lesen.

## Arbeitsregeln

- Dokumente, UI-Texte, Fehlermeldungen und Commit-Messages auf **Deutsch**; Code, Bezeichner und Datenfelder auf Englisch. In der Oberfläche erscheinen keine technischen Begriffe wie „ID“, „rev“ oder „IndexedDB“.
- **Umsetzungsstand nur in TDD Kap. 21** pflegen (🔲 offen · 🔶 in Arbeit · ✅ erledigt). Alle anderen Kapitel beschreiben den Sollzustand.
- IDs (FR, D, TAK, S …) werden nie neu vergeben; entfallene Einträge bleiben mit „entfallen“ stehen. Neue technische Entscheidungen bekommen eine D-Nummer in TDD Kap. 17, neue Arbeitspakete fortlaufende S-Nummern.
- Inhaltliche Änderungen an PRD/TDD erhöhen die Version im Dokumentkopf und bekommen eine Zeile in der Änderungshistorie (inkl. Spalte „Entstehung“ mit Modell). Commit-Messages nennen das Dokument und die Version, z. B. „PRD 2.4: …“.
- `docs/code-iteration1/` (per `.gitignore` ausgeschlossen) enthält den alten Prototyp mit **Lehrwerksvokabeln**. Diese Inhalte dürfen nicht in das Repository, in Fixtures oder in das Beispielset übernommen werden; das Repository ist öffentlich. Das Ablaufverhalten des Prototyps (z. B. Karteikarten-Warteschlange) darf als Vorlage dienen.
- Schlank bleiben: **keine Laufzeitabhängigkeiten**, kein Framework, kein CDN (D-04). Neue Entwicklungsabhängigkeiten nur mit klarem Nutzen und Eintrag in TDD 4.1.
- **Diese Datei aktuell halten:** Neue Erkenntnisse, die künftigen Sitzungen helfen (geänderte Befehle, Stolperstellen, neue Konventionen, Abweichungen vom geplanten Stand), sofort hier ergänzen. Nach Abschluss eines Arbeitspakets prüfen, ob die Datei noch stimmt, und Veraltetes korrigieren oder entfernen. Kurz bleiben: nur, was sich nicht schnell aus Code oder Dokumenten ergibt.

## Git-Ablauf

Diese Regeln gelten als Auftrag zum Committen und Mergen; gepusht wird nur auf ausdrückliche Anweisung.

1. **Branch anlegen:** Für jedes nicht-triviale Arbeitspaket (jedes S-xx, jede Änderung mit Code oder Tests, jede neue Dokumentversion) vor der ersten Änderung vom aktuellen `main` abzweigen: `git switch -c s-07-import-validierung` (mit S-Nummer `s-<nr>-<stichwort>`, sonst nur `<stichwort>`; klein, mit Bindestrichen). Direkt auf `main` nur Triviales, das in einen einzigen Commit passt und weder Code, Tests noch PRD/TDD berührt, z. B. Tippfehler, README, CLAUDE.md, `.gitignore`.
2. **Klein committen:** Auf dem Branch nach jedem in sich stimmigen Schritt committen, z. B. Test und Implementierung einer Funktion, ein Konfigurationsschritt, eine Dokumentanpassung. Message: eine Zeile, Deutsch, Infinitivstil wie „Kurzform beim Import auflösen“, ohne S-Präfix. `npm run typecheck` und `npm test` sind vor jedem Commit grün (testgetrieben: Test und Implementierung zusammen committen). Dateien gezielt stagen (`git add <pfad>`), kein `git commit -a` und kein `git add -A`, solange noch andere Änderungen offen sind; vor dem Commit `git diff --cached --stat` prüfen. Sonst landen unfertige Änderungen im falschen Commit, und nach einem Push hilft kein Amend mehr.
3. **Abschließen mit Squash-Merge:** Wenn das Paket fertig ist – Akzeptanzkriterien erfüllt, `typecheck`, `test`, `build` und bei UI-Änderungen `test:e2e` grün, Status in TDD Kap. 21 noch auf dem Branch auf ✅, CLAUDE.md geprüft:

   ```bash
   git switch main
   git merge --squash s-07-import-validierung
   git commit                               # Message siehe unten
   git branch -D s-07-import-validierung    # -D nötig: Squash markiert den Branch nicht als gemergt
   ```

   Message wie bei `4c3494b`: Betreff `S-07: <Zusammenfassung> (TDD 2.3)` (Dokumentversion nur, wenn sie erhöht wurde), darunter eine knappe Stichpunktliste der wesentlichen Änderungen.

## Befehle

Eingerichtet (S-01, S-02):

```bash
npm run dev          # Vite-Dev-Server (Service Worker deaktiviert)
npm run build        # App nach dist/index.html (JS und CSS eingebettet), danach Build-Prüfung (TAK-01)
npm run preview      # gebautes Artefakt lokal ausliefern (Port 4173)
npm run typecheck    # tsc -b über die Projektreferenzen; `tsc --noEmit` im Wurzelverzeichnis prüft nichts
npm run format       # Prettier (Markdown ist ausgenommen, Dokumente werden von Hand formatiert)
npm test             # Vitest-Projekt `unit`: src/**/*.test.ts in Node
npm run test:e2e     # Playwright, Projekte mobile-chromium und mobile-webkit; baut selbst und startet `vite preview` auf Port 4180

npx vitest run src/domain/validate.test.ts      # einzelne Testdatei
npx vitest run -t "Kurzform"                    # Tests nach Name
npx vitest run --project build                  # nur Build-Prüfung gegen vorhandenes dist/
npx playwright test --project=mobile-webkit -g "Startseite"
```

Einmalig pro Rechner: `npx playwright install chromium webkit` (Browser für E2E) und `npm i -g @playwright/cli` (Browserprüfung durch den Agent; Skill liegt unter `.claude/skills/playwright-cli/`, Aktualisierung mit `playwright-cli install --skills`). Prüfung z. B. mit `npm run preview` und `playwright-cli open --mobile http://localhost:4173/`; Ausgaben landen in `.playwright-cli/`.

Geplant mit S-05: `npm run build` baut zusätzlich den Service Worker; die Build-Prüfung kontrolliert dann auch `sw.js`, Manifest und Icons.

Nach UI-Änderungen das Verhalten mit `playwright-cli` gegen Dev-Server oder `vite preview` prüfen und die E2E-Smoke-Tests laufen lassen.

## CI (S-03, TDD 4.5)

`.github/workflows/ci.yml` läuft bei jedem Push (jeder Branch) und Pull Request: `npm ci` → `format:check` → `typecheck` → `test` → `build` → Browserinstallation → `test:e2e`. Lokal nachstellen mit denselben Befehlen und `CI=1` vor `npm run test:e2e` (ein Worker, `github`-Reporter). Läufe verfolgen mit `gh run watch`; bei Fehlern liegt der Playwright-Report als Artefakt `playwright-report` am Lauf (`gh run download <id> -n playwright-report`). Die Playwright-Version steht nur in `package.json` (kein Container-Image, kein Browser-Cache).

## Architektur (Soll, TDD Kap. 3–7)

**Auslieferung:** eine `index.html` mit eingebettetem JS und CSS (`vite-plugin-singlefile`) plus `sw.js`, `manifest.webmanifest` und Icons. Alle Verweise relativ (läuft unter GitHub-Pages-Unterpfad und eigener Domain). Build zweistufig: `vite build` → Hash von `dist/index.html` → `vite build -c vite.sw.config.ts` mit dem Hash als Cache-Version, damit sich `sw.js` genau dann ändert, wenn sich die App ändert. Deployment auf GitHub Pages nur nach grüner CI.

**TypeScript 7** (native `tsc`), Konfiguration über Projektreferenzen: `tsconfig.app.json` (`src/`, DOM), `tsconfig.node.json` (Vite-Konfiguration). Mit dem ersten Modul in `domain/` kommt `tsconfig.domain.json` ohne DOM-Typen dazu (TAK-04) und wird in `tsconfig.json` referenziert. Verzeichnisse aus TDD 3.1 entstehen erst mit ihrer ersten Datei.

**CSS:** kein `light-dark()` verwenden – Vite rechnet es auf `prefers-color-scheme` herunter, dann greift die manuelle Umschaltung (TDD 13.5) nicht. Farben als Variablen in `:root`, Dunkelmodus per Media Query.

**Schichten unter `src/`** – die Importrichtung ist hart:

- `domain/` – reine Funktionen (Validierung, Normalisierung, Diff/Merge, Übungslogik, Statistik, Migrationen). Importiert nichts aus `app/`, `storage/`, `platform/` und nutzt kein `window`, `document` oder `indexedDB` (TAK-04).
- `storage/` – IndexedDB; kennt `domain/model.ts`, aber keine UI.
- `platform/` – Browser-APIs (Service Worker, `persist()`, Datei ausliefern, Zwischenablage).
- `app/` – UI ohne Framework: Hash-Routing, Store mit `subscribe`, Ansichten als Funktionen Zustand → DOM über Helfer `h()`. Keine Merge-, Validierungs- oder Datenbanklogik in der UI.
- `sw/sw.ts` – handgeschriebener Service Worker (eigener Build, cache-first, kein Workbox).

**Querschnittsregeln, die leicht übersehen werden:**

- Daten werden **nie** über `innerHTML` eingefügt; Strings im DOM-Helfer sind immer Textknoten (TAK-03). Kein `eval`/`new Function`. Keine Netzwerkanfragen außer an eigene statische Dateien.
- Fachliche Änderungen über mehrere Datensätze/Stores laufen in **einer** Read-Write-Transaktion; „gespeichert“ erst nach `transaction.oncomplete`.
- Ein Set ist **ein Dokument** im Store `sets` (Sektionen und Einträge eingebettet, Reihenfolge = Array-Reihenfolge). Lernstand wird aus `reviewEvents`/`sessions` berechnet; es gibt keinen `progress`-Store.
- Intern immer Langform (`{ text, acceptedVariants? }`); Kurzformen aus Dateien werden beim Import aufgelöst, beim Export wieder geschrieben.
- `rev` ist ein berechneter Inhalts-Hash (cyrb53 über kanonische Darstellung, nicht gespeichert) und Grundlage der Konflikterkennung beim Reimport (TDD 9.5 – Tabelle exakt umsetzen, TAK-16). Zuordnung beim Import nur über IDs, nie über Worttexte.
- Migrationen sind reine Funktionen pro Datensatz in `domain/migrations/` und werden sowohl im `upgradeneeded`-Handler als auch beim Wiederherstellen älterer Backups verwendet. Bis zur ersten Auslieferung (S-29) bleibt `DB_VERSION` = 1; danach braucht jede Schemaänderung Migration + Fixture. Fixtures früherer Stände unter `tests/fixtures/` werden nie gelöscht.
- Eine neue App-Version wird nie während einer Lernsitzung oder Bearbeitung aktiviert (TAK-12).

## Tests (TDD Kap. 15)

- Domain-Module werden **testgetrieben** entwickelt (Liste der Module und Fälle in TDD 15.2); UI über E2E-Smoke-Tests und manuelle Prüfung.
- Validator und JSON Schema werden über gemeinsame Fixtures mit Ajv abgeglichen (TAK-10).
- Vitest 5: Berichte landen in `.vitest/`; `-t` vergleicht mit dem vollen Testnamen, verbunden mit „ > “ (`describe > test`).
- Vitest-Konfiguration steht in `vite.config.ts` (Projekte `unit` und `build`). `passWithNoTests` ist nur gesetzt, solange es keinen Unit-Test gibt – mit dem ersten Test entfernen.
- `fake-indexeddb` kommt mit S-06 und wird **pro Testdatei** importiert (`import "fake-indexeddb/auto"`), nicht global – sonst sähen `domain/`-Tests ein `indexedDB`.
- Tests unter `tests/` und `playwright.config.ts` prüft `tsconfig.test.json` (Node-Typen).
- E2E läuft immer gegen das gebaute Artefakt. Playwright-WebKit ≠ iOS-Safari: Speicherschutz, Installation und Teilen-Menü werden manuell auf echten Geräten geprüft; Ergebnisse beim Arbeitspaket in Kap. 21 festhalten.
