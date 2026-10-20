# TDD: Allgemeiner, mobiler Vokabeltrainer

**Version:** 2.6 – Datenbank, Migrationen und Speicherschutz  
**Stand:** 20. Oktober 2026  
**Bezug:** PRD 2.4 (`PRD_Vokabeltrainer_Allgemein_v2.md`), Formatspezifikation Version 1 (`Formatspezifikation_Vokabelset_v1.md`), Review-Notizen (`20261019_TDD_v1_Review_Notizen.md`)  
**Status:** Entwurf; Grundlage für M0 (Walking Skeleton)  
**Entstehung und Autorenschaft:** siehe Kapitel 20 (Änderungshistorie)

---

## 1. Zweck und Aufbau

Dieses Dokument beschreibt, **wie** die Anforderungen des PRD umgesetzt werden: Architektur, Werkzeuge, Datenmodell, Abläufe, Tests und den Umsetzungsplan. Das Austauschformat für Vokabelsets ist in der eigenständigen Formatspezifikation festgelegt; dieses Dokument beschreibt dessen interne Verarbeitung.

### 1.1 IDs und Verweise

| Präfix | Bedeutung | Definiert in |
|---|---|---|
| FR, NFR, DF, AK, R, Z, PI | Anforderungen, Akzeptanzkriterien, Risiken und Ziele | PRD |
| **D-xx** | Technische Entscheidungen | dieses Dokument, Übersicht in Kapitel 17 |
| **TAK-xx** | Technische Akzeptanzkriterien | Kapitel 16 |
| **S-xx** | Arbeitspakete im Umsetzungsplan | Kapitel 21 |
| **F-xx, T-xx** | Entscheidungen und Punkte aus dem Review von TDD v1 | Review-Notizen |

IDs werden nie neu vergeben; entfallene Einträge bleiben mit dem Vermerk „entfallen“ stehen.

### 1.2 Umsetzungsstand

Der Umsetzungsstand wird **ausschließlich** im Umsetzungsplan (Kapitel 21) mit 🔲 (offen), 🔶 (in Arbeit) und ✅ (erledigt) geführt. Alle anderen Kapitel beschreiben den Sollzustand.

---

## 2. Rahmenbedingungen und Begriffe

### 2.1 Rahmenbedingungen

- Ausgeliefert wird eine HTML-Datei mit eingebettetem CSS und JavaScript, ergänzt nur um Service Worker, Web-App-Manifest und Icons (NFR-02).
- Bereitstellung ausschließlich über statisches HTTPS-Hosting; `file://` wird nicht unterstützt (NFR-01).
- Keine Laufzeitabhängigkeiten, kein Framework, keine CDN-Aufrufe, kein Backend (NFR-04, FR-26).
- Der Quellcode ist in Module aufgeteilt und wird durch eine Build-Pipeline zur Auslieferung zusammengesetzt (D-02).
- Importierte Inhalte sind ausschließlich Daten (DF-08).
- Didaktische Erweiterungen werden durch das Datenmodell vorbereitet, aber nicht vorgezogen.

### 2.2 Begriffe

- **Set, Sektion, Eintrag:** wie in PRD Kapitel 4 und Formatspezifikation.
- **Antwort:** `{ text, acceptedVariants? }` – angezeigter Text plus gleichwertig richtige Varianten. `term` ist eine Antwort, `meanings` eine Liste von Antworten.
- **ID:** stabile, kurze Zufallskennung eines Sets, einer Sektion oder eines Eintrags (D-08).
- **rev:** kurzer Inhalts-Hash eines Sets, einer Sektion oder eines Eintrags, der beim Export mitgeschrieben wird (D-09).
- **editCount:** interner Änderungszähler pro Set zur Erkennung veralteter Vorschauen.
- **Scope:** Umfang einer Datei – ganzes Set oder benannte Sektionen.
- **Aktualisieren / Ersetzen:** die beiden Übernahmearten für bekannte Sets (Kapitel 9).
- **Review-Event:** eine gespeicherte einzelne Antwort in einer Lernsitzung.
- **Backup:** vollständiger Export des lokalen Bestands.

---

## 3. Architektur

### 3.1 Schichten

```text
src/
├── main.ts              Start: Speicher öffnen, Service Worker registrieren, erste Ansicht
├── app/                 UI: Ansichten, Routing, Zustand
│   ├── views/           Bibliothek, Set, Import, Lernen, Ergebnis, Editor, Backup, Einstellungen
│   ├── components/      wiederverwendbare UI-Bausteine (Dialog, Hinweis, Karte …)
│   ├── dom.ts           kleiner DOM-Helfer (D-05)
│   ├── router.ts        Hash-Routing
│   └── store.ts         App-Zustand und Benachrichtigung der Ansichten
├── domain/              reine Funktionen, kein DOM, kein IndexedDB
│   ├── model.ts         Typen
│   ├── ids.ts, hash.ts  IDs und rev
│   ├── extract.ts       JSON aus eingefügtem Text herauslösen
│   ├── validate.ts      Validierung mit deutschen Meldungen
│   ├── normalize.ts     Kurzformen auflösen, trimmen, NFC
│   ├── diff.ts          Vergleich Datei ↔ Bestand, Konflikte
│   ├── merge.ts         Anwenden von Aktualisieren/Ersetzen
│   ├── duplicates.ts    Duplikaterkennung
│   ├── practice.ts      Sitzungswarteschlange, Multiple-Choice-Auswahl
│   ├── stats.ts         Lernstand und Überblick aus Events
│   ├── exportFormat.ts  Set-Export
│   └── migrations/      Migrationen von Datensätzen und Dateiformaten
├── storage/             IndexedDB: Öffnen, Upgrade, Repositories, Backup
├── platform/            Browserfunktionen: Service Worker, persist(), Datei liefern, Zwischenablage
├── styles/              CSS
└── sw/sw.ts             Service Worker (eigener Build)
```

Regeln:

- `domain/` importiert nichts aus `app/`, `storage/` oder `platform/` und greift nicht auf `window`, `document` oder `indexedDB` zu (TAK-04).
- UI-Code enthält keine Merge-, Validierungs- oder Datenbanklogik.
- `storage/` kennt das Datenmodell aus `domain/model.ts`, aber keine UI.

### 3.2 Routing

Hash-basiertes Routing (`#/`, `#/set/<id>`, `#/import`, `#/practice`, `#/backup`, `#/settings`). Es funktioniert in einer einzelnen HTML-Datei, unter jedem Pfad des Hostings und unterstützt die Zurück-Taste unter Android.

### 3.3 UI ohne Framework (D-05)

- Ein kleiner Helfer `h(tag, props, ...children)` erzeugt DOM-Elemente. Kinder vom Typ String werden **immer als Textknoten** eingefügt. `innerHTML` wird im gesamten Code nicht für Daten verwendet (TAK-03).
- Jede Ansicht ist eine Funktion, die aus dem Zustand ein DOM-Teilbaum erzeugt. Bei Zustandsänderungen wird die aktive Ansicht neu gerendert; Fokus und Scrollposition werden dabei gezielt erhalten.
- Der Zustand liegt in `store.ts` (ein Objekt plus `subscribe`). Persistente Daten werden aus IndexedDB geladen; der Store ist nur eine Darstellung davon.

### 3.4 Mehrere Tabs (T-21)

- Nach jedem erfolgreichen Schreibvorgang sendet die App über `BroadcastChannel("vokabeltrainer")` eine Nachricht `{ type: "data-changed", setId? }`. Andere Tabs laden die betroffenen Daten neu.
- Eine offene Importvorschau wird zusätzlich beim Bestätigen über `editCount` geprüft (Kapitel 9.7).
- `versionchange` auf der Datenbank führt zum Schließen der Verbindung und zum Hinweis „Die App wurde in einem anderen Tab aktualisiert. Bitte neu laden.“ Das Routing endet; die App schreibt danach nichts mehr.
- Hält ein Tab mit älterer Version die Verbindung trotzdem offen (`blocked`), bittet die App, diesen Tab zu schließen, und setzt den Start danach von selbst fort.

---

## 4. Werkzeuge, Build und Bereitstellung

### 4.1 Werkzeuge (D-01 bis D-04)

| Zweck | Werkzeug | Begründung |
|---|---|---|
| Laufzeit für Entwicklung | Node.js (aktuelle LTS) + npm | Offiziell unterstützt von Vite, Vitest und Playwright. Bun wurde verworfen, weil Playwright darauf nicht offiziell unterstützt wird. |
| Sprache | TypeScript, `strict`, `erasableSyntaxOnly`; `@types/node` für Tests und Konfiguration | Typen schützen das Datenmodell; nur Syntax, die beim Übersetzen ersatzlos entfällt (keine `enum`, keine `namespace`). |
| Build und Dev-Server | Vite 8 + `vite-plugin-singlefile` | Schneller Dev-Server mit Hot Reload; Plugin bettet JS und CSS in `index.html` ein; Konfiguration wird mit Vitest geteilt. |
| Unit- und Integrationstests | Vitest 5 + `fake-indexeddb` | Gleiche Konfiguration wie Vite; IndexedDB-Logik ohne Browser testbar. Vitest 5 (seit September 2026) unterstützt Vite 8 und Node.js ab 22.12; die Änderungen gegenüber Vitest 4 betreffen ein neues Projekt nicht. |
| Schemaabgleich | Ajv (nur Entwicklung) | Prüft Testfixtures gegen das JSON Schema (TAK-10). |
| End-to-End-Tests | Playwright Test | Chromium und WebKit, mobile Emulation, Offline-Simulation. |
| Browserprüfung durch den Coding-Agent | `playwright-cli` | Für Coding-Agents empfohlen; Snapshots landen in Dateien statt im Kontext. Global installiert (nicht in `package.json`, da es eine eigene Playwright-Version mitbringt); der Skill liegt versioniert unter `.claude/skills/`. |
| App-Icons | Playwright (Chromium) per `npm run icons` | Rendert die PNG-Größen aus einer SVG-Vorlage, ohne zusätzliche Abhängigkeit; die PNGs werden eingecheckt (D-22). |
| Formatierung | Prettier | Einheitlicher Stil ohne Diskussion. Ein Linter wird erst bei Bedarf ergänzt. |
| CI und Deployment | GitHub Actions | Prüfungen als Bedingung für das Deployment. |

Laufzeitabhängigkeiten: **keine** (D-04). Neue Entwicklungsabhängigkeiten werden nur aufgenommen, wenn sie einen klaren Nutzen haben, und in diesem Kapitel nachgetragen.

### 4.2 Build-Ausgabe

```text
dist/
├── index.html              App mit eingebettetem JS und CSS
├── sw.js                   Service Worker
├── manifest.webmanifest    Web-App-Manifest
└── icons/                  icon.svg (Vorlage, Favicon), icon-180.png (apple-touch-icon), icon-192.png, icon-512.png
```

- Alle Verweise sind **relativ**, damit die App unter einem Unterpfad (z. B. GitHub Pages ohne eigene Domain) und unter einer eigenen Domain gleichermaßen läuft.
- Manifest und Icons liegen in `public/` und werden unverändert kopiert. In `index.html` stehen die Verweise mit Wurzelpfad (`/manifest.webmanifest`); Vite schreibt sie mit `base: "./"` relativ um.
- Build-Schritte: `vite build` (App) → `vite build -c vite.sw.config.ts` (Service Worker als IIFE nach `dist/sw.js`). Die zweite Konfiguration ermittelt mit `scripts/precache.ts` die vorab zu speichernden Dateien (`index.html`, Manifest, Icons) und einen Hash über deren Pfade und Inhalte; Dateiliste und Hash (Cache-Version) gehen per `define` in `sw.js` ein. So ändert sich `sw.js` genau dann, wenn sich eine dieser Dateien ändert, auch bei einem neuen Icon.
- `src/sw/` wird mit eigener TS-Konfiguration (`tsconfig.sw.json`, Typen `WebWorker` statt `DOM`) geprüft.
- Die App-Version (`package.json`-Version plus kurzer Git-Commit) wird per `define` eingebettet und in den Einstellungen angezeigt.
- Ein Test prüft die Build-Ausgabe (TAK-01): keine externen URLs in `index.html`, kein `<script src>`, kein `<link rel="stylesheet">`; Kopfzeilen verweisen relativ auf vorhandene Dateien; Manifest mit Pflichtangaben und vorhandenen Icons; `sw.js` ist ein klassisches Skript ohne externe URLs und lädt beim Installieren – in einer Attrappe ausgeführt – genau die Dateien aus `scripts/precache.ts` in den Cache der aktuellen Version.

### 4.3 Browserziel (D-20)

Vite-Standardziel `baseline-widely-available`; das entspricht etwa Safari/iOS 16 und Chrome der letzten gut zwei Jahre. Benötigte Plattformfunktionen (IndexedDB, Service Worker, `crypto.getRandomValues`, `Intl.getCanonicalLocales`, `Intl.DisplayNames`, `BroadcastChannel`, `navigator.storage`) sind dort vorhanden. Moderne CSS-Syntax (Verschachtelung, `light-dark()`) wird beim Build bei Bedarf heruntertransformiert. Das tatsächliche Mindestziel wird in M0 auf echten Geräten bestätigt.

### 4.4 Bereitstellung (D-19)

- **Entscheidung:** GitHub Pages, deployt per GitHub Actions nach erfolgreicher CI auf dem Branch `production` (4.5). Voraussetzung: öffentliches Repository (zulässig, da keine Lehrwerksinhalte versioniert sind). Pages-Quelle ist „GitHub Actions“ (`build_type: workflow`), nicht ein Branch mit fertigen Dateien.
- **Branch `production` (D-21):** zeigt immer auf einen Stand von `main` und wird nur per Fast-Forward nachgezogen, mit `git push origin main:production`. Git lehnt den Push ab, wenn er kein Fast-Forward ist. Abgesichert durch ein Ruleset (kein Force-Push, kein Löschen), eine Prüfung im Deploy-Job (Commit muss in `main` enthalten sein) und die Umgebung `github-pages`, die nur `production` zulässt. So entscheidet ein bewusster Schritt, wann eine neue Version online geht; `main` bleibt Arbeitsstand.
- **M0:** provisorische Adresse `https://cgrothaus.github.io/vokabeltrainer/`. Diese Adresse teilt sich den Browser-Speicher mit allen anderen Pages-Projekten des Accounts; für Testdaten ist das unkritisch.
- **Vor der ersten Auslieferung an Nutzende** (Arbeitspaket S-29): eigene Domain einrichten. Ab dann ist die Adresse fest, weil lokale Daten an sie gebunden sind (T-23). Ein späterer Adresswechsel ist nur per Backup möglich.
- GitHub Pages erlaubt keine eigenen HTTP-Header. Das ist unkritisch: Der Browser prüft `sw.js` auf Updates unter Umgehung des HTTP-Caches, und `index.html` wird vom Service Worker ausgeliefert.
- Alternative bei Bedarf: Vercel (Hobby) mit eigener Adresse pro Projekt und Preview-Deploys pro Branch. Netlify scheidet wegen des Credit-Modells aus.

### 4.5 CI (GitHub Actions)

Workflow `.github/workflows/ci.yml`, ausgelöst bei jedem Push, Pull Request und von Hand. Ein Job `check` auf `ubuntu-latest` mit Node.js `lts/*` führt dieselben Prüfungen aus wie lokal vor jedem Commit:

`npm ci` → Formatprüfung (`npm run format:check`) → Typprüfung (`npm run typecheck`, also `tsc -b` über die Projektreferenzen) → Unit- und Integrationstests → Build mit Prüfung der Build-Ausgabe → Playwright-Tests gegen `vite preview` (Chromium und WebKit, ein Worker, keine Wiederholungen).

- Die Browser werden in jedem Lauf per `npx playwright install --with-deps chromium webkit` installiert, weder gecacht (laut Playwright so schnell wie das Wiederherstellen, Systempakete sind nicht cachebar) noch über das Playwright-Container-Image. So steht die Playwright-Version nur in `package.json`.
- npm-Abhängigkeiten cacht `actions/setup-node` (`cache: npm`); ein `packageManager`-Feld ist dafür nicht nötig.
- Bei Fehlern wird der Playwright-Report (mit Traces) als Artefakt `playwright-report` für 14 Tage hochgeladen; Fehler erscheinen zusätzlich als Annotationen am Lauf.
- Ein neuerer Lauf derselben Ref bricht den älteren ab, außer auf `main` und `production`.
- Nur bei Push auf `production` lädt `check` nach den E2E-Tests `dist/` mit `actions/upload-pages-artifact` hoch. Ausgeliefert wird damit genau der getestete Build (Playwright baut vor den Tests selbst neu).
- Der Job `deploy` hängt mit `needs: check` vom Prüfjob ab und läuft nur bei Push auf `production`: Nur wenn alles grün ist, wird deployt (TAK-14). Er prüft mit `git merge-base --is-ancestor`, dass der Commit in `main` enthalten ist (D-21), und veröffentlicht mit `actions/deploy-pages`. `actions/configure-pages` ist nicht nötig, weil alle Verweise relativ sind.

### 4.6 Arbeitsweise mit dem Coding-Agent

- Eine `CLAUDE.md` im Repository nennt die wichtigsten Befehle (`npm run dev`, `test`, `test:e2e`, `build`, `preview`), die Verzeichnisregeln aus 3.1 und den Verweis auf Kapitel 21.
- Domain-Logik wird testgetrieben entwickelt (Kapitel 15.2).
- Nach UI-Änderungen prüft der Agent das Verhalten mit `playwright-cli` gegen den Dev-Server oder `vite preview` und lässt die E2E-Smoke-Tests laufen.

---

## 5. Offline-Betrieb, Installation und App-Updates

### 5.1 Manifest und Installation (NFR-03)

- `manifest.webmanifest` mit `id: "./"`, `name` („Vokabeltrainer“), `short_name` („Vokabeln“, wird auf dem Home-Bildschirm nicht gekürzt), `lang: "de"`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `theme_color`, `background_color` und Icons (192, 512, 512 als `maskable`).
- Icons (D-22): Vorlage `public/icons/icon.svg` (zwei Karteikarten auf weißem Grund, dient auch als Favicon). Das Motiv liegt im Sicherheitskreis für maskierbare Icons (Radius 40 %), daher nutzt der `maskable`-Eintrag dieselbe Datei wie das normale 512er-Icon. `npm run icons` erzeugt daraus die PNGs.
- Für iOS: `apple-touch-icon` (180 px, nicht transparent; iOS nutzt die Icons aus dem Manifest nicht) und `apple-mobile-web-app-title`. `apple-mobile-web-app-capable` entfällt: iOS öffnet Home-Bildschirm-Seiten seit iOS 26 standardmäßig als Web-App, ältere Versionen ab 16.4 werten `display` im Manifest aus.
- `theme-color` als Metaangabe je Farbschema (hell `#ffffff`, dunkel `#121212`).
- Die App erkennt den installierten Betrieb über `matchMedia("(display-mode: standalone)")` bzw. `navigator.standalone` (iOS) und nutzt das für den Installationshinweis (Kapitel 6.6).

### 5.2 Service Worker (D-15)

Handgeschrieben, ohne Workbox.

- **install:** lädt `./` (die App), `./manifest.webmanifest` und die Icons in einen Cache `vokabeltrainer-<hash>`, jeweils mit `cache: "reload"`. GitHub Pages liefert mit `max-age=600` aus; ohne `reload` könnte ein alter Stand aus dem HTTP-Cache unter dem neuen Cache-Namen landen. `./index.html` wird nicht eigens gespeichert, weil jede Navigation `./` bekommt.
- **activate:** löscht ältere Caches mit dem Präfix `vokabeltrainer-`. Kein `clients.claim()`: Beim allerersten Laden bleibt die Seite ungesteuert, ab dem nächsten Start läuft sie offline.
- **fetch:** GET-Anfragen an die eigene Adresse werden **cache-first** aus dem aktuellen Cache beantwortet; jede Navigation (auch mit Parametern) liefert `./`. Fehlt eine Datei im Cache, geht die Anfrage ans Netz. Andere Anfragen gibt es nicht (TAK-02).
- **message:** `SKIP_WAITING` aktiviert eine wartende Version (5.3).
- Registriert wird relativ (`./sw.js`), der Gültigkeitsbereich ist also das Verzeichnis der App. Im Dev-Server ist der Service Worker deaktiviert (`import.meta.env.PROD`).

### 5.3 Updates ohne Unterbrechung (NFR-05, R-11)

1. Die App ruft beim Start (wenn schon eine Version aktiv ist) und beim Zurückkehren in den Vordergrund `registration.update()` auf; zusätzlich prüft der Browser bei jeder Navigation. Offline schlägt die Prüfung still fehl.
2. Eine neue Version wird installiert und bleibt im Zustand *waiting*.
3. Die App zeigt außerhalb von Lernsitzungen und Bearbeitung einen Hinweis „Neue Version verfügbar“ mit der Aktion „Jetzt aktualisieren“. Er steht in einer Leiste am unteren Rand (`role="status"`, außerhalb der Ansichten). Bei der ersten Installation (noch kein steuernder Service Worker) gibt es keinen Hinweis.
4. Bei Bestätigung sendet die App `SKIP_WAITING` an den wartenden Service Worker und lädt nach `controllerchange` neu. Neu lädt **nur der Tab, in dem bestätigt wurde**; andere Tabs laufen mit der geladenen Version weiter, bis sie neu geladen werden. Hat ein anderer Tab die Version schon aktiviert, lädt die Aktion nur neu.
5. Läuft gerade eine Sitzung oder Bearbeitung, erscheint der Hinweis erst danach (TAK-12). Dafür melden Sitzung und Editor ihren Zustand über `setUpdateBlocked()` (`app/components/updateNotice.ts`).

Datenmigrationen laufen nach dem Neuladen beim Öffnen der Datenbank (Kapitel 7).

---

## 6. Lokale Speicherung

### 6.1 Datenbank (D-06)

**Name:** `vokabeltrainer` · **Version:** `DB_VERSION`, beginnend mit 1

| Store | Schlüssel | Indizes | Inhalt |
|---|---|---|---|
| `sets` | `id` | – | Ein Set als Dokument mit eingebetteten Sektionen und Einträgen |
| `reviewEvents` | `id` | `setId`, `sessionId` | Eine Antwort pro Datensatz |
| `sessions` | `id` | `setId` | Lernsitzungen |
| `settings` | `key` | – | Präferenzen (im Backup enthalten) |
| `meta` | `key` | – | Interne Angaben, z. B. `lastBackupAt`, `persistRequested`, `backupReminderSnoozedUntil` |

Ein Store `progress` für den Lernstand gibt es nicht (D-07, F-08). Lernstand und Überblick werden aus `reviewEvents` und `sessions` berechnet (Kapitel 12.6).

### 6.2 Gespeichertes Set

```ts
interface StoredSet {
  id: string;                 // 10 Zeichen
  editCount: number;          // +1 bei jeder Änderung
  createdAt: string;          // ISO 8601, UTC
  updatedAt: string;
  title: string;
  termLanguage: string;       // BCP 47, kanonisiert
  meaningLanguage: string;
  level?: string;
  textbook?: string;
  edition?: string;
  source?: string;
  license?: string;
  notes?: string;
  reviewStatus?: "unchecked" | "checked";
  sections: StoredSection[];
}

interface StoredSection {
  id: string;                 // 6 Zeichen
  title: string;
  entries: StoredEntry[];
}

interface StoredEntry {
  id: string;                 // 6 Zeichen
  term: Answer;
  meanings: Answer[];         // mindestens eine
  notes?: string;
  examples?: { text: string; translation?: string }[];
  grammar?: { partOfSpeech?: string; gender?: string; plural?: string; forms?: string[] };
  reviewStatus?: "unchecked" | "checked";
}

interface Answer {
  text: string;
  acceptedVariants?: string[];
}
```

- Intern wird immer die **Langform** gespeichert; Kurzformen aus Dateien werden beim Import aufgelöst.
- Die Reihenfolge der Arrays ist maßgeblich. Es gibt keine Sortierfelder.
- `rev`-Werte werden nicht gespeichert, sondern bei Bedarf berechnet (6.4).
- Ein Set ist eine atomar austauschbare Einheit. Bei erwarteten Größen (wenige tausend Einträge pro Set) ist das unkritisch; eine Aufteilung in Einzeldatensätze ist erst bei messbaren Problemen zu prüfen.

### 6.3 IDs (D-08, F-05)

- Alphabet: `23456789abcdefghjkmnpqrstuvwxyz` (ohne leicht verwechselbare Zeichen `0 1 i l o`).
- Länge: Set 10 Zeichen, Sektion und Eintrag 6 Zeichen, Review-Events und Sitzungen 12 Zeichen.
- Erzeugung mit `crypto.getRandomValues`; Sektions- und Eintrags-IDs werden bei der Erzeugung gegen alle IDs des Sets geprüft und bei Kollision neu gezogen.
- Beim Import werden fremde IDs akzeptiert, wenn sie `^[A-Za-z0-9_-]{1,64}$` entsprechen (z. B. ältere UUIDs).
- Lernfortschritt wird über `setId + entryId` zugeordnet. Gleiche Eintrags-IDs in verschiedenen Sets vermischen sich deshalb nicht.
- Eine bekannte `set.id` in einer Datei identifiziert ein lokales Set eindeutig. Gleiche Worttexte führen nie zu einer automatischen Zuordnung.

### 6.4 Prüfwert `rev` (D-09, F-06)

- `rev` = die ersten 8 Zeichen der Base32-Kodierung (Alphabet aus 6.3) eines 53-Bit-Hashes (cyrb53) über die **kanonische Darstellung** des Objekts.
- Kanonische Darstellung: normalisierte Langform, Schlüssel alphabetisch sortiert, fehlende optionale Felder und leere Arrays weggelassen, `id` und `rev` selbst ausgenommen, ebenso die Unterelemente (Sektionen eines Sets, Einträge einer Sektion).
  - **Set:** alle Set-Felder aus 6.2 außer `id`, `editCount`, `createdAt`, `updatedAt`, `sections`.
  - **Sektion:** `title`.
  - **Eintrag:** alle Felder außer `id`.
- Der Hash ist kein Sicherheitsmerkmal. Er erkennt lediglich zufällige Änderungen; Kollisionen sind bei 40 Bit pro Objektversion praktisch ausgeschlossen.
- `rev` wird beim Export für jedes Objekt mitgeschrieben und dient beim Reimport der Konflikterkennung (Kapitel 9.5).

### 6.5 Schreibvorgänge und Fehler

- Jede fachliche Änderung, die mehrere Datensätze oder Stores betrifft, läuft in **einer** Read-Write-Transaktion (DF-09, NFR-15).
- Die App meldet eine Änderung erst nach `transaction.oncomplete` als gespeichert (NFR-16, FR-23).
- `QuotaExceededError`, `AbortError`, `InvalidStateError` und das Fehlen von IndexedDB werden abgefangen und mit einer verständlichen Meldung angezeigt. Die betroffene Änderung wird nicht als gespeichert dargestellt (AK-26).
- Ist IndexedDB gar nicht verfügbar (z. B. in manchen privaten Modi), zeigt die App einen Fehlerzustand mit Erklärung statt eines scheinbar funktionierenden, flüchtigen Modus.

### 6.6 Speicherschutz (FR-22, FR-31, R-01)

- **Dauerhafter Speicher:** Nach dem ersten erfolgreichen Speichern eines Sets ruft die App `navigator.storage.persist()` auf und merkt sich in `meta`, dass die Anfrage gestellt wurde. Bei jedem Start fragt sie `navigator.storage.persisted()` ab.
- **Hinweis bei nicht gewährtem Speicher:** In der Bibliothek erscheint ein ruhiger Hinweis „Deine Daten sind auf diesem Gerät nicht dauerhaft geschützt“ mit einer Handlungsempfehlung:
  - auf iOS/iPadOS ohne Installation: kurze Anleitung „Teilen → Zum Home-Bildschirm“,
  - sonst: regelmäßige Backups.
- **Backup-Erinnerung:** Gibt es Sets oder Review-Events und liegt `meta.lastBackupAt` mehr als 14 Tage zurück oder fehlt, zeigt die Bibliothek einen Hinweis mit der Aktion „Backup speichern“ und „Später“ (zurückstellen um 3 Tage über `meta.backupReminderSnoozedUntil`). Während einer Sitzung erscheint der Hinweis nie.
- Das tatsächliche Verhalten von `persist()` in Safari (Browser vs. Home-Bildschirm) wird in M0 gemessen und in Kapitel 21 (S-11) dokumentiert.

---

## 7. Datenmigrationen und Kompatibilität (FR-33, DF-11, NFR-19)

### 7.1 Eine Migrationskette für Datenbank und Backups (D-13)

- Migrationen sind **reine Funktionen auf einzelnen Datensätzen**, z. B. `migrateSetV1toV2(record)`, abgelegt in `domain/migrations/`.
- Dieselben Funktionen werden verwendet
  - im `upgradeneeded`-Handler (per Cursor über die betroffenen Stores) und
  - beim Wiederherstellen eines Backups, das einen älteren `dataVersion`-Stand enthält.
- Strukturelle Änderungen (neue Stores, Indizes) stehen als Schritt pro Version in `storage/schema.ts` und laufen im `upgradeneeded`-Handler vor der Datenumwandlung.
- Die Kette enthält für **jede** Version ab 2 einen Eintrag, auch wenn sich nur die Struktur ändert (dann ohne Datensatz-Funktionen). Fehlt ein Eintrag, scheitert die Migration, statt Daten unverwandelt zu übernehmen.
- Im `upgradeneeded`-Handler läuft **ein Cursor-Durchlauf pro betroffenem Store**, der jeden Datensatz durch alle Schritte von der alten bis zur neuen Version führt. Zwei offene Cursor auf demselben Store würden sich verschränken.
- Migrationen ändern den Schlüssel eines Datensatzes nicht.
- Für Set-Dateien gibt es eine eigene Kette `migrateSetFileV1toV2(...)`, falls die Formatversion steigt.

### 7.2 Ablauf beim Start

1. Die App öffnet die Datenbank mit `DB_VERSION`.
2. Ist die vorhandene Version älter, läuft `upgradeneeded`. Schlägt eine Migration fehl, bricht die App die Upgrade-Transaktion ausdrücklich ab (eine Ausnahme im Handler oder in einem Cursor-Callback allein genügt nicht in jeder Umgebung); die Datenbank bleibt vollständig im alten Stand.
3. In diesem Fall öffnet die App die Datenbank ohne Versionsangabe (alter Stand), liest alle Stores roh aus und bietet sie als Backup-Datei an („Notfall-Backup“). Der Bildschirm erklärt, dass die neue Version die Daten nicht übernehmen konnte.
   Scheitert dagegen die erste Einrichtung (es gab noch keine Datenbank), gibt es nichts zu sichern. Die App öffnet die Datenbank dann **nicht** ohne Versionsangabe: Das legte eine leere Datenbank ohne Stores an, und beim nächsten Start liefe die Einrichtung nicht mehr. Sie bittet stattdessen, neu zu laden.
4. Ist die vorhandene Version **neuer** als `DB_VERSION` (alte App in altem Tab oder aus altem Cache), schlägt das Öffnen mit `VersionError` fehl. Die App zeigt „Bitte neu laden“ und schreibt nichts.

### 7.3 Sicherungskopie vor Migrationen (D-14)

Vor einem Upgrade mit Datenumwandlung legt die App eine Kopie aller Stores in einer separaten Datenbank `vokabeltrainer-premigration` an. Sie wird nach dem nächsten erfolgreichen Start mit der neuen Version gelöscht. So bleibt auch ein Fehler, der erst nach der Migration auffällt, behebbar. Strukturelle Upgrades ohne Datenumwandlung brauchen diese Kopie nicht.

### 7.4 Regeln

- Bis zur ersten Auslieferung an Nutzende bleibt `DB_VERSION` = 1, und das Schema darf sich ohne Migration ändern (Testdaten werden verworfen). Der Migrationsmechanismus wird trotzdem in M0 mit einer Test-Migration v1 → v2 geprüft.
- Ab der ersten Auslieferung gilt: Jede Änderung am gespeicherten Datenmodell erhöht `DB_VERSION` und bringt eine Migration und ein Fixture des Vorgängerstands mit (TAK-08).
- Fixtures früherer Stände (`tests/fixtures/db/vN.json`, `tests/fixtures/backup/vN.json`, `tests/fixtures/setfile/vN/…`) werden nie gelöscht.

---

## 8. Importformat und Validierung

Das Format selbst ist in der **Formatspezifikation** festgelegt. Hier steht die interne Verarbeitung.

### 8.1 Eingangswege (FR-13, R-10)

- **Datei:** `<input type="file" accept=".json,application/json,text/plain">`, gelesen mit `File.text()`.
- **Text:** ein Textfeld zum Einfügen; zusätzlich eine Schaltfläche „Aus Zwischenablage einfügen“ über `navigator.clipboard.readText()`, sofern verfügbar.
- Beide Wege liefern einen String an dieselbe Verarbeitung.

### 8.2 JSON herauslösen (`extract.ts`)

1. Byte-Order-Mark und Leerraum am Rand entfernen.
2. Enthält der Text einen Markdown-Codeblock, wird der Inhalt des ersten Codeblocks verwendet, der mit `{` beginnt.
3. Sonst wird der Bereich vom ersten `{` bis zum passenden letzten `}` verwendet.
4. `JSON.parse`; bei Fehlern wird die Fundstelle (Zeile, Spalte) in eine verständliche Meldung übersetzt.

Die Extraktion meldet in der Vorschau, ob Text entfernt wurde. Weitere Reparaturen (z. B. abschließende Kommas) werden nicht versucht.

### 8.3 Validierung (`validate.ts`)

- Handgeschrieben, ohne Bibliothek, mit deutschen Meldungen und Fundstelle („Sektion 2 „Freizeit“, Eintrag 5 („to miss“): Es fehlt die Bedeutung.“).
- Drei Schweregrade:
  - **Fehler** blockieren den Import (Formatspezifikation 8.4),
  - **Warnungen** werden in der Vorschau gezeigt (z. B. ignorierte Felder, angenommene Formatversion),
  - **Hinweise** sind rein informativ.
- Sprachcodes werden mit `Intl.getCanonicalLocales` geprüft und kanonisiert.
- Grenzen aus der Formatspezifikation; zusätzlich höchstens 500 Sektionen und 20.000 Einträge pro Datei (DF-08, Schutz vor Blockade).
- Der Validator und das JSON Schema werden über gemeinsame Fixtures abgeglichen (TAK-10, T-18).

### 8.4 Normalisierung (`normalize.ts`)

- Kurzformen (String) zu Langform `{ text }` auflösen; `meaning` (Einzahl) zu `meanings` mit einem Element.
- Texte trimmen und in Unicode-NFC überführen; innere Leerzeichen bleiben unverändert.
- Unbekannte Felder entfernen und als Warnung melden (D-11, F-04).
- Leere optionale Arrays und Strings entfernen.
- Werte `null` bleiben in der normalisierten **Datei**-Darstellung als Löschmarkierung erhalten (für Aktualisieren, D-10).

---

## 9. Importablauf

### 9.1 Überblick

```text
Datei wählen oder Text einfügen
  ↓
JSON herauslösen → validieren → normalisieren          (nichts wird geschrieben)
  ↓
set.id bekannt?
  ├── nein → neues Set: IDs ergänzen, Duplikatprüfung → Vorschau
  └── ja   → Vergleich mit Bestand (Aktualisieren und Ersetzen) → Vorschau
  ↓
Nutzende bestätigen oder brechen ab
  ↓
editCount prüfen → in einer Transaktion schreiben → Erfolgsmeldung → Set öffnen
```

### 9.2 Neues Set

- IDs aus der Datei bleiben erhalten (z. B. bei einem geteilten Set); fehlende IDs werden erzeugt.
- **Duplikatprüfung (FR-30, R-09, D-16):** Für jedes lokale Set mit gleichem Sprachpaar wird die Überschneidung der Eintragsschlüssel berechnet (`term.text` + erste Bedeutung, kleingeschrieben, NFC). Liegt `|A ∩ B| / min(|A|, |B|)` bei mindestens 0,8 oder ist der Titel gleich, zeigt die Vorschau „Dieses Set sieht aus wie „…“, das du schon hast.“ mit „Trotzdem als neues Set importieren“ und „Abbrechen“. Unterscheidet sich `edition`, wird die Ausgabe in der Meldung genannt.
- Die Vorschau zeigt Titel, Sprachen, Zahl der Sektionen und Einträge sowie Warnungen.

### 9.3 Bekanntes Set: Aktualisieren (D-10, F-03)

Gilt nur innerhalb des Scopes der Datei.

- **Set-Angaben:** nur bei `scope.type = "set"`. Fehlende Felder bleiben, `null` löscht.
- **Sektion mit bekannter ID im Scope:** Titel wird übernommen (mit Konfliktprüfung, 9.5); Einträge siehe unten.
- **Sektion ohne ID:** wird als neue Sektion angehängt.
- **Eintrag mit bekannter ID:** Felder aus der Datei überschreiben die lokalen. Fehlende Felder bleiben, `null` löscht ein optionales Feld. Arrays (`meanings`, `acceptedVariants`, `examples`, `grammar.forms`) werden als Ganzes ersetzt, wenn sie vorhanden sind.
- **Eintrag ohne ID:** wird neu angelegt.
- **Nicht enthaltene Einträge und Sektionen** bleiben unverändert erhalten.
- **Reihenfolge:** Innerhalb einer Sektion gilt die Reihenfolge der Datei. Nicht enthaltene lokale Einträge folgen in ihrer bisherigen relativen Reihenfolge. Neue Sektionen werden ans Ende gehängt.

### 9.4 Bekanntes Set: Ersetzen

- `scope.type = "set"`: Set-Angaben, Sektionen und Einträge entsprechen danach genau der Datei.
- `scope.type = "sections"`: Nur die in `sectionIds` genannten Sektionen werden genau wie in der Datei übernommen. Eine dort genannte Sektion, die im Inhalt fehlt, wird gelöscht. Andere Sektionen und Set-Angaben bleiben unberührt. Neue Sektionen ohne ID werden ergänzt.
- Beim Ersetzen bedeutet ein fehlendes optionales Feld: Feld entfernen.
- Löschungen werden in der Vorschau einzeln aufgeführt und gesondert bestätigt (FR-06).

### 9.5 Konflikte seit dem Export (FR-29, R-08, D-09)

Für jedes Objekt mit bekannter ID (Set-Angaben, Sektionstitel, Eintrag) entscheidet `diff.ts` in dieser Reihenfolge:

| Schritt | Bedingung | Ergebnis |
|---|---|---|
| 1 | Datei hat `rev` und `hash(Dateiobjekt) = rev` | **In der Datei unverändert** → lokaler Stand bleibt, keine Aktion |
| 2 | `hash(lokal ⊕ Datei) = hash(lokal)` | **Keine Änderung** (Datei entspricht dem lokalen Stand) |
| 3 | Datei hat `rev` und `hash(lokal) = rev` | **Geändert** → Datei wird übernommen |
| 4 | sonst | **Konflikt**: lokal seit dem Export geändert oder `rev` fehlt |

`lokal ⊕ Datei` bezeichnet das Ergebnis der Aktualisieren-Regeln aus 9.3. Beim Ersetzen wird in Schritt 2 und 3 statt `lokal ⊕ Datei` das Dateiobjekt selbst verwendet.

Konflikte zeigt die Vorschau gesondert mit beiden Fassungen („In der App“ / „In der Datei“). Standard ist **„In der App behalten“**; Nutzende können pro Eintrag oder für alle Konflikte gemeinsam „Datei übernehmen“ wählen (AK-18).

### 9.6 Sonderfälle (T-19)

| Fall | Behandlung |
|---|---|
| Eintrags-ID ist im Set unbekannt | Eintrag wurde lokal gelöscht oder stammt aus einem anderen Set. Vorschau: „Nicht mehr vorhanden“. Standard: nicht anlegen; wahlweise als neuen Eintrag (mit neuer ID) übernehmen. |
| Eintrag steht in der Datei in einer anderen Sektion als lokal, beide Sektionen im Scope | Eintrag wird verschoben (Vorschau: „verschoben“). |
| Eintrag stammt lokal aus einer Sektion außerhalb des Scopes | Eintrag wird **nicht** übernommen, weil sonst eine Sektion außerhalb des Scopes verändert würde. Vorschau: „Kann nicht übernommen werden“ mit Erklärung. |
| Sektions-ID im Scope ist lokal unbekannt | Fehler: widersprüchlicher Scope; Import wird abgelehnt. |
| Sektion außerhalb des Scopes, aber mit bekannter ID im Inhalt | Fehler: widersprüchlicher Scope; Import wird abgelehnt. |
| Doppelte IDs in der Datei | Fehler; Import wird abgelehnt. |
| Sektion oder Eintrag in der Datei ohne ID, mit gleichem Text wie ein lokaler | Wird als neu behandelt; keine Zuordnung über Texte. |

### 9.7 Vorschau und Übernahme (FR-16, AK-06)

- `diff.ts` liefert eine Liste von Aktionen pro Objekt (`unchanged`, `changed`, `added`, `removed`, `moved`, `conflict`, `missingLocally`, `notApplicable`) und daraus Zähler.
- Die Vorschau zeigt Ziel (Set, Scope), Zähler und eine aufklappbare Liste je Kategorie, oben die Warnungen.
- Bei bekannten Sets wählen Nutzende „Aktualisieren“ (Standard) oder „Ersetzen“; die Vorschau wird für die gewählte Art berechnet.
- Beim Öffnen der Vorschau wird `editCount` des Zielsets gemerkt. Beim Bestätigen liest die Read-Write-Transaktion das Set erneut. Hat sich `editCount` geändert, wird abgebrochen und die Vorschau neu berechnet (TAK-07).
- Die Übernahme schreibt das neue Set-Dokument in einer Transaktion. Review-Events gelöschter Einträge bleiben erhalten (Historie), fließen aber nicht in den aktuellen Lernstand ein.

### 9.8 Fehlerfälle

Ungültiges JSON, unbekannte Formatversion, Validierungsfehler, widersprüchlicher Scope, Speicherfehler, Abbruch in der Vorschau: In allen Fällen wird nichts geschrieben, und eine verständliche Meldung nennt das Problem und den nächsten Schritt (AK-07).

---

## 10. Bearbeitung in der App (FR-02–FR-04)

- **Set:** Titel, Sprachen, optionale Angaben; neues leeres Set anlegen; Set löschen mit Angabe des Umfangs (Sektionen, Einträge, Zahl der Review-Events).
- **Sektionen:** anlegen, umbenennen, verschieben (Auf/Ab-Schaltflächen; Ziehen optional), löschen mit Bestätigung, wenn Einträge enthalten sind.
- **Einträge:** anlegen, bearbeiten, verschieben, in eine andere Sektion verschieben, löschen.
- Ein Eintrag wird in einem kompakten Formular bearbeitet: `term` mit Varianten, beliebig viele Bedeutungen mit Varianten, Notizen, Beispiele, Grammatik, Prüfstatus. Kein horizontales Scrollen (AK-12).
- **Speichern:** ausdrücklich „Speichern“ / „Verwerfen“. Beim Verlassen mit ungespeicherten Änderungen fragt die App „Speichern“, „Verwerfen“ oder „Weiter bearbeiten“. Erst nach dem Commit gilt eine Änderung als gespeichert; dabei werden `editCount` und `updatedAt` erhöht.
- **Löschen von Einträgen:** Review-Events bleiben erhalten (siehe 9.7).
- **Alle Daten löschen:** in den Einstellungen, deutlich gekennzeichnet und mit Bestätigung (optional mit vorherigem Backup-Angebot).

---

## 11. Export und Backup

### 11.1 Set- und Sektionsexport (FR-18)

- Erzeugt eine Datei nach der Formatspezifikation mit `exportedAt`, `scope`, allen IDs und `rev`-Werten.
- Antworten ohne Varianten werden in Kurzform geschrieben; leere optionale Felder entfallen.
- Keine Lernhistorie, keine Einstellungen.
- Dateiname: `<Titel>_<JJJJ-MM-TT>.json`, problematische Zeichen ersetzt, höchstens 80 Zeichen.

### 11.2 Datei ausliefern (D-17, T-22)

`platform/deliverFile(blob, filename)`:

- Wenn `navigator.canShare?.({ files: [file] })` zutrifft und das Gerät mobil ist (Touch-Gerät oder installierte App), öffnet `navigator.share({ files })` das Teilen-Menü. Dort lässt sich die Datei unter anderem in „Dateien“ sichern.
- Sonst wird ein Download über `<a download>` mit einer Blob-URL ausgelöst.
- Bricht die Person das Teilen ab (`AbortError`), gilt der Export als nicht erfolgt.
- Die genaue Auswahlregel wird im M0-Spike (S-09, S-11) auf iPhone und Android bestätigt.

### 11.3 Backupformat

```json
{
  "format": "vokabeltrainer-backup",
  "formatVersion": 1,
  "dataVersion": 1,
  "appVersion": "0.1.0+a1b2c3d",
  "exportedAt": "2026-10-19T18:45:00.000Z",
  "data": {
    "sets": [],
    "reviewEvents": [],
    "sessions": [],
    "settings": []
  }
}
```

- `formatVersion` betrifft die Hülle, `dataVersion` den Stand der Datensätze (= `DB_VERSION` beim Export).
- Die Datensätze sind Rohkopien der Stores. `meta` wird nicht exportiert.
- Alle Stores werden in **einer** Read-only-Transaktion gelesen (konsistenter Stand); Serialisierung und Auslieferung folgen danach.
- Nach erfolgreicher Auslieferung wird `meta.lastBackupAt` gesetzt. Beim Download ohne Erfolgsrückmeldung des Browsers gilt der Zeitpunkt des Auslösens.

### 11.4 Wiederherstellung (FR-19, AK-10)

1. Datei wählen (oder Text einfügen), herauslösen und parsen.
2. Hülle prüfen. Bei `formatVersion` oder `dataVersion` größer als die eigene wird abgelehnt mit „bitte App neu laden“.
3. Datensätze per Migrationskette (7.1) auf den aktuellen Stand bringen und vollständig validieren, einschließlich Referenzen von Events auf Sets.
4. Vorschau: Zahl der Sets, Einträge, Sitzungen und Events sowie Exportdatum. Sind lokale Daten vorhanden, folgt die Warnung „Alle Daten auf diesem Gerät werden ersetzt“ mit dem Angebot, vorher ein Backup des aktuellen Stands zu speichern.
5. Alle Stores außer `meta` in **einer** Read-Write-Transaktion leeren und befüllen. Danach `meta.lastBackupAt = exportedAt` des Backups setzen.
6. UI neu laden, Erfolg melden.

Es gibt kein Zusammenführen von Backups.

---

## 12. Lernen

### 12.1 Sitzung einrichten (FR-07, FR-08)

- Auswahl: ein Set, darin alle, einzelne oder mehrere Sektionen. Eine Sitzung gehört immer zu genau einem Set.
- Einstellungen: Richtung (`termToMeaning`, `meaningToTerm`, `mixed`), Anzahl, Multiple-Choice-Anteil (Standard 25 %). Die zuletzt gewählten Werte werden je Set in `settings` gemerkt.

### 12.2 Ablauf (FR-10, FR-12)

Übernommen aus dem Prototyp und in `practice.ts` als reine Funktion umgesetzt:

- Warteschlange aus den gewählten Einträgen, gemischt; bei `mixed` wird die Richtung pro Karte zufällig gewählt.
- Falsch beantwortete Karten werden an Position 4 der Warteschlange wieder eingefügt (bzw. ans Ende, wenn diese kürzer ist).
- `firstAttempt` gilt pro Eintrag und Sitzung: Nur die erste Antwort zu einem Eintrag zählt als Erstversuch.
- „Ende“ während der Sitzung zeigt einen Zwischenstand und erlaubt das Fortsetzen. Der Sitzungszustand liegt im Arbeitsspeicher; nach einem Neuladen ist die Sitzung beendet, die bis dahin gespeicherten Antworten bleiben erhalten.
- Ergebnis: Erstversuchsquote, Liste der beim ersten Versuch falschen Einträge, Aktion „Nur Fehler üben“.

### 12.3 Abfrageformen und Bedienung (FR-09)

- Die Anzeige einer Bedeutungsseite verbindet die `text`-Werte aller Bedeutungen mit „; “.
- **Karteikarte:** Tippen, Enter oder Leertaste deckt auf. Danach erscheinen die Schaltflächen „Nochmal“ und „Gewusst“. Pfeil links/rechts und Wischen bewerten ergänzend, aber erst nach dem Aufdecken. Wischen vor dem Aufdecken deckt nur auf (wie im Prototyp). Eine Geste löst genau eine Aktion aus; nach dem Aufdecken per Wischen ist für die Bewertung eine neue Geste nötig.
- Die Karte nutzt `touch-action: pan-y`, damit vertikales Scrollen nicht mit horizontalem Wischen konkurriert. Tastaturkürzel wirken nicht in Eingabefeldern.
- **Multiple Choice (D-18):**
  - Kandidaten: alle anderen Einträge **desselben Sets**, angezeigt auf derselben Sprachseite wie die richtige Antwort.
  - Ausgeschlossen werden Kandidaten, deren akzeptierte Antworten (alle `text`- und `acceptedVariants`-Werte der Seite, kleingeschrieben, getrimmt, NFC) eine akzeptierte Antwort des richtigen Eintrags enthalten, sowie Kandidaten mit gleicher Anzeige wie ein anderer Kandidat.
  - Kandidaten aus denselben Sektionen werden bevorzugt, danach aus dem übrigen Set.
  - Gibt es weniger als drei geeignete Kandidaten, wird die Karte als Karteikarte gestellt.
- `prefers-reduced-motion` reduziert Animationen.

### 12.4 Review-Events (FR-11, AK-17)

```ts
interface ReviewEvent {
  id: string;
  sessionId: string;
  setId: string;
  entryId: string;
  entryRev: string;          // rev des Eintrags zum Zeitpunkt der Antwort (für R-04)
  occurredAt: string;        // ISO 8601, UTC
  direction: "termToMeaning" | "meaningToTerm";
  mode: "flashcard" | "multipleChoice";
  result: "correct" | "incorrect";
  firstAttempt: boolean;
}
```

- Jede Antwort wird sofort in einer eigenen Transaktion geschrieben, bevor die nächste Karte erscheint. Schlägt das fehl, zeigt die App einen Hinweis; die Sitzung läuft weiter.
- Bei Selbstbewertung bedeutet `correct` „gewusst“ und `incorrect` „nochmal“.
- `entryRev` macht später erkennbar, ob sich ein Eintrag seit einer Antwort inhaltlich geändert hat (R-04), ohne dass das jetzt ausgewertet wird.

### 12.5 Sitzungen (T-20)

```ts
interface Session {
  id: string;
  setId: string;
  sectionIds: string[];
  startedAt: string;
  endedAt?: string;
  status: "active" | "completed" | "ended" | "interrupted";
  config: { direction: "termToMeaning" | "meaningToTerm" | "mixed"; count: number; mcShare: number };
}
```

- Wird beim Start mit `status: "active"` geschrieben.
- `completed`: alle Karten beantwortet. `ended`: vorzeitig beendet und nicht fortgesetzt.
- Sitzungen, die beim nächsten App-Start noch `active` sind, werden auf `interrupted` gesetzt.
- Kennzahlen (Zahl der Antworten, Erstversuchsquote) werden aus den Events berechnet, nicht in der Sitzung gespeichert.

### 12.6 Lernstand und Überblick (FR-11, D-07, F-08)

- `stats.ts` berechnet aus den Events eines Sets (Index `setId`):
  - pro Eintrag: Zahl der Antworten, letzte Antwort, letztes Ergebnis, Ergebnis des letzten Erstversuchs,
  - pro Set und Sektion: Zahl der Sitzungen, Datum der letzten Sitzung, Erstversuchsquote der letzten fünf Sitzungen.
- Die Zuordnung zu Sektionen richtet sich nach der **aktuellen** Sektion des Eintrags.
- Einträge, die nicht mehr existieren, werden ignoriert.
- Mengengerüst: etwa 11.000 Events pro Jahr bei täglicher Nutzung. Die Berechnung für ein Set mit 50.000 Events muss auf einem Mittelklasse-Smartphone unter 200 ms bleiben (TAK-15). Wird das verfehlt, kommt ein neu aufbaubarer Cache hinzu, der nicht ins Backup gehört.

### 12.7 Vorbereitung späterer Didaktik

Kein Algorithmus für verteiltes Wiederholen in dieser Version. Die Events enthalten alles, was ein späterer Algorithmus braucht (Zeitpunkt, Richtung, Form, Ergebnis, Erstversuch, Inhaltsstand). Akzeptierte Varianten werden gespeichert, aber erst mit der freien Eingabe ausgewertet.

---

## 13. UX, Empty State und Barrierearmut

### 13.1 Bibliothek und Empty State (FR-02, FR-28, AK-14)

- Die Bibliothek zeigt Sets gruppiert nach Lernsprache (Anzeige über `Intl.DisplayNames`), innerhalb der Gruppe nach Lernstufe und Titel sortiert.
- **Leere Bibliothek:**
  - kurzer Satz, was die App kann,
  - primäre Aktion „Erstes Vokabelset importieren“,
  - sekundär „Beispielset ausprobieren“ und „Leeres Set anlegen“,
  - Link „Wie bekomme ich ein Vokabelset?“ mit Formatbeispiel und den kopierbaren Prompt-Vorlagen (Formatspezifikation, Kapitel 11).
- Der Empty State ergibt sich aus dem Datenbestand, erscheint also auch nach dem Löschen des letzten Sets.
- Hinweise zu Speicherschutz, Backup und neuer Version erscheinen als ruhige Hinweise oberhalb der Liste, nie als blockierender Dialog.

### 13.2 Beispielset (FR-32)

- Datei `src/content/beispielset.json` im Format der Formatspezifikation, beim Build eingebettet.
- Inhalt: eigene Auswahl aus allgemeinem Grundwortschatz Englisch–Deutsch, Niveau etwa Klasse 6, 3–5 thematische Sektionen mit je 10–20 Einträgen. Enthält Varianten, mehrere Bedeutungen, Grammatik und Beispiele.
- `source: "Eigene Zusammenstellung"`, `license: "CC0"`.
- Wird über den normalen Importweg geladen (keine Sonderlogik) und dient zugleich als Testfixture.
- Keine Inhalte aus dem Prototyp oder aus Lehrwerken.

### 13.3 Kontextbezogene Hilfe (FR-28, AK-15)

Kurze Erklärungen direkt am Schritt, insbesondere bei: Import (neu oder bekannt), Aktualisieren vs. Ersetzen, Konflikten, Teil-Export, Backup und Wiederherstellung, Speicherschutz. Schaltflächen nennen die Folge („Ersetzen und 3 Einträge löschen“ statt „OK“). Begriffe wie „ID“, „rev“ oder „IndexedDB“ erscheinen in der Oberfläche nicht.

### 13.4 Mobile first und Barrierearmut (FR-24, NFR-09–NFR-13)

- Kein horizontales Scrollen bei 320 CSS-Pixeln Breite.
- Touch-Ziele mindestens 44 × 44 CSS-Pixel als Designziel (WCAG 2.2 AA verlangt mindestens 24 × 24).
- Sichtbarer Fokus, logische Fokusreihenfolge, Fokus nach Dialogen zurück zum auslösenden Element.
- Semantische Elemente (`button`, `label`, `dialog`), Statusmeldungen über `aria-live`.
- Kein Zustand nur über Farbe, keine Funktion nur über Gesten.
- Safe-Area-Abstände (`env(safe-area-inset-*)`) für installierte App auf iOS.

### 13.5 Darstellung (FR-25)

Helles und dunkles Farbschema über CSS-Variablen; Standard folgt `prefers-color-scheme`, eine manuelle Einstellung in `settings.theme` (`system`, `light`, `dark`) hat Vorrang.

---

## 14. Datenschutz und Sicherheit (FR-26, DF-08)

- Keine Netzwerkanfragen außer dem Laden der eigenen statischen Dateien; keine Analytics, Telemetrie oder Drittanbieter-Skripte (TAK-02).
- Importierte Texte werden ausschließlich als Text dargestellt (3.3, TAK-03). Kein `eval`, kein `new Function`, keine dynamischen Skripte.
- Größen- und Mengengrenzen beim Import (8.3).
- Exporte und Backups entstehen nur durch eine bewusste Aktion. Ein Backup ist in Dateiname und Oberfläche klar als solches erkennbar (`Vokabeltrainer-Backup_<Datum>.json`).
- Fehlermeldungen enthalten keine unnötigen Inhalte aus den Daten.
- Content-Security-Policy per `<meta http-equiv>`: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`. `'unsafe-inline'` ist wegen der eingebetteten Skripte nötig; eine Hash-basierte Policy kann später ergänzt werden.

---

## 15. Teststrategie

### 15.1 Testebenen

| Ebene | Werkzeug | Gegenstand |
|---|---|---|
| Unit | Vitest (Node) | Alle Module in `domain/` |
| Integration | Vitest + `fake-indexeddb` | `storage/`: Transaktionen, Rollback, Migrationen, Backup und Wiederherstellung |
| Schemaabgleich | Vitest + Ajv | Gültige und ungültige Fixtures: Validator und JSON Schema urteilen gleich |
| Build-Prüfung | Vitest (Node) | Build-Ausgabe ist eigenständig (TAK-01) |
| End-to-End | Playwright Test gegen `vite preview` | Zentrale Wege, Offline, Migration |
| Manuell | echtes iPhone, echtes Android-Gerät | Speicherschutz, Installation, Teilen-Menü, Dateiauswahl, Gesten |

### 15.2 Testgetriebene Entwicklung

Für diese Module werden Tests vor der Implementierung geschrieben:

- `extract.ts`: Codeblöcke, Begleittext, BOM, kein JSON;
- `validate.ts` und `normalize.ts`: Pflichtfelder, Kurzformen, `meaning` (Einzahl), unbekannte Felder, Sprachcodes, Grenzen, Fundstellen in Meldungen;
- `ids.ts` und `hash.ts`: Alphabet, Kollisionsprüfung, stabile kanonische Darstellung (Schlüsselreihenfolge, Kurz- vs. Langform ergeben denselben `rev`);
- `diff.ts` und `merge.ts`: Tabelle 9.5 vollständig, Sonderfälle 9.6, Aktualisieren vs. Ersetzen, `null`-Löschung, Reihenfolgeregeln, Scope-Schutz;
- `duplicates.ts`: Schwellenwert, Sprachpaar, Ausgabe;
- `practice.ts`: Warteschlange, Wiedereinfügen, `firstAttempt`, Multiple-Choice-Auswahl und Rückfall auf Karteikarte;
- `stats.ts`: Kennzahlen, gelöschte Einträge, verschobene Einträge;
- `migrations/`: jede Migration mit Fixture vorher und nachher.

UI-Code wird nicht testgetrieben entwickelt, sondern über E2E-Smoke-Tests und manuelle Prüfung abgesichert.

### 15.3 Fixtures

```text
tests/fixtures/
├── setfile/v1/valid/      minimal, mit IDs, Teil-Export, Kurz- und Langform, Varianten, mehrere Bedeutungen
├── setfile/v1/invalid/    je ein Fehlerfall pro Regel
├── setfile/v1/llm/        typische LLM-Ausgaben: Codeblock, Begleittext, Zusatzfelder, "meaning"
├── db/                    gespeicherte Stände pro DB_VERSION (ab erster Auslieferung)
├── backup/                Backups pro dataVersion
└── perf/                  3.000 Einträge; 50.000 Events
```

Das Beispielset (13.2) ist zugleich gültiges Fixture.

### 15.4 End-to-End-Smoke-Tests

Projekte: `mobile-chromium` (Pixel-Emulation) und `mobile-webkit` (iPhone-Emulation). Getestet wird immer das gebaute Artefakt.

| Test | Meilenstein | Prüft |
|---|---|---|
| E2E-01 Import (Text) → Lernen → Neuladen → Daten da | M0 | AK-01, AK-09 |
| E2E-02 Backup → Daten löschen → Wiederherstellen | M0 | AK-10 |
| E2E-03 Offline-Start nach erstem Laden | M0 | AK-21 |
| E2E-04 Migration: alte DB per Init-Skript anlegen → App öffnen → Daten nutzbar | M0 (Test-Migration), ab Auslieferung mit echten Ständen | AK-24 |
| E2E-05 Empty State → Beispielset → Sitzung mit Multiple Choice → Ergebnis | M1 | AK-08, AK-14, AK-22 |
| E2E-06 Import mit Begleittext und Zusatzfeld (Datei) → Warnung sichtbar | M1 | AK-01 |
| E2E-07 Bearbeiten → Neuladen → Änderung da | M3 | AK-03, AK-25 |
| E2E-08 Teil-Export → Datei ändern → Aktualisieren; andere Sektionen unverändert | M4 | AK-04, AK-05 |
| E2E-09 Konflikt: lokal und in Datei geändert → Vorschau zeigt Konflikt | M4 | AK-18 |
| E2E-10 Datensatz mit `<img onerror>` im Text → wird als Text angezeigt | M1 | TAK-03, DF-08 |
| E2E-11 Update: neue Version wird gefunden, bleibt auch nach Neuladen wartend, wird erst nach „Jetzt aktualisieren“ aktiv | M0 | NFR-05, TAK-12 (ohne Sitzung) |
| E2E-12 Neuere Datenbankversion aus einem anderen Tab: App gibt die Verbindung frei und bittet ums Neuladen; nach dem Neuladen bleibt die neuere Datenbank unverändert | M0 | 3.4, 7.2, TAK-08 (Teil) |

Playwright-WebKit entspricht nicht Safari auf iOS. Speicherlöschung, Installation, `persist()` und Teilen-Menü werden manuell geprüft (15.5).

### 15.5 Manuelle Gerätechecks

Pro Meilenstein auf einem echten iPhone (Safari und installierte App) und einem echten Android-Gerät (Chrome):

- Installation auf dem Home-Bildschirm, Start offline;
- Ergebnis von `persist()` / `persisted()` im Browser und als installierte App;
- Import per Einfügen aus einer LLM-App und per Dateiauswahl;
- Backup über das Teilen-Menü in „Dateien“ speichern und wiederherstellen;
- Karteikarte per Tippen, Wischen und Schaltflächen; kein Konflikt mit Scrollen;
- Darstellung bei 320 px Breite, Safe Areas, Dunkelmodus.

Ergebnisse werden im Umsetzungsplan beim jeweiligen Arbeitspaket kurz festgehalten.

### 15.6 Performance

Fixtures aus 15.3: Import von 3.000 Einträgen (Validierung, Diff, Commit) ohne spürbares Einfrieren (unter 1 s auf einem Mittelklasse-Smartphone); Lernüberblick über 50.000 Events unter 200 ms (TAK-15). Gemessen erstmals in M1 auf echtem Gerät.

---

## 16. Technische Akzeptanzkriterien

| ID | Kriterium | Prüfung |
|---|---|---|
| TAK-01 | Build erzeugt `index.html` mit eingebettetem JS und CSS sowie `sw.js`, Manifest und Icons; `index.html` enthält keine externen URLs, kein `<script src>`, kein Stylesheet-Link. | Build-Test |
| TAK-02 | Zur Laufzeit gibt es keine Netzwerkanfragen außer an die eigenen statischen Dateien. | E2E (Request-Protokoll) |
| TAK-03 | Daten werden nie als HTML interpretiert; im Code gibt es kein `innerHTML` mit Daten. | E2E-10, Code-Review |
| TAK-04 | `domain/` hat keine Abhängigkeit zu DOM, IndexedDB, `app/`, `storage/`, `platform/`. | Test über Importe / TS-Konfiguration ohne DOM-Typen für `domain/` |
| TAK-05 | Änderungen über mehrere Stores sind atomar; ein erzwungener Fehler hinterlässt den vorherigen Stand. | Integrationstest |
| TAK-06 | Die Importvorschau schreibt nichts. | Integrationstest |
| TAK-07 | Eine veraltete Vorschau (geänderter `editCount`) wird nicht angewandt. | Integrationstest |
| TAK-08 | Jeder frühere DB- und Backup-Stand wird auf den aktuellen migriert; eine fehlschlagende Migration lässt den alten Stand unverändert und bietet das Notfall-Backup an. | Integrationstest, E2E-04 |
| TAK-09 | Backup → Wiederherstellen ergibt denselben Bestand (tiefer Vergleich aller Stores außer `meta`). | Integrationstest, E2E-02 |
| TAK-10 | Validator und JSON Schema urteilen bei allen Fixtures gleich. | Schemaabgleich |
| TAK-11 | Die App startet nach dem ersten Laden offline vollständig. | E2E-03 |
| TAK-12 | Eine neue App-Version wird während einer Sitzung oder Bearbeitung nicht aktiviert. | E2E / manuell |
| TAK-13 | Alle in 15.2 genannten Module haben Unit-Tests für die dort genannten Fälle. | Review |
| TAK-14 | Deployment erfolgt nur nach grüner CI. | Workflow-Konfiguration |
| TAK-15 | Performancegrenzen aus 15.6 werden auf einem echten Mittelklasse-Smartphone eingehalten. | Manuelle Messung |
| TAK-16 | Die Konfliktentscheidung folgt exakt Tabelle 9.5. | Unit-Tests (tabellengetrieben) |

---

## 17. Entscheidungen

| ID | Entscheidung | Kapitel | Herkunft |
|---|---|---|---|
| D-01 | Node.js LTS + npm als Entwicklungsumgebung; kein Bun | 4.1 | Brainstorming |
| D-02 | Quellcode in Modulen, Build mit Vite 8 + `vite-plugin-singlefile` | 4.1, 4.2 | Brainstorming, T-02 |
| D-03 | TypeScript mit `erasableSyntaxOnly` | 4.1 | F-01 |
| D-04 | Keine Laufzeitabhängigkeiten | 4.1 | NFR-04 |
| D-05 | UI ohne Framework mit kleinem DOM-Helfer, Hash-Routing | 3.2, 3.3 | TDD v1 |
| D-06 | IndexedDB mit Stores `sets`, `reviewEvents`, `sessions`, `settings`, `meta`; Set als Dokument | 6.1 | TDD v1, F-08 |
| D-07 | Kein Store `progress`; Lernstand wird aus Events berechnet | 6.1, 12.6 | F-08 |
| D-08 | Kurz-IDs aus eigenem Alphabet (10 bzw. 6 Zeichen) | 6.3 | F-05 |
| D-09 | `rev` als 8-stelliger Inhalts-Hash für Set, Sektion und Eintrag | 6.4, 9.5 | F-06 |
| D-10 | Aktualisieren: fehlendes Feld bleibt, `null` löscht | 9.3 | F-03 |
| D-11 | Unbekannte Felder werden ignoriert und gemeldet | 8.4 | F-04 |
| D-12 | `meanings` als Liste von Antworten; Antworten in Kurz- (String) oder Langform | Formatspez. 5 | F-07 |
| D-13 | Eine Migrationskette aus reinen Funktionen für DB und Backups | 7.1 | FR-33, T-11 |
| D-14 | Sicherungskopie in separater Datenbank vor Migrationen mit Datenumwandlung | 7.3 | FR-33 |
| D-15 | Handgeschriebener Service Worker, cache-first, Aktivierung nur auf Bestätigung außerhalb von Sitzungen | 5 | T-03 |
| D-16 | Duplikaterkennung über Inhaltsüberschneidung ≥ 0,8 oder gleichen Titel | 9.2 | T-07 |
| D-17 | Dateiauslieferung über Teilen-Menü auf Mobilgeräten, sonst Download (in M0 zu bestätigen) | 11.2 | T-22 |
| D-18 | Multiple-Choice-Kandidaten aus demselben Set und derselben Sprachseite, ohne Überschneidung mit akzeptierten Antworten | 12.3 | FR-09 |
| D-19 | Hosting auf GitHub Pages per Actions, eigene Domain vor erster Auslieferung | 4.4 | F-02, bestätigt am 19. Oktober 2026 |
| D-20 | Browserziel `baseline-widely-available` (in M0 zu bestätigen) | 4.3 | – |
| D-21 | Deployment nur vom Branch `production`, der ausschließlich per Fast-Forward aus `main` nachgezogen wird | 4.4, 4.5 | Nutzerentscheidung in S-04, 20. Oktober 2026 |
| D-22 | App-Icons aus einer SVG-Vorlage; PNGs per Playwright-Skript erzeugt und eingecheckt; Cache-Version über alle vorab gespeicherten Dateien | 4.1, 4.2, 5.1 | Nutzerentscheidung in S-05, 20. Oktober 2026 |

---

## 18. Offene Punkte und Risiken

| ID | Thema | Umgang |
|---|---|---|
| O-01 | Hosting endgültig (D-19) | Entschieden am 19. Oktober 2026: GitHub Pages |
| O-02 | Verhalten von `persist()` und der 7-Tage-Regel in Safari, Browser vs. installierte App (R-01) | Messung in S-11 |
| O-03 | Dateiauslieferung auf iOS in der installierten App (D-17, T-22) | Spike in S-09, Prüfung in S-11 |
| O-04 | Mindestversionen der Zielbrowser (D-20) | Bestätigung in S-11 |
| O-05 | Bewertung inhaltlicher Änderungen für den Lernstand (R-04) | Daten über `entryRev` vorbereitet; Entscheidung mit späterer Didaktik |
| O-06 | Wachstum der Review-Events über Jahre | Messung TAK-15; bei Bedarf Cache oder Archivierung mit Backup-Konzept |
| O-07 | Schwellenwert der Duplikaterkennung (0,8) | Mit Beispielsets und echten Daten in M1 prüfen |

---

## 19. Quellen

Geprüft am 18. bis 20. Oktober 2026.

1. MDN – IndexedDB API und Using IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
2. W3C – Indexed Database API 3.0 (Transaktionen, Upgrade-Abbruch): https://www.w3.org/TR/IndexedDB/
3. MDN – Storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
4. MDN – StorageManager.persist(): https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
5. WebKit – Updates to Storage Policy: https://webkit.org/?p=14403
6. Search Engine Land – Safari 7-day cap on script-writeable storage: https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519
7. JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12
8. RFC 5646 / BCP 47: https://www.rfc-editor.org/rfc/rfc5646
9. W3C – WCAG 2.2: https://www.w3.org/TR/WCAG22/
10. Vite 8: https://vite.dev/blog/announcing-vite8
11. vite-plugin-singlefile: https://github.com/richardtallent/vite-plugin-singlefile
12. Vitest 5 – Migrationshinweise und Voraussetzungen: https://vitest.dev/guide/migration
13. Playwright CLI vs. MCP für Coding-Agents: https://betterstack.com/community/guides/ai/playwright-cli-vs-mcp-browser/
14. Bun Standalone HTML (verworfene Alternative): https://bun.com/docs/bundler/standalone-html
15. GitHub-Pläne (Pages im Free-Plan nur für öffentliche Repositories): https://docs.github.com/en/get-started/learning-about-github/githubs-plans
16. Netlify Free Plan Limits 2026: https://netli.fyi/blog/netlify-free-plan-limits-2026
17. Vercel Free Tier Limits 2026: https://deploywise.dev/blog/vercel-free-tier-limits-2026
18. Playwright – Continuous Integration: https://playwright.dev/docs/ci
19. `actions/setup-node` – Caching und Node-Versionen: https://github.com/actions/setup-node
20. GitHub Actions – Abrechnung, Kontingente im Free-Plan: https://docs.github.com/en/billing/concepts/product-billing/github-actions
21. GitHub Pages – Custom Workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
22. `actions/upload-pages-artifact` (v5) und `actions/deploy-pages` (v5): https://github.com/actions/upload-pages-artifact/releases, https://github.com/actions/deploy-pages/releases
23. GitHub – Rulesets und Deployment-Umgebungen: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets, https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
24. heise – iOS 26: geändertes Verhalten von Web-Apps auf dem Home-Bildschirm: https://heise.de/-10749652

---

## 20. Änderungshistorie

| Version | Datum | Änderungen | Entstehung |
|---|---|---|---|
| 1.0 | 18. Oktober 2026 | Erster technischer Entwurf auf Basis von PRD 2.1 | KI-gestützter Entwurf mit ChatGPT (OpenAI), Modell GPT-6, in Zusammenarbeit mit dem Nutzer; Reasoning-Stufe und Snapshot-ID nicht als überprüfbare Metadaten verfügbar; Knowledge Cutoff Dezember 2025 |
| 2.0 | 19. Oktober 2026 | Neufassung nach Review (T-01–T-24, F-01–F-09): Build-Pipeline und Werkzeuge, PWA und Updates, Speicherschutz, Kurz-IDs und `rev`-Konflikterkennung, Aktualisieren mit `null`-Löschung, tolerante Validierung, mehrere Bedeutungen, Migrationskette, kein `progress`-Store, Multiple-Choice-Regeln, Sitzungs-Lebenszyklus, Teststrategie mit Werkzeugen, IDs für Entscheidungen und Abnahmekriterien, Umsetzungsplan mit Walking Skeleton; `file://` und Lehrwerksbezüge entfernt; Austauschformat in eigene Formatspezifikation ausgelagert | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.1 | 19. Oktober 2026 | Vitest 5 statt Vitest 4 (4.1, Quelle 12) | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.2 | 20. Oktober 2026 | Test-Setup (S-02): `@types/node` und globale Installation von `playwright-cli` in 4.1; `fake-indexeddb` wird mit S-06 eingerichtet | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.3 | 20. Oktober 2026 | CI (S-03): 4.5 präzisiert – Typprüfung über `npm run typecheck` statt `tsc --noEmit`, Formatprüfung, Browserinstallation ohne Cache und Container-Image, Report-Artefakt, Abhängigkeit des Deploy-Jobs; Quellen 18–20 | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.4 | 20. Oktober 2026 | Deployment (S-04): Branch `production` nur per Fast-Forward aus `main` (D-21), Pages-Quelle „GitHub Actions“, Artefakt aus dem Prüfjob, konkrete Adresse in 4.4; 4.5 entsprechend; Quellen 21–23 | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.5 | 20. Oktober 2026 | Installation, Offline-Betrieb und Updates (S-05): Icons aus SVG-Vorlage per Playwright-Skript und Cache-Version über alle vorab gespeicherten Dateien (D-22, 4.1, 4.2); Manifest- und iOS-Angaben konkretisiert (5.1); Service Worker mit `cache: "reload"`, ohne `clients.claim()`, ohne eigenen Eintrag für `index.html` (5.2); Neuladen nur im bestätigenden Tab, `setUpdateBlocked()` für TAK-12 (5.3); Build-Prüfung erweitert (4.2); E2E-11 (15.4); Quelle 24 | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.6 | 20. Oktober 2026 | Datenbank-Grundgerüst (S-06): Blockierung durch ältere Tabs und Ende des Routings nach `versionchange` (3.4); Strukturschritte pro Version, lückenlose Kette, ein Cursor-Durchlauf pro Store, unveränderliche Schlüssel (7.1); ausdrücklicher Abbruch des Upgrades und kein Notfall-Backup bei gescheiterter Ersteinrichtung (7.2); E2E-12 (15.4) | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |

---

## 21. Umsetzungsplan

Einzige Stelle mit Umsetzungsstand: 🔲 offen · 🔶 in Arbeit · ✅ erledigt. Reihenfolge und Meilensteine gemäß PRD 5.3. Arbeitspakete werden bei Bedarf feiner zerlegt; neue Pakete erhalten fortlaufende Nummern.

### M0 – Walking Skeleton

Ziel: Jeder riskante Teil läuft einmal von vorn bis hinten, in einfachster Form und auf einem echten iPhone geprüft.

- ✅ **S-01** Projekt-Setup: Vite + TS + `vite-plugin-singlefile`, Verzeichnisstruktur (3.1), npm-Skripte, Prettier, `CLAUDE.md` (4.6) – D-01–D-05  
  Erledigt am 19. Oktober 2026 mit Vite 8.3, TypeScript 7.0, `vite-plugin-singlefile` 2.3, Prettier 3.9; DOM-Helfer `h()`, Hash-Router, Platzhalter-Ansicht. `tsconfig.domain.json` ohne DOM-Typen (TAK-04) folgt mit dem ersten Modul in `domain/`.
- ✅ **S-02** Test-Setup: Vitest + `fake-indexeddb`, Playwright mit zwei Projekten gegen `vite preview`, Build-Test, `playwright-cli` für den Agent – TAK-01  
  Erledigt am 20. Oktober 2026 mit Vitest 5.0, Playwright 1.64, `playwright-cli` 0.1.22 (global). Vitest-Projekte `unit` (`src/**/*.test.ts`) und `build` (Build-Prüfung, läuft in `npm run build`); E2E-Smoke-Test prüft Start, Routing, fremde Anfragen (TAK-02) und Konsolenfehler. `fake-indexeddb` folgt mit dem ersten Storage-Test in S-06. Offen für S-05: Chrome fordert `favicon.ico` an (404), bis Icons vorhanden sind.
- ✅ **S-03** CI in GitHub Actions (4.5) – TAK-14  
  Erledigt am 20. Oktober 2026 mit `actions/checkout@v7`, `actions/setup-node@v7` (Node.js `lts/*`, im ersten Lauf 24.22), `actions/upload-artifact@v7`. Ein Lauf dauert etwa 1,5 Minuten, davon rund 1 Minute für die Browserinstallation; ein Container-Image lohnt sich daher nicht. Fehlerfall einmal absichtlich ausgelöst: Annotationen am Test und Artefakt `playwright-report` mit Traces vorhanden. TAK-14 ist vollständig erfüllt, sobald S-04 den Deploy-Job mit `needs: check` ergänzt. Die Läufe nutzten noch Ubuntu 24.04; `ubuntu-latest` wechselt ab 19. Oktober 2026 schrittweise auf Ubuntu 26, das Playwright 1.64 unterstützt.
- ✅ **S-04** Provisorisches Deployment auf GitHub Pages (Repository öffentlich schalten) – NFR-01, D-19, D-21  
  Erledigt am 20. Oktober 2026 mit `actions/upload-pages-artifact@v5` und `actions/deploy-pages@v5`; App läuft unter https://cgrothaus.github.io/vokabeltrainer/. Ein Lauf auf `production` dauert etwa 1,5 Minuten (Job `deploy` rund 15 Sekunden). Die ausgelieferte `index.html` ist bytegleich mit dem lokalen Build. Pages liefert mit `cache-control: max-age=600` aus; eine neue Version kann im Browser also bis zu 10 Minuten verzögert erscheinen. Die Umgebung `github-pages` wurde von GitHub mit `main` angelegt und auf `production` umgestellt; das Ruleset `production` sperrt Force-Push und Löschen. Mit `playwright-cli` (mobiles Chromium) geprüft: Startseite und Hash-Routing funktionieren, angefragt wird nur `index.html`. Chrome fragt `favicon.ico` am Ursprung `cgrothaus.github.io/` an (404); S-05 behebt das mit einem relativen `<link rel="icon">`. Öffnen auf dem iPhone folgt mit S-11.  
  Vor dem Öffentlichschalten am 20. Oktober 2026 die Git-Historie mit `git filter-repo --replace-text` bereinigt: Das frühere TDD v1 enthielt ein Beispiel mit Lehrwerkstitel, Sektionsnamen und zwei Vokabelpaaren aus dem Prototyp, die Review-Notizen zitierten den Titel unter T-10. Alle Commit-Hashes vor diesem Datum haben sich dadurch geändert; die alten Actions-Läufe wurden gelöscht. Lizenztext für den eingecheckten Skill `playwright-cli` (Apache-2.0) beigelegt. Eine Lizenz für das Projekt wird vorerst nicht vergeben.
- ✅ **S-05** Manifest, Icons, Service Worker, Offline-Start, Update-Hinweis (5) – NFR-03, NFR-05, AK-21, TAK-11, TAK-12  
  Erledigt am 20. Oktober 2026. Manifest und Icons liegen in `public/`, die PNGs entstehen per `npm run icons` aus der SVG-Vorlage (D-22). Der Service Worker ist ein eigener Vite-Build (IIFE, unter 1 kB); seine Cache-Version ist ein Hash über alle vorab gespeicherten Dateien. Die Build-Prüfung führt `sw.js` in einer Attrappe aus. E2E-03 (Offline-Start) und E2E-11 (Update erst nach Bestätigung) laufen in mobile-chromium und mobile-webkit. E2E-11 startet einen eigenen `vite preview` auf einer Kopie von `dist/` (Ports ab 4280; 4190 sperrt WebKit als „bad port“), weil Chromium die Update-Prüfung des Service Workers nicht über `page.route` leitet. Gegenproben: `skipWaiting()` beim Installieren lässt E2E-11 scheitern, ein geändertes Icon ohne neuen `sw.js` die Build-Prüfung. Mit `playwright-cli` (mobiles Chromium) geprüft: Manifest fehlerfrei erkannt (einziger Installationshinderungsgrund ist das Inkognito-Profil); Hinweisleiste hell und dunkel bei 320 px ohne horizontales Scrollen; nach „Jetzt aktualisieren“ besteht nur noch der neue Cache, die Konsole bleibt leer; im Dev-Server wird kein Service Worker registriert. Der `favicon.ico`-Fehler aus S-02 und S-04 ist behoben; der Smoke-Test meldet jetzt auch fehlgeschlagene Anfragen. TAK-12 ist vorbereitet (`setUpdateBlocked()`); angeschlossen und geprüft wird es mit S-08. Am 20. Oktober 2026 deployt; ausgelieferte Dateien bytegleich mit dem lokalen Build, live mit `playwright-cli` offline gestartet. Hinzufügen zum Home-Bildschirm auf Android und iPhone bestätigt (S-11); Offline-Start auf dem Gerät noch offen.
- ✅ **S-06** IndexedDB-Grundgerüst (inkl. `fake-indexeddb` für die Integrationstests): Öffnen, Upgrade, Migrationskette mit Test-Migration v1 → v2, `versionchange`/`VersionError`, Notfall-Backup, `persist()` mit Anzeige des Ergebnisses (6, 7) – FR-22, FR-33, TAK-05, TAK-08  
  Erledigt am 20. Oktober 2026 mit `fake-indexeddb` 6.2. Erstes Modul in `domain/` (Migrationskette, Backup-Hülle); `tsconfig.domain.json` ohne DOM- und Node-Typen, Gegenprobe: `document` in `domain/` lässt `npm run typecheck` scheitern (TAK-04). `openDatabase` liefert ein Ergebnis pro Lage (geöffnet, kein Speicher, neuere Version, Einrichtung gescheitert, Migration gescheitert mit Notfall-Backup); geschrieben wird nur über `runTransaction`, das erst nach `complete` erfüllt (TAK-05). Integrationstests decken Einrichtung, Migration v1 → v2, fehlschlagende Migration mit unverändertem Altstand (TAK-08), fehlende Kettenglieder, `VersionError`, `versionchange` und `blocked` ab. Gegenprobe: Ohne ausdrückliches `abort()` übernimmt `fake-indexeddb` die halbe Migration; deshalb bricht die App selbst ab (7.2). E2E-12 läuft in mobile-chromium und mobile-webkit. Die App-Version (`0.1.0+<Commit>`) wird per `define` eingebettet und steht im Notfall-Backup. Datei-Auslieferung vorerst nur als Download; das Teilen-Menü folgt mit S-09.  
  Provisorisch für M0: Die Bibliothek zeigt den Speicherschutz und eine Schaltfläche „Dauerhaften Speicher anfordern“ für die Messung in S-11; der automatische Aufruf nach dem ersten gespeicherten Set (6.6) kommt mit S-07, die Schaltfläche entfällt spätestens mit S-26. Der Dev-Schalter `?testmigration=ok|fail` (nur `npm run dev`, nicht im Build) führt die Test-Migration auf einer eigenen Datenbank `vokabeltrainer-testmigration` aus. Mit `playwright-cli` (mobiles Chromium) geprüft: `fail` zeigt „Daten nicht übernommen“, das heruntergeladene Notfall-Backup enthält den unveränderten Datensatz mit `dataVersion` 1; `ok` hebt die Testdatenbank auf Version 2 mit umbenanntem Feld und neuem Index; Chromium lehnt `persist()` für die frisch besuchte Seite ab, die Anfrage wird in `meta` vermerkt; Konsole ohne Fehler. Offen für S-10: E2E-04 braucht gegen das gebaute Artefakt einen Weg zu einer älteren Datenbank, solange `DB_VERSION` 1 ist.
- 🔲 **S-07** Minimaler Import: Textfeld und Datei, `extract.ts`, Grundvalidierung, Speichern als neues Set ohne Vorschau – FR-13 (Teil)
- 🔲 **S-08** Minimale Lernsitzung: ganzes Set, nur Karteikarten, Review-Events und Sitzung werden gespeichert – FR-11 (Teil)
- 🔲 **S-09** Backup-Export (Teilen-Menü bzw. Download, Spike D-17) und Wiederherstellung (ersetzt alles) inkl. `lastBackupAt` – FR-19 (Teil), TAK-09
- 🔲 **S-10** E2E-01 bis E2E-04 in der CI (E2E-03 besteht seit S-05)
- 🔶 **S-11** Manuelle Prüfung auf echtem iPhone und Android (15.5); Ergebnisse zu O-02, O-03, O-04 hier festhalten  
  Erste Prüfung am 20. Oktober 2026 mit dem Stand von S-06 unter https://cgrothaus.github.io/vokabeltrainer/:
  - Android (Chrome): Hinzufügen zum Startbildschirm funktioniert; `persist()` wird schon im Browser gewährt.
  - iPhone (Safari): Hinzufügen zum Home-Bildschirm funktioniert. Im Safari-Tab gewährt `persist()` nichts, die Schaltfläche wirkt wirkungslos, weil der Hinweis unverändert bleibt. Als Home-Bildschirm-App wird `persist()` gewährt (O-02, R-01). Die Empfehlung „Teilen → Zum Home-Bildschirm“ aus 6.6 ist damit auf iOS der entscheidende Schutz; für S-26: Eine abgelehnte Anfrage braucht eine sichtbare Rückmeldung mit dieser Empfehlung.
  - Offen: Offline-Start vom Home-Bildschirm im Flugmodus (AK-21), Update-Hinweis auf dem Gerät, 7-Tage-Regel in Safari (O-02), Geräte- und Systemversionen (O-04), Dateiauslieferung (O-03, nach S-09).

### M1 – Lernen mit eigenen Sets

- 🔲 **S-12** Vollständige Validierung und Normalisierung nach Formatspezifikation, testgetrieben, mit Fixtures; JSON Schema `vokabeltrainer-set.schema.json` und Schemaabgleich – DF-01–DF-08, TAK-10
- 🔲 **S-13** Importvorschau für neue Sets mit Warnungen; Duplikaterkennung – FR-16, FR-30, AK-19
- 🔲 **S-14** Bibliothek gruppiert nach Sprache, Set-Ansicht mit Sektionen, Set löschen – FR-01–FR-03
- 🔲 **S-15** Empty State, Hilfe mit Formatbeispiel und Prompt-Vorlagen – FR-20, FR-28, AK-14
- 🔲 **S-16** Beispielset erstellen (13.2) – FR-32, AK-23
- 🔲 **S-17** Sitzung einrichten: Auswahl Sektionen, Richtung, Anzahl, Multiple-Choice-Anteil; gemerkte Einstellungen – FR-07, FR-08, FR-21
- 🔲 **S-18** Multiple Choice mit Kandidatenregeln (testgetrieben), Bedienwege Karteikarte – FR-09, AK-22
- 🔲 **S-19** Fehlerwiederholung, Zwischenstand, Fortsetzen, Ergebnis, „Nur Fehler üben“ – FR-10, FR-12
- 🔲 **S-20** Lernüberblick aus Events (testgetrieben) – FR-11, AK-17
- 🔲 **S-21** Einstellungen, Hell/Dunkel, App-Version – FR-21, FR-25
- 🔲 **S-22** Speicherfehler und Statusanzeige – FR-23, AK-26
- 🔲 **S-23** Mobile- und Barrierearmut-Durchsicht, E2E-05, E2E-06, E2E-10 – FR-24, FR-27, NFR-09–NFR-13
- 🔲 **S-24** Performance-Messung (15.6) – TAK-15

### M2 – Daten sichern

- 🔲 **S-25** Backup vollständig: Vorschau mit Umfang, Warnung, Angebot eines vorherigen Backups – FR-19, AK-10
- 🔲 **S-26** Speicherschutz-Hinweise und iOS-Installationsanleitung – FR-31, AK-20
- 🔲 **S-27** Backup-Erinnerung mit Zurückstellen – FR-31, AK-20
- 🔲 **S-28** Sicherungskopie vor Migrationen (7.3) – FR-33, D-14
- 🔲 **S-29** Erste Auslieferung vorbereiten: eigene Domain, `DB_VERSION` und Formate einfrieren, Fixtures v1 anlegen – FR-33, T-23

### M3 – Inhalte pflegen und teilen

- 🔲 **S-30** Editor für Einträge (Formular, Bedeutungen, Varianten, optionale Felder), ungespeicherte Änderungen – FR-04, FR-05
- 🔲 **S-31** Leeres Set anlegen, Sektionen anlegen/umbenennen/verschieben/löschen, Einträge verschieben – FR-02, FR-03, AK-25
- 🔲 **S-32** Set- und Sektionsexport mit `scope`, IDs und `rev` – FR-18
- 🔲 **S-33** Mehrere Tabs: `BroadcastChannel` (3.4); E2E-07

### M4 – Korrigieren und aktualisieren

- 🔲 **S-34** `diff.ts`/`merge.ts` testgetrieben: Aktualisieren, Ersetzen, Konflikttabelle, Sonderfälle – FR-15, FR-17, FR-29, TAK-16
- 🔲 **S-35** Vorschau für bekannte Sets mit Konflikten und Löschungen; `editCount`-Prüfung – FR-14, FR-16, TAK-07
- 🔲 **S-36** Übernahme in einer Transaktion; E2E-08, E2E-09 – AK-04, AK-05, AK-06, AK-18
- 🔲 **S-37** Abschließende Gerätechecks aller Meilensteine (15.5)
