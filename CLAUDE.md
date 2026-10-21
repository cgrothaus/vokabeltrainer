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
| `Betatest_M0_Anleitung.md` | Anleitung für Betatester von M0 (Foto + Formatspezifikation → LLM → App); bei Änderungen an Abläufen, UI-Texten oder Links mitpflegen |
| `20261019_TDD_v1_Review_Notizen.md` | Abgeschlossenes Protokoll (F-xx, T-xx); wird nicht fortgeschrieben |

Vor einer Umsetzung das betreffende Arbeitspaket (S-xx) in TDD Kap. 21 und die dort verlinkten Kapitel lesen.

## Arbeitsregeln

- Dokumente, UI-Texte, Fehlermeldungen und Commit-Messages auf **Deutsch**; Code, Bezeichner und Datenfelder auf Englisch. In der Oberfläche erscheinen keine technischen Begriffe wie „ID“, „rev“ oder „IndexedDB“.
- **Umsetzungsstand nur in TDD Kap. 21** pflegen (🔲 offen · 🔶 in Arbeit · ✅ erledigt). Alle anderen Kapitel beschreiben den Sollzustand.
- IDs (FR, D, TAK, S …) werden nie neu vergeben; entfallene Einträge bleiben mit „entfallen“ stehen. Neue technische Entscheidungen bekommen eine D-Nummer in TDD Kap. 17, neue Arbeitspakete fortlaufende S-Nummern.
- Inhaltliche Änderungen an PRD/TDD erhöhen die Version im Dokumentkopf und bekommen eine Zeile in der Änderungshistorie (inkl. Spalte „Entstehung“ mit Modell). Commit-Messages nennen das Dokument und die Version, z. B. „PRD 2.4: …“.
- `docs/code-iteration1/` (per `.gitignore` ausgeschlossen) enthält den alten Prototyp mit **Lehrwerksvokabeln**. Diese Inhalte dürfen nicht in das Repository, in Fixtures oder in das Beispielset übernommen werden; das Repository ist öffentlich. Das Ablaufverhalten des Prototyps (z. B. Karteikarten-Warteschlange) darf als Vorlage dienen.
- Schlank bleiben: **keine Laufzeitabhängigkeiten**, kein Framework, kein CDN (D-04). Neue Entwicklungsabhängigkeiten nur mit klarem Nutzen und Eintrag in TDD 4.1.
- **Diese Datei aktuell halten:** Neue Erkenntnisse, die künftigen Sitzungen helfen (geänderte Befehle, Stolperstellen, neue Konventionen, Abweichungen vom geplanten Stand), sofort hier ergänzen. Kurz bleiben: nur, was sich nicht schnell aus Code oder Dokumenten ergibt.
- **Rückschau nach jedem Arbeitspaket und jeder längeren Sitzung**, vor dem Abschlussbericht:
  1. Was hat Zeit gekostet oder überrascht (Fehlversuche, Werkzeugmacken, falsche Annahmen über Code oder Dokumente)? Was hat der Nutzer korrigiert oder ausdrücklich bestätigt? Würde das einer künftigen Sitzung helfen?
  2. Jede solche Erkenntnis an den passenden Ort schreiben: Befehle, Stolperstellen, Arbeitsweise → diese Datei; fachliche oder technische Klarstellungen → PRD, TDD oder Formatspezifikation (mit Version und Änderungshistorie); neue Entscheidungen → D-Nummer in TDD Kap. 17; Ergebnisse manueller Prüfungen → beim Arbeitspaket in Kap. 21.
  3. Diese Datei gegenlesen: Veraltetes korrigieren oder entfernen.
  4. Im Abschlussbericht in einem Satz nennen, was festgehalten wurde – oder dass es nichts Neues gab.

## Git-Ablauf

Diese Regeln gelten als Auftrag zum Committen und Mergen; gepusht wird nur auf ausdrückliche Anweisung.

1. **Branch anlegen:** Für jedes nicht-triviale Arbeitspaket (jedes S-xx, jede Änderung mit Code oder Tests, jede neue Dokumentversion) vor der ersten Änderung vom aktuellen `main` abzweigen: `git switch -c s-07-import-validierung` (mit S-Nummer `s-<nr>-<stichwort>`, sonst nur `<stichwort>`; klein, mit Bindestrichen). Direkt auf `main` nur Triviales, das in einen einzigen Commit passt und weder Code, Tests noch PRD/TDD berührt, z. B. Tippfehler, README, CLAUDE.md, `.gitignore`.
2. **Klein committen:** Auf dem Branch nach jedem in sich stimmigen Schritt committen, z. B. Test und Implementierung einer Funktion, ein Konfigurationsschritt, eine Dokumentanpassung. Message: eine Zeile, Deutsch, Infinitivstil wie „Kurzform beim Import auflösen“, ohne S-Präfix. `npm run typecheck` und `npm test` sind vor jedem Commit grün (testgetrieben: Test und Implementierung zusammen committen). Dateien gezielt stagen (`git add <pfad>`), kein `git commit -a` und kein `git add -A`, solange noch andere Änderungen offen sind; vor dem Commit `git diff --cached --stat` prüfen. Sonst landen unfertige Änderungen im falschen Commit, und nach einem Push hilft kein Amend mehr.
3. **Abschließen mit Squash-Merge:** Wenn das Paket fertig ist – Akzeptanzkriterien erfüllt, `typecheck`, `test`, `build` und bei UI-Änderungen `test:e2e` grün, Status in TDD Kap. 21 noch auf dem Branch auf ✅, Rückschau (siehe Arbeitsregeln) auf dem Branch erledigt:

   ```bash
   git switch main
   git merge --squash s-07-import-validierung
   git commit                               # Message siehe unten
   git branch -D s-07-import-validierung    # -D nötig: Squash markiert den Branch nicht als gemergt
   ```

   Message wie bei `4c3494b`: Betreff `S-07: <Zusammenfassung> (TDD 2.3)` (Dokumentversion nur, wenn sie erhöht wurde), darunter eine knappe Stichpunktliste der wesentlichen Änderungen.

   **In einer Worktree-Sitzung** (z. B. Hintergrundjob): `EnterWorktree` legt den Branch als `worktree-<name>` an – gleich in `s-<nr>-<stichwort>` umbenennen. Er zweigt von `origin/main` ab; ungepushte Commits des lokalen `main` fehlen dann. Vor der ersten Änderung `git log -1` mit `git log -1 main` vergleichen und den noch leeren Branch mit `git reset --hard main` nachziehen. Die Sitzung lehnt Shell-Befehle ab, die sie nicht als Git-frei erkennen kann (Heredocs, Shell-Variablen als Argument, schon Wörter wie „digit“ oder Text, der Git-Befehle nennt); Dateien dann mit Edit/Write ändern. Aus dem Worktree heraus sind Git-Befehle auf das Hauptverzeichnis gesperrt (`git -C`, `main` ist dort ausgecheckt), und Edits im gemeinsamen Checkout werden abgelehnt. `cp` fragt in der Shell vor dem Überschreiben nach (Alias `cp -i`) und bricht ohne Eingabe ab; für Gegenproben die Änderung mit `sed` zurücknehmen oder `/bin/cp` nutzen. Parallele Sitzungen committen derweil auf `main`, oft in TDD Kap. 21 und dieser Datei, und belegen dabei auch Dokumentversionen: Die eigene Version erst nach dem Nachziehen wählen und beim Rebase prüfen, ob sie noch frei ist. Deshalb zum Abschluss: im Worktree `git rebase main`, Konflikte dort lösen, Prüfungen wiederholen; dann `ExitWorktree` mit „keep“ und im Hauptverzeichnis `git merge --squash`, `git commit`, `git worktree remove .claude/worktrees/<name>`, `git branch -D`. Kurz vor dem Merge noch einmal `git log -1 main` prüfen.

4. **Deployen (D-21):** Online geht nur, was auf `production` liegt; `production` entsteht ausschließlich per Fast-Forward aus `main`. Nur auf ausdrückliche Anweisung und erst, wenn die CI für `main` grün ist: `git push origin main:production` (lokales `main` vorher auf `origin/main`). Nie direkt auf `production` committen, nie force-pushen.

Die Historie wurde am 20. Oktober 2026 vor dem Öffentlichschalten umgeschrieben (Lehrwerksreste entfernt, TDD Kap. 21 bei S-04); ältere Commit-Hashes in Notizen oder Chats sind ungültig.

## Befehle

Eingerichtet (S-01, S-02, S-05):

```bash
npm run dev          # Vite-Dev-Server (Service Worker deaktiviert); `?testmigration=ok|fail` prüft die Test-Migration
npm run build        # App nach dist/index.html (JS und CSS eingebettet), dann dist/sw.js, danach Build-Prüfung (TAK-01)
npm run preview      # gebautes Artefakt lokal ausliefern (Port 4173)
npm run typecheck    # tsc -b über die Projektreferenzen; `tsc --noEmit` im Wurzelverzeichnis prüft nichts
npm run format       # Prettier (Markdown ist ausgenommen, Dokumente werden von Hand formatiert)
npm run icons        # PNG-Icons aus public/icons/icon.svg neu erzeugen (Playwright-Chromium), Ergebnis einchecken
npm test             # Vitest-Projekt `unit`: src/**/*.test.ts in Node
npm run test:e2e     # Playwright, Projekte mobile-chromium und mobile-webkit; baut selbst und startet `vite preview` auf Port 4180

npx vitest run src/domain/validate.test.ts      # einzelne Testdatei
npx vitest run -t "Kurzform"                    # Tests nach Name
npx vitest run --project build                  # nur Build-Prüfung gegen vorhandenes dist/
npx playwright test --project=mobile-webkit -g "Startseite"
```

Einmalig pro Rechner: `npx playwright install chromium webkit` (Browser für E2E) und `npm i -g @playwright/cli` (Browserprüfung durch den Agent; Skill liegt unter `.claude/skills/playwright-cli/`, Aktualisierung mit `playwright-cli install --skills`). Prüfung z. B. mit `npm run preview` und `playwright-cli open --mobile http://localhost:4173/`; Ausgaben landen in `.playwright-cli/`. `playwright-cli` bringt eine eigene Playwright-Version mit und nutzt Chromium; für `--browser=webkit` einmalig `playwright-cli install-browser webkit`. In Worktree-Sitzungen lehnt Claude Code `playwright-cli eval` ab; dann Code als Datei mit `playwright-cli run-code --filename=<datei>` ausführen (Inhalt `async (page) => …`, ohne abschließendes Semikolon). Dasselbe gilt für Befehle mit JSON-Text als Argument (z. B. `fill`): Eingaben und Messungen in die Skriptdatei legen.

**Service Worker beim lokalen Prüfen:** `vite preview` (4173) registriert ihn, der Dev-Server nicht. Nach einem neuen Build zeigt ein schon geöffneter Browser auf 4173 weiter den alten Stand, bis man „Jetzt aktualisieren“ wählt. Das gilt auch für eine offene `playwright-cli`-Sitzung (mehrere `run-code` nacheinander): Nach einem neuen Build erst `playwright-cli close`, dann neu `open`; ohne `--persistent` startet sie dann leer. Der E2E-Update-Test startet eigene Preview-Server auf Ports ab 4280 (neue Testports nicht aus der „bad ports“-Liste des Fetch-Standards wählen, z. B. 4190 – WebKit lädt dort nichts).

Nach UI-Änderungen das Verhalten mit `playwright-cli` gegen Dev-Server oder `vite preview` prüfen und die E2E-Smoke-Tests laufen lassen.

## CI und Deployment (S-03, S-04, TDD 4.4, 4.5)

`.github/workflows/ci.yml` läuft bei jedem Push (jeder Branch) und Pull Request: `npm ci` → `format:check` → `typecheck` → `test` → `build` → Browserinstallation → `test:e2e`. Nur bei Push auf `production` folgen Upload von `dist/` und Job `deploy` (prüft, dass der Commit in `main` liegt) nach https://cgrothaus.github.io/vokabeltrainer/. Die Umgebung `github-pages` lässt nur `production` zu; ein Ruleset verbietet dort Force-Push und Löschen. Lokal nachstellen mit denselben Befehlen und `CI=1` vor `npm run test:e2e` (ein Worker, `github`-Reporter). Läufe verfolgen mit `gh run watch`; bei Fehlern liegt der Playwright-Report als Artefakt `playwright-report` am Lauf (`gh run download <id> -n playwright-report`). Die Playwright-Version steht nur in `package.json` (kein Container-Image, kein Browser-Cache).

## Architektur (Soll, TDD Kap. 3–7)

**Auslieferung:** eine `index.html` mit eingebettetem JS und CSS (`vite-plugin-singlefile`) plus `sw.js`, `manifest.webmanifest` und Icons. Alle Verweise relativ (läuft unter GitHub-Pages-Unterpfad und eigener Domain). Manifest und Icons liegen in `public/`; in `index.html` mit Wurzelpfad verweisen (`/manifest.webmanifest`), Vite macht daraus `./…`. Build zweistufig: `vite build` → `vite build -c vite.sw.config.ts`; `scripts/precache.ts` liefert Dateiliste und Cache-Version (Hash über alle vorab gespeicherten Dateien), damit sich `sw.js` genau dann ändert, wenn sich eine davon ändert. Neue Dateien, die offline nötig sind, dort aufnehmen. Deployment auf GitHub Pages nur vom Branch `production` nach grüner CI.

**TypeScript 7** (native `tsc`), Konfiguration über Projektreferenzen: `tsconfig.app.json` (`src/` ohne `src/sw`, DOM), `tsconfig.sw.json` (`src/sw`, WebWorker), `tsconfig.node.json` (Vite-Konfigurationen, `scripts/precache.ts`), `tsconfig.test.json` (`tests/`, `scripts/`), `tsconfig.domain.json` (`src/domain` ohne DOM- und Node-Typen, TAK-04; `tsconfig.app.json` prüft `domain/` zusätzlich mit). Kein `enum`, kein `namespace`, keine Parameter-Properties im Konstruktor (`erasableSyntaxOnly`). Verzeichnisse aus TDD 3.1 entstehen erst mit ihrer ersten Datei.

**CSS:** kein `light-dark()` verwenden – Vite rechnet es auf `prefers-color-scheme` herunter, dann greift die manuelle Umschaltung (TDD 13.5) nicht. Farben als Variablen in `:root`, Dunkelmodus per Media Query.

**Schichten unter `src/`** – die Importrichtung ist hart:

- `domain/` – reine Funktionen (Validierung, Normalisierung, Diff/Merge, Übungslogik, Statistik, Migrationen). Importiert nichts aus `app/`, `storage/`, `platform/` und nutzt kein `window`, `document` oder `indexedDB` (TAK-04). Auch `crypto` fehlt dort (gilt ebenso für Tests in `src/domain`): Zufall wird als `RandomBytes` übergeben (`domain/ids.ts`, App: `platform/random.ts`), zum Mischen als `random: () => number` (App: `Math.random`); Tests nutzen eine feste oder seeded Folge. Ohne DOM-Typen gibt es dort auch kein `structuredClone`.
- `storage/` – IndexedDB; kennt `domain/model.ts`, aber keine UI. Geöffnet wird nur über `openDatabase` (`storage/database.ts`, liefert ein Ergebnis pro Fehlerlage statt zu werfen), geschrieben nur über `runTransaction` (`storage/transaction.ts`, erfüllt erst nach `complete`). Neue Sets mit `addSet` (`add()`, nie `put()`): Eine bekannte Set-ID wird abgelehnt, bis M4 Aktualisieren bringt. Sitzungen und Antworten über `storage/sessions.ts`.
- `platform/` – Browser-APIs (Service Worker, `persist()`, Datei ausliefern, Zwischenablage). `deliverFile` öffnet auf Mobilgeräten das Teilen-Menü; `share()` braucht eine frische Nutzergeste. Den Inhalt deshalb vor dem Tippen fertigstellen (die Backup-Ansicht liest beim Öffnen) und im Klick ohne vorheriges `await` aufrufen.
- `app/` – UI ohne Framework: Hash-Routing, Store mit `subscribe`, Ansichten als Funktionen Zustand → DOM über Helfer `h()`. Keine Merge-, Validierungs- oder Datenbanklogik in der UI. Abläufe, die Domain und Storage verbinden, liegen in `app/*.ts` (`importText.ts`, `practice.ts`, `backup.ts`), nicht in `views/`. Der Router gibt jeder Ansicht ein `AbortSignal`, das beim Verlassen abbricht (zum Aufräumen, z. B. Sitzung beenden). Die laufende Lernsitzung lebt nur im Arbeitsspeicher (`currentPractice()`); nach dem Neuladen leitet `#/practice` zur Bibliothek.
- `sw/sw.ts` – handgeschriebener Service Worker (eigener Build, cache-first, kein Workbox).

**Querschnittsregeln, die leicht übersehen werden:**

- Daten werden **nie** über `innerHTML` eingefügt; Strings im DOM-Helfer sind immer Textknoten (TAK-03). Kein `eval`/`new Function`. Keine Netzwerkanfragen außer an eigene statische Dateien.
- Fachliche Änderungen über mehrere Datensätze/Stores laufen in **einer** Read-Write-Transaktion; „gespeichert“ erst nach `transaction.oncomplete`.
- Ein Set ist **ein Dokument** im Store `sets` (Sektionen und Einträge eingebettet, Reihenfolge = Array-Reihenfolge). Lernstand wird aus `reviewEvents`/`sessions` berechnet; es gibt keinen `progress`-Store.
- Intern immer Langform (`{ text, acceptedVariants? }`); Kurzformen aus Dateien werden beim Import aufgelöst, beim Export wieder geschrieben. Importablauf: `domain/importSet.ts` (herauslösen → `validate` → `normalize` → IDs), `domain/duplicates.ts` und `app/importText.ts` in zwei Schritten: `previewImport` schreibt nichts, `saveImport` speichert nach Bestätigung; danach wechselt die App zur Bibliothek, die Meldung holt sie per `takeMessage` ab. Meldungen sind deutsche Strings mit Fundstelle. `validateSetFile` prüft die Datei unabhängig vom Ziel; was vom Ziel abhängt (Teil-Export bei neuem Set, später Scope-Abgleich), gehört in den Ablauf (`prepareNewSet`, `diff.ts`).
- Ein neues Feld im Set-Format braucht drei Stellen: Feldtabelle bzw. `KNOWN_FIELDS` in `domain/validate.ts`, `docs/vokabeltrainer-set.schema.json` und die Formatspezifikation. Ein Test vergleicht Schema und `KNOWN_FIELDS`. Leere optionale Felder entfernt `normalize` ohne Warnung (D-24), leere Listenelemente sind Fehler.
- Unsichtbare Zeichen (BOM, kombinierende Zeichen) im Quelltext als `String.fromCharCode(0x…)` schreiben: `\uXXXX` landete beim Schreiben von Dateien schon als echtes, unsichtbares Zeichen.
- `rev` ist ein berechneter Inhalts-Hash (cyrb53 über kanonische Darstellung, nicht gespeichert) und Grundlage der Konflikterkennung beim Reimport (TDD 9.5 – Tabelle exakt umsetzen, TAK-16). Zuordnung beim Import nur über IDs, nie über Worttexte.
- Migrationen sind reine Funktionen pro Datensatz in `domain/migrations/` (`migrateRecord`) und werden sowohl im `upgradeneeded`-Handler als auch beim Wiederherstellen älterer Backups verwendet. Struktur (Stores, Indizes) steht pro Version in `storage/schema.ts`; jede Version ab 2 braucht zusätzlich einen Eintrag in der Kette, auch ohne Datenänderung. Bis zur ersten Auslieferung (S-29) bleibt `DB_VERSION` = 1; danach braucht jede Schemaänderung Migration + Fixture, die erste (Version 2) außerdem E2E-04 (S-10). Die Test-Migration v1 → v2 (`testMigration.ts` in `domain/migrations/` und `storage/`) gehört nie in die Kette der App. Fixtures früherer Stände unter `tests/fixtures/` werden nie gelöscht.
- Eine neue App-Version wird nie während einer Lernsitzung oder Bearbeitung aktiviert (TAK-12): Sitzung und Editor rufen dafür `setUpdateBlocked(true/false)` aus `app/components/updateNotice.ts` auf (Sitzung seit S-08 in `views/practice.ts`, Editor mit S-30).

## Tests (TDD Kap. 15)

- Domain-Module werden **testgetrieben** entwickelt (Liste der Module und Fälle in TDD 15.2); UI über E2E-Smoke-Tests und manuelle Prüfung.
- Validator und JSON Schema werden über gemeinsame Fixtures mit Ajv abgeglichen (TAK-10): `tests/fixtures/setfile/v1/{valid,llm,invalid,invalid-validator-only}/`, Test `tests/format/setfile.test.ts` (läuft im Projekt `unit`, weil er Dateien liest). Jedes neue Fixture braucht dort einen Eintrag in der Erwartungstabelle (ungültig: genau eine Meldung), sonst scheitert der Test. Nur selbst erfundene Vokabeln verwenden.
- Vitest 5: Berichte landen in `.vitest/`; `-t` vergleicht mit dem vollen Testnamen, verbunden mit „ > “ (`describe > test`).
- Vitest-Konfiguration steht in `vite.config.ts` (Projekte `unit` und `build`).
- `fake-indexeddb` wird **pro Testdatei** importiert (`import "fake-indexeddb/auto"`), nicht global – sonst sähen `domain/`-Tests ein `indexedDB`. Frische Datenbanken pro Test mit `beforeEach(() => { indexedDB = new IDBFactory(); })`. `fake-indexeddb` bricht ein Upgrade bei einer Ausnahme im Handler nicht von selbst ab; deshalb ruft `openDatabase` `abort()` ausdrücklich auf.
- Tests unter `tests/` und `playwright.config.ts` prüft `tsconfig.test.json` (Node-Typen).
- E2E-Helfer (Testset, Import per Text über die Vorschau, Store direkt auslesen, Bibliotheksliste und -meldung) liegen in `tests/e2e/support.ts`; `importSet` endet in der Bibliothek. `index.html` hat schon ein `role="status"` (Update-Hinweis): Meldungen in der Seite mit `getByRole("main").getByRole("status")` suchen. Die Zwischenablage wird wie das Teilen-Menü per `addInitScript` ersetzt (`Navigator.prototype.clipboard`, `tests/e2e/import.spec.ts`); Tests mit einer neuen App-Version nutzen `withCopiedApp` in `tests/e2e/update.spec.ts`. Das Teilen-Menü wird per `addInitScript` ersetzt oder entfernt (`tests/e2e/backup.spec.ts`), weil Chromium und WebKit es je nach Betriebssystem anbieten; ein „neues Gerät“ ist ein neuer Kontext aus `testInfo.project.use` ohne `defaultBrowserType`.
- `getByText("…")` vergleicht auf Teiltext ohne Groß-/Kleinschreibung: „Backup gespeichert.“ traf auch „Noch kein Backup gespeichert.“ und machte Tests unregelmäßig rot. Bei kurzen Statusmeldungen `{ exact: true }` setzen; Unregelmäßiges mit `--repeat-each=30 --reporter=line` eingrenzen.
- E2E läuft immer gegen das gebaute Artefakt. Playwright-WebKit ≠ iOS-Safari: Speicherschutz, Installation und Teilen-Menü werden manuell auf echten Geräten geprüft; Ergebnisse beim Arbeitspaket in Kap. 21 festhalten.
