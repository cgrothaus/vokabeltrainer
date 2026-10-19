# Review-Notizen zu TDD v1 (`TDD_Vokabeltrainer_Allgemein_v1.md`)

Grundlage für TDD v2 und die Formatspezifikation.

**Stand:** 19. Oktober 2026  
**Bezug:** Review von **TDD v1.0** (das auf PRD 2.1 basiert), abgeglichen mit PRD 2.3  
**Zweck:** Sammlung aller Überarbeitungspunkte an TDD v1 und der dazu getroffenen Entscheidungen. Die Punkte werden in TDD v2 und der Formatspezifikation abgearbeitet; diese Datei bleibt als datiertes Protokoll erhalten und wird danach nicht mehr fortgeschrieben. Abschnittsnummern in Kapitel 3 beziehen sich auf TDD v1.

---

## 1. Entscheidungen aus dem Brainstorming

| ID | Thema | Entscheidung |
|---|---|---|
| F-01 | Sprache | TypeScript, beschränkt auf Syntax ohne Laufzeitwirkung (`erasableSyntaxOnly`). Ausgeliefert wird Vanilla-JS. |
| F-02 | Hosting | Eigene Domain vorhanden; Repo darf öffentlich sein. Wahl GitHub Pages vs. Vercel noch offen; produktives Hosting mit eigener Domain darf nach hinten rücken. Netlify scheidet aus (Credit-Modell, ca. 20 Produktions-Deploys/Monat). |
| F-03 | Update-Semantik | Fehlendes Feld = Wert bleibt erhalten; nur explizites `null` löscht. Ersetzt TDD v1 6.4 („Objekt wird als Ganzes aktualisiert“). |
| F-04 | Unbekannte Felder | Tolerant: Vorschau weist sie als „wird ignoriert“ aus, sie werden verworfen, der Import scheitert nicht. |
| F-05 | IDs | Kurz-IDs (z. B. 6–8 Zeichen, zufällig, eindeutig innerhalb eines Sets) statt UUIDs für Sektionen und Einträge. Set-ID-Länge im TDD festlegen (global eindeutig genug). |
| F-06 | Konflikte seit Export (FR-29) | Kurzer Inhalts-Hash pro Eintrag (`rev`) im Export. Reimport: lokaler Hash ≠ `rev` → lokal geändert; Dateiinhalt ≠ `rev` → extern geändert; beides → Konflikt. `rev` muss wie die ID erhalten bleiben. |
| F-07 | Mehrere Bedeutungen | `meaning` ist immer ein Array von Bedeutungen `{ text, acceptedVariants? }`; Normalfall: Array mit einem Element. (Analog für `term` prüfen.) |
| F-08 | Store `progress` | Entfällt. Lernstand wird aus `reviewEvents` berechnet (Index nach `setId`). Ein Cache darf später hinzukommen, aber nur als neu aufbaubarer Zustand, nicht im Backup. |
| F-09 | Dokumente | TDD v2 (neu strukturiert, mit IDs) + eigenständige Formatspezifikation. |

## 2. Werkzeuge (vorgeschlagen, Brainstorming-Stand)

- **Runtime/Paketmanager:** Node.js LTS + npm. Bun verworfen (Playwright-Unterstützung nicht offiziell, Mischbetrieb erzeugt Reibung).
- **Build:** Vite 8 + `vite-plugin-singlefile` (Peer-Dependency deckt Vite 8 ab). Ergebnis: `index.html` (JS/CSS inline) + `sw.js` + Manifest + Icons.
- **Service Worker:** handgeschrieben, versioniert über Build-Hash; kein Workbox.
- **Runtime-Abhängigkeiten:** keine; kein Framework, kleiner eigener DOM-Helfer.
- **Unit-/Integrationstests:** Vitest 4 (Node-Umgebung) + `fake-indexeddb`. TDD-Vorgehen für Validator, Normalisierung, JSON-Extraktion aus eingefügtem Text, Diff/Merge, Konflikt- und Duplikaterkennung, MC-Distraktoren, Sitzungs-Queue/`firstAttempt`, Migrationen.
- **Schema-Abgleich:** handgeschriebener Validator mit deutschen Fehlermeldungen; Vitest prüft alle Fixtures zusätzlich per Ajv (nur Dev-Dependency) gegen das JSON Schema.
- **E2E:** Playwright Test gegen das gebaute Artefakt (`vite preview`), Projekte Chromium/Pixel und WebKit/iPhone. WebKit ≠ iOS-Safari → manuelle Checkliste auf echtem iPhone.
- **Agentic Browser Testing:** `playwright-cli` (von Microsoft für Coding-Agents empfohlen) + E2E-Suite; Befehle in `CLAUDE.md`.
- **CI:** GitHub Actions (Typecheck, Unit, Build, E2E) als Bedingung für Deploy.

## 3. Überarbeitungspunkte an TDD v1

### A. Veraltet gegenüber PRD 2.3

- **T-01** `file://` vollständig entfernen (1.1, 3.2, 13.4, 14.14, 15.1, 17).
- **T-02** Build-Pipeline statt „eine Datei ohne Build-Prozess“ (2.1, 2.3).
- **T-03** PWA ergänzen: Manifest, Service Worker, Cache-Strategie, Update-Aktivierung nur ohne laufende Sitzung (NFR-03, NFR-05, R-11).
- **T-04** FR-31: `persist()` verpflichtend, `lastBackupAt` in `meta`, 14-Tage-Logik, Erkennung `display-mode: standalone` für iOS-Installationshinweis.
- **T-05** FR-13: Import per eingefügtem Text im Ablauf; tolerante JSON-Extraktion (Codeblöcke, Begleittext) (R-10).
- **T-06** FR-29: Konflikterkennung per Hash (F-06).
- **T-07** FR-30: Duplikaterkennung über Titel/Sprachen **und** Inhaltsüberschneidung (R-09).
- **T-08** DF-05: Datenmodell für mehrere Bedeutungen (F-07).
- **T-09** FR-09: Distraktorregeln für Multiple Choice, Rückfall auf Karteikarte; Bedienwege (eine Eingabe = eine Aktion).
- **T-10** FR-32: Lehrwerks-/Prototyp-Namen aus Beispielen entfernen (4.2 Set- und Sektionstitel; 5.2 Sektionstitel); 12.1/12.2 Umwandlung der Prototyp-Wortliste streichen; Beispielset als neutrales Fixture.
- **T-11** FR-33/DF-11: Migration von Dateiformaten (alte Set-/Backup-Dateien), Verhalten alter Tabs bei neuerer DB-Version (`VersionError` → „bitte neu laden“), Fixtures pro Altversion.
- **T-12** Umsetzungsreihenfolge an PRD-Meilensteine bzw. Walking Skeleton anpassen.
- **T-13** Rückverweise auf FR/NFR/DF/AK; eigene IDs für Entscheidungen (`D-xx`) und technische Abnahmekriterien (`TAK-xx`); Autor-Metadaten in Änderungshistorie.

### B. Technische Punkte

- **T-14** Update-Semantik (→ F-03).
- **T-15** Unbekannte Felder (→ F-04).
- **T-16** Kurz-IDs (→ F-05).
- **T-17** Store `progress` entfällt (→ F-08).
- **T-18** Validator vs. JSON Schema: eine Wahrheit per Fixture-Abgleich (siehe Werkzeuge).
- **T-19** Semantik festlegen, wenn eine Eintrags-ID im Import in einer anderen Sektion auftaucht (auch über Scope-Grenzen).
- **T-20** Lebenszyklus `sessions`: wann geschrieben, Status bei Abbruch.
- **T-21** Mehrere Tabs: UI-Aktualisierung (z. B. `BroadcastChannel`), nicht nur Revisionsprüfung.
- **T-22** Export/Backup auf iOS in installierter Web-App: `a[download]` + Blob unzuverlässig → `navigator.share({ files })` per Spike prüfen.
- **T-23** Origin-Bindung: Domain vor erstem echten Nutzer festlegen; Origin-Wechsel nur per Backup.
- **T-24** Teststrategie mit konkreten Werkzeugen, Fixtures, Testebenen; Gerätematrix ohne `file://`.

## 4. Offene Punkte

- Hosting-Wahl GitHub Pages vs. Vercel (F-02).

## 5. Weitere Entscheidungen

- **Walking Skeleton:** Vor der Breite wird ein dünner Durchstich durch die riskanten Punkte gebaut (PRD 5.3, Meilenstein M0): Toolchain + CI, provisorisches HTTPS-Deployment, Manifest + Service Worker, IndexedDB mit `persist()` und Migrationsrahmen, minimaler Import (Text/Datei), Karteikarten mit `reviewEvents`, Backup-Export/-Wiederherstellung inkl. iOS-Teilen-Menü, ein E2E-Smoke-Test, manuelle iPhone-Prüfung.
- **Hosting-Zeitpunkt:** Provisorisches HTTPS-Deployment auf einer Standard-Subdomain bereits in M0 (nötig für iPhone-Tests von Service Worker, Installation, `persist()`, Teilen-Menü); eigene Domain vor dem ersten echten Nutzer.
- **Fortschrittstracking:** Kein separater Projektplan. PRD enthält nur Meilensteine und Reihenfolge ohne Status; TDD v2 enthält als letztes Kapitel den Umsetzungsplan mit Arbeitspaketen, 🔲/✅ und Verweisen auf FR/AK/TAK – die einzige Stelle mit Status.
- **F-08 Performance:** Kein Risiko bei erwarteten Mengen (ca. 11.000 Events/Jahr bei täglicher Nutzung); Performance-Test mit 50.000 Events auf echtem Gerät aufnehmen.
