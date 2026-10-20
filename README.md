# Vokabeltrainer

Ein mobiler Vokabeltrainer, der offline funktioniert. Man installiert ihn als Web-App (PWA) auf dem Home-Bildschirm. Es gibt kein Backend und kein Konto: Alle Daten bleiben auf dem Gerät.

> **Status:** frühe Entwicklung. Meilenstein M0 (Walking Skeleton) läuft, eine nutzbare App gibt es noch nicht. Den aktuellen Stand zeigt der [Umsetzungsplan](docs/TDD_Vokabeltrainer_Allgemein_v2.md) (TDD Kap. 21). Ein provisorischer Testaufbau läuft unter https://cgrothaus.github.io/vokabeltrainer/; dort gespeicherte Daten können jederzeit verloren gehen.

## Funktionen (geplant)

- **Für jede Sprache:** Vokabeln aus verschiedenen Sprachen, Lernstufen und Quellen in einer persönlichen Bibliothek sammeln
- **Import per JSON-Datei oder Einfügen:** Sets lassen sich zum Beispiel mit einem LLM aus einem Foto der Vokabelseite erstellen
- **Bearbeiten, exportieren, wieder einlesen:** Sets extern korrigieren lassen und gezielt aktualisieren, ohne dass der Lernstand verloren geht
- **Lernen auf dem Smartphone:** Karteikarten und Multiple Choice, der Lernfortschritt wird dauerhaft gespeichert
- **Vollständige Sicherung:** Bibliothek, Lernstand und Einstellungen auf ein anderes Gerät mitnehmen

## Technik

- TypeScript, ohne Framework und ohne Laufzeitabhängigkeiten
- Speicherung in IndexedDB, Offline-Betrieb über einen eigenen Service Worker
- Build mit Vite zu einer einzelnen `index.html`, Tests mit Vitest und Playwright
- Auslieferung als statische Seite über GitHub Pages

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [PRD](docs/PRD_Vokabeltrainer_Allgemein_v2.md) | Anforderungen, Akzeptanzkriterien, Meilensteine |
| [TDD](docs/TDD_Vokabeltrainer_Allgemein_v2.md) | Architektur, Datenmodell, Tests, Entscheidungen, Umsetzungsplan (Kap. 21) |
| [Formatspezifikation](docs/Formatspezifikation_Vokabelset_v1.md) | Dateiformat für Vokabelsets, für Menschen und LLMs gleichermaßen verständlich |

## Entwicklung

Voraussetzung ist Node.js mit npm.

```bash
npm install
npx playwright install chromium webkit   # einmalig: Browser für die E2E-Tests
npm run dev         # Dev-Server
npm run build       # Build nach dist/index.html mit Prüfung der Ausgabe
npm run preview     # Build lokal ausliefern
npm run typecheck   # Typprüfung
npm test            # Unit- und Integrationstests (Vitest)
npm run test:e2e    # End-to-End-Tests (Playwright, mobiles Chromium und WebKit)
```

Hinweise für Coding-Agents stehen in [CLAUDE.md](CLAUDE.md).

## Lizenz

Vorerst keine Lizenz: Alle Rechte vorbehalten. Eine Lizenz folgt vor der ersten Auslieferung.

Ausgenommen ist der Skill unter `.claude/skills/playwright-cli/` aus [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli); er steht unter der Apache-2.0-Lizenz (siehe `LICENSE` dort).
