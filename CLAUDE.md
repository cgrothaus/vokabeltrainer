# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projektstand

Mobiler, offlinefähiger Vokabeltrainer als installierbare Web-App (PWA), ohne Backend. Bisher gibt es **nur Dokumente, noch keinen Code**. Nächster Schritt ist Meilenstein M0 (Walking Skeleton), beginnend mit S-01 (Projekt-Setup).

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

## Befehle (geplant, mit S-01/S-02 einrichten und hier bestätigen)

```bash
npm run dev          # Vite-Dev-Server (Service Worker deaktiviert)
npm test             # Vitest: Unit- und Integrationstests (Node, fake-indexeddb)
npm run test:e2e     # Playwright gegen `vite preview`, Projekte mobile-chromium und mobile-webkit
npm run build        # App + Service Worker nach dist/, inkl. Prüfung der Build-Ausgabe
npm run preview      # gebautes Artefakt lokal ausliefern
npx tsc --noEmit     # Typprüfung

npx vitest run src/domain/validate.test.ts      # einzelne Testdatei
npx vitest run -t "Kurzform"                    # Tests nach Name
npx playwright test --project=mobile-webkit -g "E2E-01"
```

Nach UI-Änderungen das Verhalten mit `playwright-cli` gegen Dev-Server oder `vite preview` prüfen und die E2E-Smoke-Tests laufen lassen.

## Architektur (Soll, TDD Kap. 3–7)

**Auslieferung:** eine `index.html` mit eingebettetem JS und CSS (`vite-plugin-singlefile`) plus `sw.js`, `manifest.webmanifest` und Icons. Alle Verweise relativ (läuft unter GitHub-Pages-Unterpfad und eigener Domain). Build zweistufig: `vite build` → Hash von `dist/index.html` → `vite build -c vite.sw.config.ts` mit dem Hash als Cache-Version, damit sich `sw.js` genau dann ändert, wenn sich die App ändert. Deployment auf GitHub Pages nur nach grüner CI.

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
- E2E läuft immer gegen das gebaute Artefakt. Playwright-WebKit ≠ iOS-Safari: Speicherschutz, Installation und Teilen-Menü werden manuell auf echten Geräten geprüft; Ergebnisse beim Arbeitspaket in Kap. 21 festhalten.
