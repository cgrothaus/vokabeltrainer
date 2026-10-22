# TDD: Allgemeiner, mobiler Vokabeltrainer

**Version:** 2.17 – Beispielset  
**Stand:** 22. Oktober 2026  
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
│   ├── views/           Bibliothek, Set, Import, Hilfe, Lernen, Ergebnis, Editor, Backup, Einstellungen
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
│   ├── importSet.ts     neues Set aus Text: herauslösen, prüfen, normalisieren, IDs ergänzen
│   ├── diff.ts          Vergleich Datei ↔ Bestand, Konflikte
│   ├── merge.ts         Anwenden von Aktualisieren/Ersetzen
│   ├── duplicates.ts    Duplikaterkennung
│   ├── library.ts       Bibliothek: Gruppierung nach Lernsprache, Sortierung, Umfang eines Sets
│   ├── practice.ts      Sitzungswarteschlange, Multiple-Choice-Auswahl
│   ├── stats.ts         Lernstand und Überblick aus Events
│   ├── exportFormat.ts  Set-Export
│   ├── backup.ts        Backup-Hülle, Prüfen und Migrieren beim Wiederherstellen
│   ├── validateRecords.ts gespeicherte Datensätze prüfen (Backup, später DB-Fixtures)
│   └── migrations/      Migrationen von Datensätzen und Dateiformaten
├── storage/             IndexedDB: Öffnen, Upgrade, Repositories, Backup
├── platform/            Browserfunktionen: Service Worker, persist(), Datei liefern, Zwischenablage
├── content/             mitgelieferte Inhalte: Hilfetexte mit Formatbeispiel und Vorlage, Beispielset
├── styles/              CSS
└── sw/sw.ts             Service Worker (eigener Build)
```

Regeln:

- `domain/` importiert nichts aus `app/`, `storage/` oder `platform/` und greift nicht auf `window`, `document` oder `indexedDB` zu (TAK-04).
- UI-Code enthält keine Merge-, Validierungs- oder Datenbanklogik.
- `storage/` kennt das Datenmodell aus `domain/model.ts`, aber keine UI.

### 3.2 Routing

Hash-basiertes Routing (`#/`, `#/set/<id>`, `#/import`, `#/practice`, `#/backup`, `#/settings`). Es funktioniert in einer einzelnen HTML-Datei, unter jedem Pfad des Hostings und unterstützt die Zurück-Taste unter Android. Feste Routen haben einen Pfadteil; eine Route wie `/set/` nimmt genau einen weiteren, nicht leeren Pfadteil als Parameter (URL-kodiert). `#/set/` ohne ID und eine kaputte Kodierung führen zu „Seite nicht gefunden“, eine unbekannte ID zu „Set nicht gefunden“, jeweils mit Weg zurück zur Bibliothek.

### 3.3 UI ohne Framework (D-05)

- Ein kleiner Helfer `h(tag, props, ...children)` erzeugt DOM-Elemente. Kinder vom Typ String werden **immer als Textknoten** eingefügt. `innerHTML` wird im gesamten Code nicht für Daten verwendet (TAK-03).
- Jede Ansicht ist eine Funktion, die aus dem Zustand ein DOM-Teilbaum erzeugt. Bei Zustandsänderungen wird die aktive Ansicht neu gerendert; Fokus und Scrollposition werden dabei gezielt erhalten.
- Der Router übergibt jeder Ansicht ein `AbortSignal`, das beim Verlassen der Ansicht (auch über die Zurück-Taste) und beim Ende des Routings abgebrochen wird. Die Lernsitzung beendet sich darüber (12.5).
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
| Schemaabgleich | Ajv 8 (nur Entwicklung) | Prüft Testfixtures gegen das JSON Schema (TAK-10); Draft 2020-12 über `ajv/dist/2020`. |
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
├── formatspezifikation.md  Formatspezifikation, unverändert aus docs/ (D-26)
├── vokabeltrainer-set.schema.json  JSON Schema, unverändert aus docs/ (D-26)
└── icons/                  icon.svg (Vorlage, Favicon), icon-180.png (apple-touch-icon), icon-192.png, icon-512.png
```

- Alle Verweise sind **relativ**, damit die App unter einem Unterpfad (z. B. GitHub Pages ohne eigene Domain) und unter einer eigenen Domain gleichermaßen läuft.
- Manifest und Icons liegen in `public/` und werden unverändert kopiert. In `index.html` stehen die Verweise mit Wurzelpfad (`/manifest.webmanifest`); Vite schreibt sie mit `base: "./"` relativ um.
- Formatspezifikation und Schema (D-26) gibt ein kleines Plugin in `vite.config.ts` beim Build aus `docs/` aus; die Liste steht als `PUBLISHED_DOCS` in `scripts/precache.ts`. Dev-Server und `vite preview` liefern beide mit `charset=utf-8` aus wie GitHub Pages; ohne Zeichensatz zeigt der Browser Umlaute in der geöffneten Datei falsch an.
- Build-Schritte: `vite build` (App) → `vite build -c vite.sw.config.ts` (Service Worker als IIFE nach `dist/sw.js`). Die zweite Konfiguration ermittelt mit `scripts/precache.ts` die vorab zu speichernden Dateien (`index.html`, Manifest, veröffentlichte Dokumente, Icons) und einen Hash über deren Pfade und Inhalte; Dateiliste und Hash (Cache-Version) gehen per `define` in `sw.js` ein. So ändert sich `sw.js` genau dann, wenn sich eine dieser Dateien ändert, auch bei einem neuen Icon.
- `src/sw/` wird mit eigener TS-Konfiguration (`tsconfig.sw.json`, Typen `WebWorker` statt `DOM`) geprüft.
- Die App-Version (`package.json`-Version plus kurzer Git-Commit) wird per `define` eingebettet und in den Einstellungen angezeigt.
- Ein Test prüft die Build-Ausgabe (TAK-01): keine externen URLs in `index.html`, kein `<script src>`, kein `<link rel="stylesheet">`; Kopfzeilen verweisen relativ auf vorhandene Dateien; Manifest mit Pflichtangaben und vorhandenen Icons; `sw.js` ist ein klassisches Skript ohne externe URLs und lädt beim Installieren – in einer Attrappe ausgeführt – genau die Dateien aus `scripts/precache.ts` in den Cache der aktuellen Version; die veröffentlichten Dokumente sind bytegleich mit `docs/`.

### 4.3 Browserziel (D-20)

Vite-Standardziel `baseline-widely-available`; das entspricht etwa Safari/iOS 16 und Chrome der letzten gut zwei Jahre. Benötigte Plattformfunktionen (IndexedDB, Service Worker, `crypto.getRandomValues`, `Intl.getCanonicalLocales`, `Intl.DisplayNames`, `BroadcastChannel`, `navigator.storage`) sind dort vorhanden. Moderne CSS-Syntax (Verschachtelung, `light-dark()`) wird beim Build bei Bedarf heruntertransformiert. In M0 (S-11) auf echten Geräten bestätigt mit iOS 27, iPadOS 26 und Android 16 mit aktuellem Chrome; ältere Versionen sind ungeprüft.

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

- **install:** lädt `./` (die App), `./manifest.webmanifest`, die veröffentlichten Dokumente (D-26) und die Icons in einen Cache `vokabeltrainer-<hash>`, jeweils mit `cache: "reload"`. GitHub Pages liefert mit `max-age=600` aus; ohne `reload` könnte ein alter Stand aus dem HTTP-Cache unter dem neuen Cache-Namen landen. `./index.html` wird nicht eigens gespeichert, weil jede Navigation `./` bekommt.
- **activate:** löscht ältere Caches mit dem Präfix `vokabeltrainer-`. Kein `clients.claim()`: Beim allerersten Laden bleibt die Seite ungesteuert, ab dem nächsten Start läuft sie offline.
- **fetch:** GET-Anfragen an die eigene Adresse werden **cache-first** aus dem aktuellen Cache beantwortet. Eine Navigation zu einer vorab gespeicherten Datei liefert diese (z. B. die Formatspezifikation per Link), jede andere Navigation (auch mit Parametern) liefert `./`. Fehlt eine Datei im Cache, geht die Anfrage ans Netz. Andere Anfragen gibt es nicht (TAK-02).
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
- Erzeugung mit `crypto.getRandomValues`, das die App an `domain/ids.ts` übergibt (`domain/` kennt kein `crypto`, TAK-04); Bytes ab 248 werden verworfen, damit alle 31 Zeichen gleich wahrscheinlich sind. Sektions- und Eintrags-IDs werden bei der Erzeugung gegen alle IDs des Sets geprüft und bei Kollision neu gezogen.
- Beim Import werden fremde IDs akzeptiert, wenn sie `^[A-Za-z0-9_-]{1,64}$` entsprechen (z. B. ältere UUIDs).
- Lernfortschritt wird über `setId + entryId` zugeordnet. Gleiche Eintrags-IDs in verschiedenen Sets vermischen sich deshalb nicht.
- Eine bekannte `set.id` in einer Datei identifiziert ein lokales Set eindeutig. Gleiche Worttexte führen nie zu einer automatischen Zuordnung.

### 6.4 Prüfwert `rev` (D-09, F-06)

- `rev` = 8 Zeichen aus dem Alphabet aus 6.3, gebildet aus einem 53-Bit-Hash (cyrb53, Startwert 0, über die UTF-16-Codeeinheiten) der **kanonischen Darstellung** des Objekts: die niederwertigsten 8 Stellen des Hashwerts zur Basis 31, die kleinste Stelle zuerst (also der Wert modulo 31⁸). Die höchstwertigen Stellen eines 53-Bit-Werts wären ungleich verteilt.
- Kanonische Darstellung: JSON der normalisierten Langform ohne Leerraum, Schlüssel auf jeder Ebene nach UTF-16-Codeeinheiten sortiert, fehlende optionale Felder, leere Arrays und leere Objekte (auch solche, die erst durch das Weglassen leer werden) weggelassen, `id` und `rev` selbst ausgenommen, ebenso die Unterelemente (Sektionen eines Sets, Einträge einer Sektion).
  - **Set:** alle Set-Felder aus 6.2 außer `id`, `editCount`, `createdAt`, `updatedAt`, `sections`.
  - **Sektion:** `title`.
  - **Eintrag:** alle Felder außer `id`.
- Der Hash ist kein Sicherheitsmerkmal. Er erkennt lediglich zufällige Änderungen; Kollisionen sind bei rund 39,6 Bit (31⁸ Werte) pro Objektversion praktisch ausgeschlossen.
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
- In M0 gemessen (S-11): Safari gewährt `persist()` im Tab nicht, als Home-Bildschirm-App schon; Chrome auf Android gewährt es schon im Browser. Auf iOS ist „Teilen → Zum Home-Bildschirm“ damit der entscheidende Schutz.

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

- Bis zur ersten Auslieferung an Nutzende bleibt `DB_VERSION` = 1, und das Schema darf sich ohne Migration ändern (Testdaten werden verworfen). Der Migrationsmechanismus wird trotzdem in M0 mit einer Test-Migration v1 → v2 geprüft, und zwar in den Integrationstests und per Dev-Schalter. Gegen das gebaute Artefakt gibt es dann noch keine ältere Datenbank, die migriert werden könnte.
- Ab der ersten Auslieferung gilt: Jede Änderung am gespeicherten Datenmodell erhöht `DB_VERSION` und bringt eine Migration und ein Fixture des Vorgängerstands mit (TAK-08). Mit der ersten Erhöhung auf `DB_VERSION` 2 entsteht außerdem E2E-04 (15.4): Der Test legt die alte Datenbank aus dem Fixture v1 an.
- Fixtures früherer Stände (`tests/fixtures/db/vN.json`, `tests/fixtures/backup/vN.json`, `tests/fixtures/setfile/vN/…`) werden nie gelöscht.

---

## 8. Importformat und Validierung

Das Format selbst ist in der **Formatspezifikation** festgelegt. Hier steht die interne Verarbeitung.

### 8.1 Eingangswege (FR-13, R-10)

- **Datei:** `<input type="file" accept=".json,application/json,text/plain">`, gelesen mit `File.text()`.
- **Text:** ein Textfeld zum Einfügen; zusätzlich eine Schaltfläche „Aus Zwischenablage einfügen“ über `navigator.clipboard.readText()`, sofern verfügbar. Sie trägt den Text ins Feld ein und zeigt sofort die Vorschau (gespeichert wird ohnehin erst nach Bestätigung). Abgelehnter Zugriff oder eine leere Zwischenablage ergeben einen Hinweis; der Weg über das Textfeld bleibt.
- Beide Wege liefern einen String an dieselbe Verarbeitung.

### 8.2 JSON herauslösen (`extract.ts`)

1. Byte-Order-Mark und Leerraum am Rand entfernen.
2. Enthält der Text einen Markdown-Codeblock, wird der Inhalt des ersten Codeblocks verwendet, der mit `{` beginnt.
3. Sonst wird der Bereich vom ersten `{` bis zum passenden letzten `}` verwendet.
4. `JSON.parse`; bei Fehlern ermittelt ein eigener, iterativer Syntaxprüfer die Fundstelle (D-23), weil Safari keine Position meldet. Zeile und Spalte zählen im eingefügten Text, nicht im herausgelösten Teil. Fehlende Kommas und Doppelpunkte werden direkt hinter dem vorigen Element gemeldet, ein überzähliges Komma an seiner Stelle; typografische und einfache Anführungszeichen sowie abgeschnittener Text bekommen eigene Hinweise.

Die Extraktion meldet in der Vorschau, ob Text entfernt wurde. Weitere Reparaturen (z. B. abschließende Kommas) werden nicht versucht.

### 8.3 Validierung (`validate.ts`)

- Handgeschrieben, ohne Bibliothek, mit deutschen Meldungen und Fundstelle („Sektion 2 „Freizeit“, Eintrag 5 („to miss“): Es fehlt die Bedeutung.“).
- Drei Schweregrade:
  - **Fehler** blockieren den Import (Formatspezifikation 8.4),
  - **Warnungen** werden in der Vorschau gezeigt (z. B. ignorierte Felder, angenommene Formatversion),
  - **Hinweise** sind rein informativ.
- Sprachcodes werden mit `Intl.getCanonicalLocales` geprüft und kanonisiert.
- Grenzen aus der Formatspezifikation 8.4, darunter höchstens 500 Sektionen und 20.000 Einträge pro Datei (DF-08, Schutz vor Blockade). Textlängen zählen Unicode-Zeichen (Codepoints) nach Trimmen und NFC.
- Bekannte Felder stehen pro Ebene (Datei, `set`, `scope`, Sektion, Eintrag, Antwort, Beispiel, Grammatik) in einer Tabelle in `validate.ts`; daraus ergeben sich Typ- und Längenprüfung und die Warnungen für unbekannte Felder. Diese werden pro Ebene und Feldname gebündelt: „Das Feld „difficulty“ wird ignoriert (Sektion 1 „Freizeit“, Eintrag 2 (to go) und 41 weitere Stellen).“ Stehen `meanings` und `meaning` beide da, wird `meaning` ignoriert.
- `null` ist nur bei optionalen Inhaltsfeldern zulässig (Löschmarkierung, D-10); bei Pflichtfeldern, IDs, `rev`, `scope`, `exportedAt` und Listenelementen ist es ein Fehler; bei Pflichtfeldern lautet die Meldung wie bei einem fehlenden Feld. `rev` wird wie eine ID geprüft, `exportedAt` nur als Text.
- `validateSetFile` prüft die Datei unabhängig vom Ziel. Ob sie zum Ziel passt, prüft der Ablauf: `prepareNewSet` lehnt einen Teil-Export ab (9.6), weil ein neues Set keine Sektionen hat, auf die er sich beziehen könnte. `scope` selbst wird nur in seiner Form geprüft (`sectionIds` nichtleer, eindeutig, gültige IDs); Widersprüche zwischen `sectionIds` und den Sektionen prüft `diff.ts` (S-34).
- Der Validator und das JSON Schema (`docs/vokabeltrainer-set.schema.json`, Draft 2020-12) werden über gemeinsame Fixtures abgeglichen (TAK-10, T-18). Das Schema kann nicht ausdrücken: doppelte IDs über Ebenen hinweg, die Höchstzahl der Einträge über alle Sektionen, Trimmen und NFC (es zählt Längen ungetrimmt) sowie die Kanonisierung der Sprachcodes (es prüft nur das Muster `^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$`). Bei Widerspruch gelten Formatspezifikation und Validator.

### 8.4 Normalisierung (`normalize.ts`)

- Kurzformen (String) zu Langform `{ text }` auflösen; `meaning` (Einzahl) zu `meanings` mit einem Element.
- Texte trimmen und in Unicode-NFC überführen; innere Leerzeichen bleiben unverändert.
- Unbekannte Felder entfernen; die Warnung dazu erzeugt die Validierung (D-11, F-04).
- Leere optionale Felder (Strings, Arrays, Objekte, auch solche, die erst durch Trimmen leer werden) stillschweigend entfernen, ohne Warnung (D-24). Elemente von Listen (Varianten, Beispiele, Wortformen) dürfen nicht leer sein; das prüft die Validierung.
- Beispiele (`examples`) in die Langform `{ text, translation? }` überführen.
- Werte `null` bleiben in der normalisierten **Datei**-Darstellung als Löschmarkierung erhalten (für Aktualisieren, D-10). Bei einem neuen Set entfallen sie wie fehlende Felder.

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
- Eine Set-ID aus der Datei, die lokal schon vergeben ist, wird bis M4 schon vor der Vorschau abgelehnt („Dieses Set ist schon vorhanden …“); `addSet` mit `add()` bleibt als Absicherung.
- **Duplikatprüfung (FR-30, R-09, D-16):** Für jedes lokale Set mit gleichem Sprachpaar (gleiche `termLanguage` und gleiche `meaningLanguage`; ein vertauschtes Paar zählt nicht) wird die Überschneidung der Eintragsschlüssel berechnet (`term.text` + erste Bedeutung, kleingeschrieben, NFC; als Mengen, doppelte Einträge zählen einmal). Liegt `|A ∩ B| / min(|A|, |B|)` bei mindestens 0,8 oder ist der Titel gleich (getrimmt, NFC, ohne Groß-/Kleinschreibung), zeigt die Vorschau oben „Dieses Set sieht aus wie „…“, das du schon hast.“ mit „Trotzdem als neues Set importieren“ und „Abbrechen“. Ein leeres Set zählt nur über den Titel. Unterscheidet sich `edition`, nennt die Meldung beide Ausgaben. Die Prüfung gilt für jedes neue Set, auch wenn die Datei eine lokal unbekannte Set-ID mitbringt.
- Die Vorschau zeigt Titel, Sprachen (als Namen über `Intl.DisplayNames`), Zahl der Sektionen und Einträge, die Sektionen mit ihrer Eintragszahl (aufklappbar, bis 10 Sektionen aufgeklappt), einen Hinweis, wenn Begleittext entfernt wurde (8.2), sowie Warnungen. „Abbrechen“ führt zur Eingabe zurück, der Text bleibt stehen.
- Nach dem Speichern wechselt die App zur Bibliothek und meldet dort „„…“ mit n Einträgen gespeichert.“; mit der Set-Ansicht (S-14) öffnet sie stattdessen das Set (9.1).

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

- **Set:** Titel, Sprachen, optionale Angaben; neues leeres Set anlegen; Set löschen mit Angabe des Umfangs (Sektionen, Einträge, Zahl der Antworten und Lernsitzungen). Gelöscht werden in **einer** Transaktion das Set, seine Sitzungen und seine Review-Events (D-25); anders als beim Löschen einzelner Einträge bleibt keine Historie, weil Sitzungen und Events ohne Set jedes Backup ungültig machten (11.4). Die Ankündigung bietet vorher ein Backup an; die Schaltfläche nennt die Folge („Set mit 120 Einträgen löschen“). Löschen gibt es seit S-14 in der Set-Ansicht (13.1).
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

`platform/deliverFile(blob, filename)` liefert `"shared"`, `"downloaded"` oder `"cancelled"`:

- Wenn `navigator.canShare?.({ files: [file] })` zutrifft und das Gerät mobil ist (`pointer: coarse`, `display-mode: standalone` oder `navigator.standalone`), öffnet `navigator.share({ files })` das Teilen-Menü. Dort lässt sich die Datei unter anderem in „Dateien“ sichern.
- Sonst wird ein Download über `<a download>` mit einer Blob-URL ausgelöst.
- Bricht die Person das Teilen ab (`AbortError`), gilt der Export als nicht erfolgt (`"cancelled"`).
- Scheitert `share()` mit einem anderen Fehler (z. B. `NotAllowedError`, wenn die Nutzergeste verbraucht ist), wird stattdessen heruntergeladen. Mobiles Chromium unter Playwright meldet `canShare` als erfüllt, lehnt `share()` aber so ab.
- `share()` verlangt eine frische Nutzergeste. Der Inhalt muss deshalb vor dem Tippen fertig sein; zwischen Tippen und Aufruf liegt nichts, worauf gewartet wird.
- Auf Geräten bestätigt (S-11): iPhone und iPad öffnen das Teilen-Menü (Safari-Tab und Home-Bildschirm-App), die Datei lässt sich in „Dateien“ sichern. Chrome auf Android lädt herunter und zeigt dabei einen eigenen Dialog mit Dateiname, Zielordner und „Abbrechen“; ein Abbruch dort ist für die App nicht erkennbar und zählt nach 11.4 als Backup.

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
- Alle Stores werden in **einer** Read-only-Transaktion gelesen (konsistenter Stand); Serialisierung und Auslieferung folgen danach. Die Backup-Ansicht liest und serialisiert schon beim Öffnen (und nach einer Wiederherstellung erneut), damit das Teilen-Menü direkt in der Tipp-Geste startet (11.2).
- Nach erfolgreicher Auslieferung (`"shared"` oder `"downloaded"`) wird `meta.lastBackupAt` auf `exportedAt` des ausgelieferten Backups gesetzt. Beim Download ohne Erfolgsrückmeldung des Browsers gilt das Auslösen als Erfolg.
- Abläufe: Prüfen in `domain/backup.ts` (`parseBackup`) und `domain/validateRecords.ts`, Lesen und Ersetzen in `storage/backup.ts`, Verbindung in `app/backup.ts`, Ansicht `#/backup`.

### 11.4 Wiederherstellung (FR-19, AK-10)

1. Datei wählen (oder Text einfügen), herauslösen und parsen. Größengrenze 100 MB (Backups wachsen mit den Antworten über die 10 MB des Imports hinaus).
2. Hülle prüfen. Bei `formatVersion` oder `dataVersion` größer als die eigene wird abgelehnt mit „bitte App neu laden“. Ein Vokabelset (auch ohne Formatkennung) wird als solches erkannt und abgelehnt. Alle vier Bereiche unter `data` müssen Listen sein; `meta` und unbekannte Bereiche werden übergangen.
3. Datensätze per Migrationskette (7.1) auf den aktuellen Stand bringen und vollständig validieren: Pflichtangaben und Typen nach 6.2, 12.4 und 12.5, eindeutige Schlüssel pro Store, eindeutige Sektions- und Eintrags-IDs pro Set, Referenzen von Sitzungen auf Sets und von Events auf Sets und Sitzungen (Event-Set = Sitzungs-Set). `entryId` wird nicht geprüft, weil Events gelöschter Einträge erhalten bleiben (9.7, 10). Meldungen nennen nur Positionen („Set 2, Sektion 1, Eintrag 3“), keine Inhalte (14). Eine scheiternde Migration ergibt eine Meldung, keine Ausnahme.
4. Vorschau: Zahl der Sets, Einträge, Sitzungen und Events sowie Exportdatum. Sind lokale Daten vorhanden, folgt die Warnung „Alle Daten auf diesem Gerät werden ersetzt“ mit dem Angebot, vorher ein Backup des aktuellen Stands zu speichern. In M0 (S-09) steht der Umfang in einer Zeile mit dem Satz „Alle Daten auf diesem Gerät werden dadurch ersetzt.“ und den Schaltflächen „Alle Daten ersetzen“ und „Abbrechen“, unabhängig vom lokalen Bestand; den Rest ergänzt S-25.
5. Alle Stores außer `meta` in **einer** Read-Write-Transaktion leeren und befüllen; in derselben Transaktion `meta.lastBackupAt = exportedAt` des Backups setzen. Andere Einträge in `meta` bleiben. Scheitert etwas, bleibt der alte Bestand einschließlich `lastBackupAt` erhalten.
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
- `completed`: alle Karten beantwortet. `ended`: vorzeitig beendet und nicht fortgesetzt, auch durch Verlassen der Ansicht.
- Sitzungen, die beim nächsten App-Start noch `active` sind, werden auf `interrupted` gesetzt, bevor eine neue Sitzung beginnen kann. `endedAt` bleibt dabei leer, weil der Zeitpunkt des Abbruchs unbekannt ist.
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

- Die Bibliothek zeigt Sets gruppiert nach Lernsprache (Anzeige über `Intl.DisplayNames`), innerhalb der Gruppe nach Lernstufe und Titel sortiert. Gruppiert wird nach dem kanonischen Code; Varianten wie `en-GB` bilden eine eigene Gruppe. Sortiert wird deutsch und mit Zahlen der Größe nach („Klasse 5“ vor „Klasse 10“); Sets ohne Lernstufe stehen am Ende der Gruppe.
- Jede Zeile zeigt Titel (Link zur Set-Ansicht), Lernstufe und Zahl der Einträge sowie „Lernen“ als Abkürzung.
- **Set-Ansicht** (`#/set/<id>`): Titel, Sprachpaar, Zahl der Einträge, vorhandene optionale Angaben (Lernstufe, Lehrwerk mit Ausgabe, Herkunft, Lizenz, Notiz, Prüfstatus), „Lernen“, darunter die Sektionen als aufklappbare Abschnitte (anfangs zugeklappt) mit Titel und Zahl der Einträge. Ein Eintrag zeigt Wort und Bedeutungen mit Varianten („auch: …“), „ungeprüft“ als umrandeten Text, Grammatik, Beispiele und Notiz. Am Ende „Set löschen“ (10).
- **Leere Bibliothek:**
  - kurzer Satz, was die App kann,
  - primäre Aktion „Erstes Vokabelset importieren“,
  - sekundär „Beispielset ausprobieren“ (ab S-16) und „Leeres Set anlegen“ (ab S-31),
  - Link „Wie bekomme ich ein Vokabelset?“ zur Hilfe.
  Die Aktionen unter der Liste („Vokabelset importieren“, Hilfe) entfallen dann, weil der Empty State sie schon anbietet.
- Der Empty State ergibt sich aus dem Datenbestand, erscheint also auch nach dem Löschen des letzten Sets.
- **Hilfe „Wie bekomme ich ein Vokabelset?“** (`#/help`, FR-20, D-26), erreichbar aus dem Empty State, unter der Liste und aus dem Import:
  - drei Schritte: Vokabelliste fotografieren, Vorlage mit den Fotos in einen KI-Chat geben, Antwort unter „Vokabelset importieren“ einfügen;
  - die Vorlage aus Formatspezifikation 11.1 mit eingesetzter Adresse der veröffentlichten Spezifikation (`formatspezifikation.md` relativ zur App) und „Vorlage kopieren“; scheitert das Kopieren, ist die Vorlage markiert und ein Hinweis erklärt, sie selbst zu kopieren;
  - „Formatbeschreibung teilen“ für Chats, die den Link nicht öffnen: Die Spezifikation wird beim Öffnen der Ansicht geladen (offline aus dem Cache) und über das Teilen-Menü bzw. als Download übergeben, als `Formatbeschreibung-Vokabeltrainer.txt` (Chromium teilt keine `.md`-Dateien);
  - aufklappbar das Formatbeispiel aus Kapitel 1 der Spezifikation.
  Beispiel und Vorlage stehen in `src/content/help.ts`; ein Test hält sie gleich mit der Spezifikation. Die Korrekturvorlage (11.2) erscheint mit dem Set-Export (S-32).
- Hinweise zu Speicherschutz, Backup und neuer Version erscheinen als ruhige Hinweise oberhalb der Liste, nie als blockierender Dialog.

### 13.2 Beispielset (FR-32)

- Datei `src/content/beispielset.json` im Format der Formatspezifikation, als Text eingebettet (`?raw`).
- Inhalt: eigene Auswahl aus allgemeinem Grundwortschatz Englisch–Deutsch, Niveau etwa Klasse 6, 3–5 thematische Sektionen mit je 10–20 Einträgen. Enthält Varianten, mehrere Bedeutungen, Grammatik und Beispiele.
- `source: "Eigene Zusammenstellung"`, `license: "CC0"`.
- Ohne IDs und `rev`, wie ein neu erstelltes Set; die App vergibt die IDs beim Laden. Zweimal geladen ergibt es also zwei Sets.
- Wird über den normalen Importweg geladen (keine Sonderlogik): „Beispielset ausprobieren“ im Empty State (13.1) führt `previewImport` und `saveImport` ohne angezeigte Vorschau aus (`app/sampleSet.ts`) und öffnet danach die Set-Ansicht mit „Lernen“. Duplikate werden nicht gefragt, weil der Knopf nur bei leerer Bibliothek erscheint.
- Dient zugleich als Testfixture: `tests/format/setfile.test.ts` prüft Gültigkeit ohne Warnungen und die Vorgaben aus FR-32 (15.3).
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
- `library.ts`: Gruppierung nach Lernsprache, Sortierung nach Lernstufe (numerisch, ohne Lernstufe zuletzt) und Titel, Umfang eines Sets;
- `practice.ts`: Warteschlange, Wiedereinfügen, `firstAttempt`, Multiple-Choice-Auswahl und Rückfall auf Karteikarte;
- `stats.ts`: Kennzahlen, gelöschte Einträge, verschobene Einträge;
- `migrations/`: jede Migration mit Fixture vorher und nachher.

UI-Code wird nicht testgetrieben entwickelt, sondern über E2E-Smoke-Tests und manuelle Prüfung abgesichert.

### 15.3 Fixtures

```text
tests/fixtures/
├── setfile/v1/valid/                   minimal, mit IDs, Teil-Export, Kurz- und Langform, Varianten, mehrere Bedeutungen, alle optionalen Felder
├── setfile/v1/invalid/                 je ein Fehlerfall pro Regel
├── setfile/v1/invalid-validator-only/  Regeln, die das Schema nicht ausdrücken kann (8.3), z. B. doppelte IDs
├── setfile/v1/llm/                     typische LLM-Ausgaben als Text: Codeblock, Begleittext, Zusatzfelder, "meaning"
├── db/                                 gespeicherte Stände pro DB_VERSION (ab erster Auslieferung)
├── backup/                             Backups pro dataVersion
└── perf/                               3.000 Einträge; 50.000 Events
```

Das Beispielset (13.2) ist zugleich gültiges Fixture; es liegt in `src/content/`, und ein eigener Abschnitt des Schemaabgleichs prüft es ohne Warnungen sowie Sprachen, Herkunft, Lizenz, Umfang und die geforderten Formatmöglichkeiten (FR-32). Der Schemaabgleich (`tests/format/setfile.test.ts`, Vitest-Projekt `unit`) führt jedes Fixture durch `extractJson` und danach durch Validator und Schema. Für `invalid/` und `invalid-validator-only/` hält er pro Datei die erwartete Meldung fest (genau ein Fehler), für `valid/` und `llm/` die erwarteten Warnungen; ein Fixture ohne Erwartung lässt den Test scheitern. Ein weiterer Test vergleicht die Feldnamen jeder Ebene im Schema mit den Feldtabellen des Validators.

### 15.4 End-to-End-Smoke-Tests

Projekte: `mobile-chromium` (Pixel-Emulation) und `mobile-webkit` (iPhone-Emulation). Getestet wird immer das gebaute Artefakt.

| Test | Meilenstein | Prüft |
|---|---|---|
| E2E-01 Import (Text) → Lernen → Neuladen → Daten da | M0 | AK-01, AK-09 |
| E2E-02 Backup → Daten löschen → Wiederherstellen | M0 | AK-10 |
| E2E-03 Offline-Start nach erstem Laden | M0 | AK-21 |
| E2E-04 Migration: alte DB per Init-Skript anlegen → App öffnen → Daten nutzbar | mit der ersten Erhöhung von `DB_VERSION` nach S-29 (7.4); bis dahin Integrationstests | AK-24 |
| E2E-05 Empty State → Beispielset → Sitzung mit Multiple Choice → Ergebnis (bis „Lernen“ seit S-16 in `sample.spec.ts`; Multiple Choice und Ergebnis mit S-18, S-19) | M1 | AK-08, AK-14, AK-22, AK-23 |
| E2E-06 Import mit Begleittext und Zusatzfeld (Datei) → Warnung sichtbar | M1 | AK-01 |
| E2E-07 Bearbeiten → Neuladen → Änderung da | M3 | AK-03, AK-25 |
| E2E-08 Teil-Export → Datei ändern → Aktualisieren; andere Sektionen unverändert | M4 | AK-04, AK-05 |
| E2E-09 Konflikt: lokal und in Datei geändert → Vorschau zeigt Konflikt | M4 | AK-18 |
| E2E-10 Datensatz mit `<img onerror>` im Text → wird in Bibliothek und Set-Ansicht als Text angezeigt | M1 (seit S-14) | TAK-03, DF-08 |
| E2E-11 Update: neue Version wird gefunden, bleibt auch nach Neuladen wartend, wird erst nach „Jetzt aktualisieren“ aktiv | M0 | NFR-05, TAK-12 (ohne Sitzung) |
| E2E-12 Neuere Datenbankversion aus einem anderen Tab: App gibt die Verbindung frei und bittet ums Neuladen; nach dem Neuladen bleibt die neuere Datenbank unverändert | M0 | 3.4, 7.2, TAK-08 (Teil) |
| E2E-13 Ungültiger Import (kein gültiges JSON, fehlende Pflichtfelder) und bekanntes Set werden mit Meldung abgelehnt; der Bestand bleibt unverändert | M0 | AK-07, 8.2, 9.8 |
| E2E-14 Update während einer Lernsitzung: neue Version wird gefunden, der Hinweis erscheint erst nach dem Ende der Sitzung | M0 | TAK-12 |
| E2E-15 Dieselbe Datei ohne IDs zweimal importieren → Hinweis auf das vorhandene Set; „Abbrechen“ ändert nichts, „Trotzdem …“ legt ein zweites Set an | M1 | AK-19 |
| E2E-16 Empty State → Hilfe → Vorlage mit Link kopieren, Formatbeschreibung teilen; die veröffentlichte Spezifikation ist auch offline und im Browser mit installierter App als Datei erreichbar | M1 | AK-14, FR-20, D-26 |

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

### 15.7 LLM-Tauglichkeit der Formatspezifikation (AK-13, DF-02)

Ziel: Ein LLM soll allein aus der Formatspezifikation und dem Lernmaterial erkennen, was zu tun ist – ohne die Prompt-Vorlagen aus Kapitel 11 der Spezifikation. Geprüft wird manuell mit aktuellen LLM-Apps (z. B. Claude, ChatGPT, Gemini), nicht in der CI (externe Dienste, nicht deterministisch).

- **Neues Set:** Das LLM erhält nur die Formatspezifikation (als Datei oder Link auf das öffentliche Repository), ein oder mehrere Fotos einer **selbst geschriebenen** Vokabelliste und höchstens einen knappen Satz wie „Mach daraus ein Set für meinen Vokabeltrainer.“ Keine Lehrwerksseiten: Das Repository ist öffentlich, und Befunde werden hier zitiert.
- **Korrektur:** Das LLM erhält die Formatspezifikation und ein exportiertes Set mit eingebauten Fehlern, dazu nur „Korrigiere die Fehler.“
- **Bestanden**, wenn die Antwort per Einfügen ohne Fehler importiert wird; das neue Set keine IDs, `rev`, `scope` oder `exportedAt` enthält bzw. die Korrektur sie unverändert lässt; Varianten und Bedeutungen richtig unterschieden sind (Spezifikation 5.3); Unleserliches mit `"reviewStatus": "unchecked"` und Grund in `notes` aufgenommen ist.
- **Folgerung:** Besteht der Test, kann die Hilfe (13.1) statt der langen Vorlagen auf die Spezifikation verweisen, etwa mit einer kurzen Vorlage „Lies diese Spezifikation und …“. Scheitert er, wird die Spezifikation gezielt ergänzt – z. B. um einen Abschnitt „Für LLMs: Was du tun sollst“ ganz am Anfang – und der Test wiederholt.
- **Wiederholen** nach inhaltlichen Änderungen an der Spezifikation; ein Vortest mit Unteragenten des Coding-Agents (Spezifikation per Link oder Anhang, abgetippte Liste statt Foto) ist schnell und billig, ersetzt aber den Test mit LLM-Apps und Fotos nicht. Gelungene Antworten werden LLM-Fixtures (15.3).

Ergebnisse (LLM-App, Modell, Datum, Befund) werden im Umsetzungsplan bei S-15 festgehalten. Bestanden am 21. Oktober 2026; die Hilfe verweist seitdem mit einer Kurzvorlage auf die Spezifikation.

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
| TAK-08 | Jeder frühere DB- und Backup-Stand wird auf den aktuellen migriert; eine fehlschlagende Migration lässt den alten Stand unverändert und bietet das Notfall-Backup an. | Integrationstest, E2E-04 (ab `DB_VERSION` 2) |
| TAK-09 | Backup → Wiederherstellen ergibt denselben Bestand (tiefer Vergleich aller Stores außer `meta`). | Integrationstest, E2E-02 |
| TAK-10 | Validator und JSON Schema urteilen bei allen Fixtures gleich; ausgenommen sind die Fixtures in `invalid-validator-only/` mit Regeln, die das Schema nicht ausdrücken kann (8.3): Dort akzeptiert das Schema, der Validator lehnt ab. | Schemaabgleich |
| TAK-11 | Die App startet nach dem ersten Laden offline vollständig. | E2E-03 |
| TAK-12 | Eine neue App-Version wird während einer Sitzung oder Bearbeitung nicht aktiviert. | E2E-11, E2E-14 (Sitzung), manuell |
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
| D-17 | Dateiauslieferung über Teilen-Menü auf Mobilgeräten, sonst Download (bestätigt in S-11) | 11.2 | T-22 |
| D-18 | Multiple-Choice-Kandidaten aus demselben Set und derselben Sprachseite, ohne Überschneidung mit akzeptierten Antworten | 12.3 | FR-09 |
| D-19 | Hosting auf GitHub Pages per Actions, eigene Domain vor erster Auslieferung | 4.4 | F-02, bestätigt am 19. Oktober 2026 |
| D-20 | Browserziel `baseline-widely-available` (bestätigt in S-11) | 4.3 | – |
| D-21 | Deployment nur vom Branch `production`, der ausschließlich per Fast-Forward aus `main` nachgezogen wird | 4.4, 4.5 | Nutzerentscheidung in S-04, 20. Oktober 2026 |
| D-22 | App-Icons aus einer SVG-Vorlage; PNGs per Playwright-Skript erzeugt und eingecheckt; Cache-Version über alle vorab gespeicherten Dateien | 4.1, 4.2, 5.1 | Nutzerentscheidung in S-05, 20. Oktober 2026 |
| D-23 | Fundstelle bei ungültigem JSON über einen eigenen Syntaxprüfer statt aus der Fehlermeldung des Browsers (Safari nennt keine Position) | 8.2 | Nutzerentscheidung in S-07, 20. Oktober 2026 |
| D-24 | Leere optionale Felder einer Set-Datei werden beim Import stillschweigend entfernt; leere Pflichttexte und leere Listenelemente bleiben Fehler | 8.4, Formatspez. 5.5 | Nutzerentscheidung in S-12, 21. Oktober 2026 |
| D-25 | Ein Set wird samt seinen Sitzungen und Review-Events in einer Transaktion gelöscht; die Ankündigung nennt Inhalt und Lernstand | 10, 11.4 | Nutzerentscheidung in S-14, 21. Oktober 2026 |
| D-26 | Formatspezifikation und Schema werden unverändert neben der App veröffentlicht und vorab gespeichert; die Hilfe gibt KI-Chats eine Kurzvorlage mit Link darauf, das Teilen als Datei ist der Ausweichweg | 4.2, 5.2, 13.1, Formatspez. 11 | Nutzerentscheidung in S-15, 21. Oktober 2026 |

---

## 18. Offene Punkte und Risiken

| ID | Thema | Umgang |
|---|---|---|
| O-01 | Hosting endgültig (D-19) | Entschieden am 19. Oktober 2026: GitHub Pages |
| O-02 | Verhalten von `persist()` und der 7-Tage-Regel in Safari, Browser vs. installierte App (R-01) | Gemessen am 21. Oktober 2026 (S-11): im Safari-Tab nicht gewährt, als Home-Bildschirm-App gewährt (6.6). Die 7-Tage-Regel wurde bewusst nicht gemessen; sie betrifft vermutlich nur den Tab, dagegen hilft die Empfehlung „Zum Home-Bildschirm“. |
| O-03 | Dateiauslieferung auf iOS in der installierten App (D-17, T-22) | Geprüft am 21. Oktober 2026 (S-11): Teilen-Menü auf iPhone und iPad, Download auf Android (11.2) |
| O-04 | Mindestversionen der Zielbrowser (D-20) | Geprüft am 21. Oktober 2026 (S-11) mit iOS 27, iPadOS 26 und Android 16; ältere Versionen ungeprüft (4.3) |
| O-05 | Bewertung inhaltlicher Änderungen für den Lernstand (R-04) | Daten über `entryRev` vorbereitet; Entscheidung mit späterer Didaktik |
| O-06 | Wachstum der Review-Events über Jahre | Messung TAK-15; bei Bedarf Cache oder Archivierung mit Backup-Konzept |
| O-07 | Schwellenwert der Duplikaterkennung (0,8) | Mit Beispielsets und echten Daten in M1 prüfen |
| O-08 | iOS graut im Dateiwähler Dateien aus, deren Typ nicht zu `accept` passt; ob `.json` mit `accept=".json,application/json,text/plain"` wählbar ist, ist nicht belegt (Quellen 26, 27) | Geprüft am 21. Oktober 2026 (S-11): auf iPhone und iPad wählbar, `accept` bleibt |
| O-09 | Reicht die Formatspezifikation allein, damit ein LLM aus Fotos oder einer Wortliste ein gültiges Set erzeugt oder ein exportiertes Set korrigiert (AK-13)? | Geklärt am 21. Oktober 2026 (S-15): ja für neue Sets (Nutzertest mit Foto und Link, Vortest mit drei Modellen) und für die Korrektur im Vortest; Vorlagen auf einen Link verkürzt. Korrektur mit LLM-Apps und echtem Export prüfen, sobald es den Set-Export gibt (S-32) |

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
25. WebKit Bug 158033 (Fehlermeldung von `JSON.parse` in JavaScriptCore ohne Position) und MDN – JSON.parse: bad parsing (Meldungen mit Zeile und Spalte in Firefox): https://bugs.webkit.org/show_bug.cgi?id=158033, https://developer.mozilla.org/docs/Web/JavaScript/Reference/Errors/JSON_bad_parse
26. WebKit Bug 229456 (ausgegraute Dateien im iOS-Dateiwähler): https://bugs.webkit.org/show_bug.cgi?id=229456
27. Ionic Forum – `accept` unter iOS: https://forum.ionicframework.com/t/input-type-file-ignores-accept-attribute-ios/109392

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
| 2.7 | 20. Oktober 2026 | Minimaler Import (S-07): `importSet.ts` (3.1); Zufallsquelle für IDs wird übergeben, Ablehnungsverfahren (6.3); Fundstelle bei ungültigem JSON über eigenen Syntaxprüfer, gezählt im eingefügten Text (8.2, D-23); E2E-13 (15.4); O-08 (`accept` im iOS-Dateiwähler); Quellen 25–27 | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.8 | 20. Oktober 2026 | Minimale Lernsitzung (S-08): Router meldet das Verlassen einer Ansicht (3.3); Kodierung von `rev` präzisiert – Basis 31 statt „Base32“, niederwertigste Stellen, leere Objekte, rund 39,6 Bit (6.4); Ende einer Sitzung beim Verlassen, `interrupted` ohne `endedAt` (12.5); E2E-14 (15.4, 16) | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.9 | 20. Oktober 2026 | LLM-Tauglichkeit der Formatspezifikation ohne Prompt-Vorlage als manueller Test (15.7) und offener Punkt O-09, Anschluss an S-15 | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.10 | 20. Oktober 2026 | Backup und Wiederherstellung (S-09): `backup.ts` und `validateRecords.ts` (3.1); Rückgabewert von `deliverFile`, Rückfall auf Download, Inhalt vor der Geste fertig (11.2); Backup beim Öffnen der Ansicht lesen, `lastBackupAt` = `exportedAt` (11.3); Prüfregeln, Größengrenze, M0-Bestätigung, `lastBackupAt` in derselben Transaktion (11.4) | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.11 | 21. Oktober 2026 | E2E-Tests in der CI (S-10): E2E-04 auf die erste Erhöhung von `DB_VERSION` verschoben, weil es vorher gegen das gebaute Artefakt keine ältere Datenbank gibt; bis dahin prüfen die Integrationstests den Migrationsmechanismus (7.4, 15.4, 16) | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.12 | 21. Oktober 2026 | Vollständige Validierung (S-12): Feldtabellen pro Ebene, gebündelte Warnungen für unbekannte Felder, Zählweise der Textlängen, `null` nur bei optionalen Inhaltsfeldern, Teil-Export-Prüfung im Importablauf statt im Validator, Grenzen des JSON Schemas (8.3); leere optionale Felder ohne Warnung entfernen (8.4, D-24); Ajv 8 (4.1); Fixture-Verzeichnis `invalid-validator-only/` und Schemaabgleich (15.3, TAK-10) | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.13 | 21. Oktober 2026 | Importvorschau und Duplikaterkennung (S-13): Zwischenablage prüft sofort (8.1); bekannte Set-ID vor der Vorschau abgelehnt, Sprachpaar in gleicher Richtung, Titelvergleich ohne Groß-/Kleinschreibung, Inhalt der Vorschau, Ziel nach dem Speichern (9.2); E2E-15 (15.4) | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.14 | 21. Oktober 2026 | Ergebnisse der Gerätechecks (S-11): `persist()` in Safari und Chrome (6.6), Teilen-Menü auf iOS und iPadOS, Download auf Android (11.2), geprüfte Versionen (4.3); D-17 und D-20 bestätigt; O-02, O-03, O-04 und O-08 abgeschlossen | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.15 | 21. Oktober 2026 | Bibliothek, Set-Ansicht und Löschen (S-14): Routen mit Parameter (3.2), Set löschen samt Sitzungen und Events (10, D-25), Sortierung und Set-Ansicht (13.1), `library.ts` (3.1, 15.2), E2E-10 vorgezogen (15.4) | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.16 | 21. Oktober 2026 | Empty State und Hilfe (S-15): Formatspezifikation und Schema neben der App veröffentlicht und vorab gespeichert (4.2, 5.2, D-26), Navigation zu vorab gespeicherten Dateien liefert die Datei (5.2), Hilfe mit Kurzvorlage, Teilen der Spezifikation und Formatbeispiel (13.1), `content/` (3.1), E2E-16 (15.4), LLM-Test bestanden und Vortest mit Unteragenten (15.7, O-09) | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
| 2.17 | 22. Oktober 2026 | Beispielset (S-16): ohne IDs, Laden über den normalen Importweg und danach Set-Ansicht (13.2), Strukturtest als Fixture (15.3), Teil von E2E-05 (15.4) | Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |

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
  Erledigt am 20. Oktober 2026. Manifest und Icons liegen in `public/`, die PNGs entstehen per `npm run icons` aus der SVG-Vorlage (D-22). Der Service Worker ist ein eigener Vite-Build (IIFE, unter 1 kB); seine Cache-Version ist ein Hash über alle vorab gespeicherten Dateien. Die Build-Prüfung führt `sw.js` in einer Attrappe aus. E2E-03 (Offline-Start) und E2E-11 (Update erst nach Bestätigung) laufen in mobile-chromium und mobile-webkit. E2E-11 startet einen eigenen `vite preview` auf einer Kopie von `dist/` (Ports ab 4280; 4190 sperrt WebKit als „bad port“), weil Chromium die Update-Prüfung des Service Workers nicht über `page.route` leitet. Gegenproben: `skipWaiting()` beim Installieren lässt E2E-11 scheitern, ein geändertes Icon ohne neuen `sw.js` die Build-Prüfung. Mit `playwright-cli` (mobiles Chromium) geprüft: Manifest fehlerfrei erkannt (einziger Installationshinderungsgrund ist das Inkognito-Profil); Hinweisleiste hell und dunkel bei 320 px ohne horizontales Scrollen; nach „Jetzt aktualisieren“ besteht nur noch der neue Cache, die Konsole bleibt leer; im Dev-Server wird kein Service Worker registriert. Der `favicon.ico`-Fehler aus S-02 und S-04 ist behoben; der Smoke-Test meldet jetzt auch fehlgeschlagene Anfragen. TAK-12 ist vorbereitet (`setUpdateBlocked()`); angeschlossen und geprüft wird es mit S-08. Am 20. Oktober 2026 deployt; ausgelieferte Dateien bytegleich mit dem lokalen Build, live mit `playwright-cli` offline gestartet. Hinzufügen zum Home-Bildschirm auf Android und iPhone bestätigt, auf dem iPhone auch Name, Icon und Offline-Start im Flugmodus (S-11).
- ✅ **S-06** IndexedDB-Grundgerüst (inkl. `fake-indexeddb` für die Integrationstests): Öffnen, Upgrade, Migrationskette mit Test-Migration v1 → v2, `versionchange`/`VersionError`, Notfall-Backup, `persist()` mit Anzeige des Ergebnisses (6, 7) – FR-22, FR-33, TAK-05, TAK-08  
  Erledigt am 20. Oktober 2026 mit `fake-indexeddb` 6.2. Erstes Modul in `domain/` (Migrationskette, Backup-Hülle); `tsconfig.domain.json` ohne DOM- und Node-Typen, Gegenprobe: `document` in `domain/` lässt `npm run typecheck` scheitern (TAK-04). `openDatabase` liefert ein Ergebnis pro Lage (geöffnet, kein Speicher, neuere Version, Einrichtung gescheitert, Migration gescheitert mit Notfall-Backup); geschrieben wird nur über `runTransaction`, das erst nach `complete` erfüllt (TAK-05). Integrationstests decken Einrichtung, Migration v1 → v2, fehlschlagende Migration mit unverändertem Altstand (TAK-08), fehlende Kettenglieder, `VersionError`, `versionchange` und `blocked` ab. Gegenprobe: Ohne ausdrückliches `abort()` übernimmt `fake-indexeddb` die halbe Migration; deshalb bricht die App selbst ab (7.2). E2E-12 läuft in mobile-chromium und mobile-webkit. Die App-Version (`0.1.0+<Commit>`) wird per `define` eingebettet und steht im Notfall-Backup. Datei-Auslieferung vorerst nur als Download; das Teilen-Menü folgt mit S-09.  
  Provisorisch für M0: Die Bibliothek zeigt den Speicherschutz und eine Schaltfläche „Dauerhaften Speicher anfordern“ für die Messung in S-11; der automatische Aufruf nach dem ersten gespeicherten Set (6.6) kommt mit S-07, die Schaltfläche entfällt spätestens mit S-26. Der Dev-Schalter `?testmigration=ok|fail` (nur `npm run dev`, nicht im Build) führt die Test-Migration auf einer eigenen Datenbank `vokabeltrainer-testmigration` aus. Mit `playwright-cli` (mobiles Chromium) geprüft: `fail` zeigt „Daten nicht übernommen“, das heruntergeladene Notfall-Backup enthält den unveränderten Datensatz mit `dataVersion` 1; `ok` hebt die Testdatenbank auf Version 2 mit umbenanntem Feld und neuem Index; Chromium lehnt `persist()` für die frisch besuchte Seite ab, die Anfrage wird in `meta` vermerkt; Konsole ohne Fehler. Offen für S-10: E2E-04 braucht gegen das gebaute Artefakt einen Weg zu einer älteren Datenbank, solange `DB_VERSION` 1 ist.
- ✅ **S-07** Minimaler Import: Textfeld und Datei, `extract.ts`, Grundvalidierung, Speichern als neues Set ohne Vorschau – FR-13 (Teil)  
  Erledigt am 20. Oktober 2026. Domain testgetrieben: `extract.ts` vollständig nach 8.2 mit eigenem Syntaxprüfer für die Fundstelle (D-23); `validate.ts` prüft Format und Formatversion (fehlend → Warnung, neuer → Ablehnung, Backup erkannt), Pflichtfelder, Antworten in Kurz- und Langform samt Varianten, `meaning` (Einzahl, Warnung), Sprachcodes, IDs (Muster, doppelte), Teil-Export (abgelehnt) und Mengengrenzen; `normalize.ts` baut die Langform, trimmt, NFC, kanonisiert Sprachcodes; `ids.ts` mit übergebener Zufallsquelle; `importSet.ts` verbindet alles. `storage/sets.ts` speichert mit `add()`, ein Set mit bekannter ID wird abgelehnt statt überschrieben (Nutzerentscheidung). Nach dem ersten gespeicherten Set fragt die App einmal nach dauerhaftem Speicher (6.6). Die Bibliothek zeigt die Sets als einfache Liste mit Zahl der Einträge und einen Link zum Import. Bewusst noch nicht enthalten: optionale Felder (Nutzerentscheidung, siehe S-12), Vorschau und Duplikate (S-13), Zwischenablage (S-13). Gegenproben: `put()` statt `add()`, Fundstelle ohne Versatz der Extraktion, NFC und Kollisionsprüfung entfernt – jeweils scheitert der passende Test. Import per Text (mit Begleittext und Codeblock) und Datei sowie E2E-13 laufen in mobile-chromium und mobile-webkit; dort stammt die Fundstelle aus dem eigenen Prüfer. Mit `playwright-cli` (mobiles Chromium, 320 px) geprüft: kein horizontales Scrollen auch bei langem Titel ohne Umbruch, hell und dunkel lesbar, Fehlerbox mit Rahmen statt nur Farbe, Erfolgsmeldung samt Warnung im Live-Bereich, `persistRequested` nach dem Speichern in `meta`, Konsole leer.
- ✅ **S-08** Minimale Lernsitzung: ganzes Set, nur Karteikarten, Review-Events und Sitzung werden gespeichert – FR-11 (Teil)  
  Erledigt am 20. Oktober 2026. Domain testgetrieben: `hash.ts` (cyrb53 gegen die Referenzwerte, kanonische Darstellung, `entryRev` mit eingefrorenem Referenzwert; Kurz- und Langform ergeben denselben Wert) und `practice.ts` (Mischen mit übergebenem Zufall, Wiedereinfügen an Position 4 bzw. am Ende, Erstversuch pro Eintrag, Anzeige mehrerer Bedeutungen; `mixed` schon enthalten). TDD 6.4 sprach von Base32, das Alphabet aus 6.3 hat aber 31 Zeichen; `rev` nutzt jetzt die Basis 31 (6.4 präzisiert). `storage/sessions.ts` mit Integrationstests: Sitzung anlegen und abschließen, jede Antwort in eigener Transaktion, aktive Sitzungen beim Start auf `interrupted`. Die Bibliothek bietet pro Set „Lernen“; die Sitzung umfasst alle Einträge in Richtung `termToMeaning`, Aufdecken per Tippen auf die Karte, Bewerten mit „Nochmal“/„Gewusst“; die nächste Karte erscheint erst nach dem Speichern, ein Speicherfehler zeigt einen Hinweis, die Sitzung läuft weiter. Abschluss mit Erstversuchsquote. „Beenden“, Zurück-Taste und jedes Verlassen beenden die Sitzung als `ended` (Router-Signal, 3.3); während der Sitzung ist der Update-Hinweis zurückgehalten (TAK-12). E2E-01 (Import → Lernen → Neuladen, Events mit `entryRev`), Beenden, Neuladen (`interrupted`) und E2E-14 laufen in mobile-chromium und mobile-webkit. Gegenproben: Wiedereinfügen am Ende, vertauschte Stellenreihenfolge in `rev`, fehlendes `setUpdateBlocked(true)` und fehlendes Unterbrechen beim Start lassen jeweils den passenden Test scheitern. Mit `playwright-cli` (mobiles Chromium, 320 px) geprüft: kein horizontales Scrollen auch bei langem Titel, hell und dunkel lesbar, `lang` an Frage und Antwort, Fokus nach dem Start auf der Karte, nach dem Aufdecken auf der Antwort (nicht auf einer Schaltfläche, damit ein gehaltenes Enter nicht gleich bewertet), danach auf der nächsten Karte und am Ende auf „Geschafft“; gescheiterter Start und gescheiterte Antwort zeigen ihren Hinweis; Konsole sonst leer. Tastatur (Pfeile) und Wischen folgen mit S-18, Zwischenstand und „Nur Fehler üben“ mit S-19.
- ✅ **S-09** Backup-Export (Teilen-Menü bzw. Download, Spike D-17) und Wiederherstellung (ersetzt alles) inkl. `lastBackupAt` – FR-19 (Teil), TAK-09  
  Erledigt am 20. Oktober 2026. Domain testgetrieben: `validateRecords.ts` (Pflichtangaben und Typen pro Store, eindeutige Schlüssel, eindeutige Sektions- und Eintrags-IDs pro Set, Verweise von Sitzungen und Events, `entryId` bewusst ungeprüft, Meldungen ohne Inhalte) und `parseBackup` in `backup.ts` (Hülle, Vokabelset erkannt, neuere Version abgelehnt, Migration über die Kette, scheiternde Migration als Meldung). `storage/backup.ts` mit Integrationstests: Lesen in einer Transaktion (auch für das Notfall-Backup), Ersetzen samt `lastBackupAt` in einer Transaktion; Hin und zurück ergibt denselben Bestand (TAK-09), ein doppelter Schlüssel lässt alles unverändert (TAK-05). `deliverFile` mit Teilen-Menü (11.2). Ansicht `#/backup` mit Link in der Bibliothek; Wiederherstellen nur per Datei mit knapper Bestätigung (Nutzerentscheidung, 11.4). E2E-02 (frischer Browserkontext als neues Gerät), Teilen-Menü, Abbrechen im Teilen-Menü und Ablehnung eines Vokabelsets laufen in mobile-chromium und mobile-webkit; das Teilen-Menü wird dort per Init-Skript ersetzt oder entfernt. Gegenproben: ohne `clear()`, `lastBackupAt` vor der Transaktion, `AbortError` als Erfolg – jeweils scheitert der passende Test. Mit `playwright-cli` (mobiles Chromium, 320 px) geprüft: kein horizontales Scrollen, hell und dunkel lesbar, Fokus auf dem Umfang und danach auf „Backup wiederhergestellt.“, Dateiname `Vokabeltrainer-Backup_2026-10-20.json`. Dort meldet `canShare` Erfolg, `share()` scheitert aber mit `NotAllowedError`; der Rückfall auf den Download greift. Der Gerätecheck (Teilen-Menü auf iPhone im Tab und als Home-Bildschirm-App, Android, Wiederherstellen aus „Dateien“) folgt mit S-11 und bestätigt oder ändert D-17.
- ✅ **S-10** E2E-01 bis E2E-04 in der CI (E2E-03 besteht seit S-05, E2E-01 seit S-08)  
  Erledigt am 21. Oktober 2026. E2E-01 (`practice.spec.ts`), E2E-02 (`backup.spec.ts`) und E2E-03 (`offline.spec.ts`) laufen in der CI in mobile-chromium und mobile-webkit; im Lauf 39652042870 auf `main` (Stand S-09) waren alle 32 E2E-Tests in rund 1,5 Minuten grün. `ci.yml` blieb unverändert. E2E-04 ist auf Nutzerentscheidung bis zur ersten Erhöhung von `DB_VERSION` verschoben (7.4, 15.4): Solange `DB_VERSION` 1 ist, gibt es gegen das gebaute Artefakt keine ältere Datenbank. Ein eigener Testbuild mit Version 2 wurde erwogen und verworfen, weil er nur nachbildet, was die Integrationstests schon zeigen (Migration v1 → v2, scheiternde Migration mit unverändertem Altstand und Notfall-Backup, Backup über die Kette). S-29 friert Version 1 erst ein; E2E-04 entsteht mit der ersten echten Migration danach.
- ✅ **S-11** Manuelle Prüfung auf echtem iPhone und Android (15.5); Ergebnisse zu O-02, O-03, O-04, O-08 hier festhalten  
  Erledigt am 21. Oktober 2026. Erste Prüfung am 20. Oktober 2026 mit dem Stand von S-06 unter https://cgrothaus.github.io/vokabeltrainer/:
  - Android (Chrome): Hinzufügen zum Startbildschirm funktioniert; `persist()` wird schon im Browser gewährt.
  - iPhone 17 mit aktuellem iOS (Stand 20. Oktober 2026), Safari: Hinzufügen zum Home-Bildschirm funktioniert, Name „Vokabeln“ und Icon stimmen, die App startet vom Home-Bildschirm im Flugmodus (AK-21). Im Safari-Tab gewährt `persist()` nichts, die Schaltfläche wirkt wirkungslos, weil der Hinweis unverändert bleibt. Als Home-Bildschirm-App wird `persist()` gewährt (O-02, R-01). Die Empfehlung „Teilen → Zum Home-Bildschirm“ aus 6.6 ist damit auf iOS der entscheidende Schutz; für S-26: Eine abgelehnte Anfrage braucht eine sichtbare Rückmeldung mit dieser Empfehlung.
  Abschließende Prüfung am 21. Oktober 2026 mit dem Stand von S-09 auf Samsung Galaxy A34 (Android 16, One UI 8.5, Chrome), iPhone 17 (iOS 27, Safari-Tab und Home-Bildschirm-App) und iPad Air 13" M2 (iPadOS 26). Der Nutzer hat summarisch „ok“ gemeldet und nur Rückfragen beantwortet, die eine Entscheidung ändern; Einzelergebnisse pro Punkt aus 15.5 liegen deshalb nicht vor.
  - Ohne Befund auf allen drei Geräten: Home-Bildschirm und Offline-Start, Update-Hinweis, Import per Einfügen und per Datei, Lernen, Backup speichern und wiederherstellen (O-04, D-20).
  - Android: „Backup speichern“ in der Home-Bildschirm-App öffnet Chromes Dialog „Datei herunterladen?“ mit Dateiname und Zielordner, kein Teilen-Menü (O-03, D-17, 11.2). Ein Abbruch dort ist für die App nicht erkennbar und zählt nach 11.4 als Backup.
  - iPhone und iPad: Die `.json`-Datei ist im Dateiwähler wählbar, `accept` bleibt (O-08).
  - 7-Tage-Regel in Safari bewusst nicht gemessen (Nutzerentscheidung, O-02).

### M1 – Lernen mit eigenen Sets

- ✅ **S-12** Vollständige Validierung und Normalisierung nach Formatspezifikation, testgetrieben, mit Fixtures; JSON Schema `vokabeltrainer-set.schema.json` und Schemaabgleich – DF-01–DF-08, TAK-10  
  Erledigt am 21. Oktober 2026 mit Ajv 8.20. `validate.ts` prüft alle optionalen Felder (Set: `level`, `textbook`, `edition`, `source`, `license`, `notes`, `reviewStatus`; Eintrag: `notes`, `examples`, `grammar`, `reviewStatus`), Textlängen in Codepoints nach Trimmen und NFC, `null` nur bei optionalen Feldern, `rev` und `exportedAt`, die Form von `scope`. Bekannte Felder stehen pro Ebene in `KNOWN_FIELDS`; unbekannte werden gebündelt gemeldet („… und 11 weitere Stellen“). `normalize.ts` übernimmt die optionalen Felder, Beispiele in Langform, und entfernt leere optionale Felder ohne Warnung (Nutzerentscheidung, D-24); leere Listenelemente bleiben Fehler, weil z. B. eine leere Wortform die Stellung der übrigen verschieben würde. Die Ablehnung eines Teil-Exports als neues Set liegt jetzt in `prepareNewSet`, damit das gültige Fixture „Teil-Export“ bei Validator und Schema gleich ausfällt. Spezifikation präzisiert (5.5, 6, 7, 8.1, 8.2, 8.4 mit Grenzen für alle Texte), Formatversion bleibt 1. Schema unter `docs/vokabeltrainer-set.schema.json` (Draft 2020-12, ohne `$id` bis S-29); 53 Fixtures (9 gültig, 6 LLM-Ausgaben als Text, 35 ungültig mit genau einer Meldung, 3 nur für den Validator) in `tests/format/setfile.test.ts` abgeglichen, dazu ein Test, dass Schema und `KNOWN_FIELDS` dieselben Felder kennen. Ajv läuft mit `strict`, nur `strictRequired` ist aus (es meldet `required` in `anyOf`/`if` fälschlich). Gegenproben: Titelgrenze im Schema auf 300, `level` aus der Validator-Tabelle entfernt, leere Notiz nicht entfernt, Teil-Export-Prüfung entfernt – jeweils scheitern die passenden Tests. E2E-06 (Datei mit Begleittext und Zusatzfeld → Warnung sichtbar, optionale Felder im Store) läuft in mobile-chromium und mobile-webkit. Mit `playwright-cli` (mobiles Chromium, 320 px, hell und dunkel) geprüft: Lange Wörter in Warnungen ließen die Seite horizontal scrollen (420 px); Live-Bereiche brechen jetzt wie die Fehlerbox um (`overflow-wrap: anywhere`), danach 320 px, Konsole leer. Angezeigt werden die optionalen Felder noch nicht (Nutzerentscheidung, siehe S-14 und S-18).
- ✅ **S-13** Importvorschau für neue Sets mit Warnungen; Duplikaterkennung – FR-16, FR-30, AK-19  
  Dazu die Schaltfläche „Aus Zwischenablage einfügen“ (8.1), in S-07 bewusst weggelassen.  
  Erledigt am 21. Oktober 2026. Domain testgetrieben: `duplicates.ts` (Schwelle 0,8 ganzzahlig verglichen, Bezug auf das kleinere Set, Sprachpaar in gleicher Richtung, Titel und Einträge ohne Groß-/Kleinschreibung und in NFC, nur erste Bedeutung, Mengen statt Einträgen, leeres Set nur über den Titel, Ausgabe in der Meldung, Sortierung). Der Import läuft in zwei Schritten (`previewImport`, `saveImport` in `app/importText.ts`): „Prüfen“ zeigt die Vorschau und schreibt nichts, „Importieren“ bzw. „Trotzdem als neues Set importieren“ speichert und wechselt zur Bibliothek mit Meldung. Nutzerentscheidungen: Zwischenablage prüft sofort, Vorschau mit Sektionsliste, Titelvergleich ohne Groß-/Kleinschreibung, nach dem Speichern zur Bibliothek. Eine bekannte Set-ID wird schon beim Prüfen abgelehnt. `platform/clipboard.ts`; die Schaltfläche fehlt, wenn der Browser die Zwischenablage nicht lesen kann. E2E: Vorschau mit Begleittext, Abbrechen ohne Schreiben, Datei, Zwischenablage (Erfolg, Ablehnung, nicht vorhanden; per Init-Skript ersetzt), E2E-06, E2E-13 und neu E2E-15 (AK-19) in mobile-chromium und mobile-webkit. Gegenproben: `max` statt `min` im Nenner und eine Vorschau ohne Duplikatprüfung lassen jeweils den passenden Test scheitern. Mit `playwright-cli` (mobiles Chromium, 320 px, hell und dunkel) geprüft: kein horizontales Scrollen bei langem Titel und Sektionsnamen ohne Trennstelle, Fokus auf „Vorschau“ und nach dem Speichern auf der Meldung in der Bibliothek, Konsole leer. Dabei aufgefallen: `display: flex` an `summary` entfernt das Dreieck zum Aufklappen; der Duplikathinweis steht jetzt oben in der Vorschau. Offen für S-11: „Aus Zwischenablage einfügen“ auf iPhone (Einfügen-Bestätigung von iOS, auch als Home-Bildschirm-App) und Android.
- ✅ **S-14** Bibliothek gruppiert nach Sprache, Set-Ansicht mit Sektionen, Set löschen – FR-01–FR-03  
  Dazu die optionalen Angaben anzeigen, die seit S-12 gespeichert werden: Set (Lernstufe, Lehrwerk, Herkunft, Lizenz, Notiz, Prüfstatus) und Einträge (Notiz, Beispiele, Grammatik, „ungeprüft“).  
  Erledigt am 21. Oktober 2026. Domain testgetrieben: `library.ts` (Gruppierung nach kanonischem Code der Lernsprache, Gruppen nach deutschem Namen, Lernstufe numerisch und ohne Lernstufe zuletzt, dann Titel; `setSize`). `storage/sets.ts`: `countSetActivity` über die Indizes `setId` und `deleteSet`, das Set, Sitzungen und Events in einer Transaktion löscht; ein unbekanntes Set ändert nichts, danach besteht ein Backup die Prüfung aus 11.4. Nutzerentscheidungen: Lernstand wird mitgelöscht (D-25), Sektionen anfangs zugeklappt, „Lernen“ in Bibliothek und Set-Ansicht (`components/learnButton.ts`). Der Router nimmt einen Pfadparameter an (`/set/`); `#/set/` ohne ID traf zunächst die Präfix-Route als feste Route und öffnete eine leere Set-Ansicht – der E2E-Test fand es, behoben. Die Meldung nach dem Löschen läuft wie beim Import über `takeMessage`. E2E: Gruppierung, Set-Ansicht mit allen Angaben und Aufklappen, Lernen aus der Set-Ansicht, Löschen mit Ankündigung (mit und ohne Lernstand), Abbrechen mit Fokus zurück, leere Bibliothek nach dem letzten Set, unbekannte Set-Adresse und E2E-10 (aus S-23 vorgezogen) in mobile-chromium und mobile-webkit. Gegenproben: Events nicht mitlöschen, Sortierung ohne `numeric`, Strings in `h()` als HTML – jeweils scheitern die passenden Tests. Mit `playwright-cli` (mobiles Chromium, 320 px, hell und dunkel) geprüft: kein horizontales Scrollen in Bibliothek, Set-Ansicht (auf- und zugeklappt) und Ankündigung bei Wörtern ohne Trennstelle, Aufklappen per Tastatur, Fokus auf der Ankündigung, Konsole leer. Nicht umgesetzt: Der Duplikathinweis der Importvorschau verlinkt nicht auf das vorhandene Set, weil der Wechsel die Vorschau verwürfe; nach dem Import bleibt es bei der Bibliothek (Nutzerentscheidung in S-13).
- ✅ **S-15** Empty State, Hilfe mit Formatbeispiel und Prompt-Vorlagen – FR-20, FR-28, AK-14  
  Vorab der LLM-Test nach 15.7 (O-09, AK-13); seit S-12 ist die Spezifikation vollständig umgesetzt, der Test ist also möglich. Sein Ergebnis bestimmt, wie ausführlich die Prompt-Vorlagen sein müssen.  
  Erledigt am 21. Oktober 2026. LLM-Test (15.7):
  - Nutzer: Erste Tests mit Foto und Link auf die Spezifikation positiv, das LLM erkennt ohne weitere Anweisung, was zu tun ist (App und Modell nicht festgehalten).
  - Vortest mit Unteragenten von Claude Code (Modelle Haiku, Sonnet und Opus, jeweils drei Fälle): neues Set mit Spezifikation per Link bzw. als Anhang aus einer abgetippten, selbst erfundenen Liste (16 Einträge mit Varianten, Doppelbedeutungen, Verbformen, Plural und zwei unleserlichen Stellen) sowie Korrektur eines Exports mit eingebauten Fehlern (Tippfehler, falsche Bedeutung, falsche Verbform und Plural, Varianten als zwei Bedeutungen). Alle 9 Antworten importieren ohne Fehler und Warnung. Neue Sets enthalten keine IDs, `rev`, `scope` oder `exportedAt`; Korrekturen lassen sie unverändert und beheben die Fehler. Unleserliches steht immer mit `unchecked` und Grund in `notes`. Schwächen: Sonnet ließ „Mülleimer/Abfalleimer“ als zwei Bedeutungen stehen; drei Antworten schreiben für ein ganz unleserliches Wort Platzhalter wie „???“ als Bedeutung (gültig, auf der Karte unschön). Alle Antworten haben trotz Regel 10.1 Begleittext, den der Import entfernt. Die Läufe per Link lasen die Spezifikation über ein Abrufwerkzeug, das Inhalte zusammenfassen kann. Zwei Antworten sind als LLM-Fixtures übernommen.
  - Folgerung: bestanden. Spez. 11 hat jetzt Kurzvorlagen mit Link statt der langen Vorlagen (D-26).

  Umsetzung: Ein Plugin in `vite.config.ts` gibt Spezifikation und Schema aus `docs/` neben `index.html` aus; der Service Worker speichert sie vorab. Gefunden durch E2E-16: Der Service Worker beantwortete jede Navigation mit der App, ein geöffneter Link auf die Spezifikation zeigte also die App (jetzt die Datei), und `vite preview` liefert `.md` ohne Zeichensatz, sodass Umlaute falsch erschienen (Plugin setzt `charset=utf-8`). Empty State mit Satz zur App, „Erstes Vokabelset importieren“ und Hilfe-Link; die Aktionen unter der Liste erscheinen erst nach dem Laden und nur bei vorhandenen Sets. Hilfe (`#/help`) wie in 13.1; „Formatbeschreibung teilen“ als `.txt`, weil Chromium `.md` nicht teilt. Nutzerentscheidungen: Link bevorzugt, Teilen als Ausweichweg, Veröffentlichung neben der App statt Verweis auf das Repository, Vortest durch Unteragenten. Bewusst noch nicht: „Beispielset ausprobieren“ (S-16), „Leeres Set anlegen“ (S-31), Korrekturvorlage in der App (S-32). E2E-16 und drei weitere Tests (Kopieren scheitert, Datei offline und per Link, Hilfe aus Bibliothek und Import) in mobile-chromium und mobile-webkit. Gegenproben: Build ohne Plugin bricht ab, geänderte Vorlage in der Spezifikation lässt `tests/format/help.test.ts` scheitern, der alte Service Worker lässt den Link-Test scheitern. Mit `playwright-cli` (mobiles Chromium, 320 px, hell und dunkel) geprüft: kein horizontales Scrollen in Empty State, Hilfe (Beispiel aufgeklappt) und Import, Vorlage und Beispiel brechen um, Tab-Reihenfolge in der Hilfe logisch, Konsole leer.  
  Offen für den Gerätecheck: „Vorlage kopieren“ und „Formatbeschreibung teilen“ in eine Chat-App auf iPhone und Android; nach dem Deploy `Content-Type` der Live-Datei (`charset=utf-8`) prüfen.
- ✅ **S-16** Beispielset erstellen (13.2) – FR-32, AK-23  
  Erledigt am 22. Oktober 2026. `src/content/beispielset.json`: „Englisch – Grundwortschatz (Beispielset)“, Klasse 6, eigene Zusammenstellung, CC0, vier thematische Sektionen („In der Schule“ 15, „Freizeit und Sport“ 14, „Essen und Trinken“ 14, „Unterwegs“ 14 Einträge) mit Varianten bei Wort und Bedeutung (britisch/amerikanisch, Synonyme), mehreren Bedeutungen, Verbformen, Plural, Beispielen als Text und mit Übersetzung sowie Notizen; ohne Blick in den Prototyp zusammengestellt. Nutzerentscheidungen: Knopf als eigene Komponente (`components/sampleSetButton.ts`) im Empty State von S-15, direkt speichern ohne Vorschau, ohne IDs. Nach dem Laden öffnet die App die Set-Ansicht, weil ein Hashwechsel auf `#/` die schon gezeigte Bibliothek nicht neu zeichnet; die Anfrage nach dauerhaftem Speicher (6.6) läuft wie nach einem Import. Ablauf: Strukturtest zuerst (rot ohne Datei), dann Inhalt. Eine erste Umsetzung parallel zu S-15 wurde nach dessen Merge verworfen und auf dem neuen Stand neu aufgesetzt (S-15 änderte `vite.config.ts`, den Empty State und denselben Test). E2E: Empty State → Beispielset → Set-Ansicht mit Herkunft, Lizenz und vier Sektionen → Lernen (57 Karten); Knopf fehlt bei vorhandenem Set und erscheint nach dem Löschen des letzten Sets wieder – in mobile-chromium und mobile-webkit. Gegenproben: umbenanntes `plural` und andere Lizenz lassen drei Strukturtests scheitern, fehlender Wechsel zur Set-Ansicht den E2E-Test. Mit `playwright-cli` (mobiles Chromium, 320 px, hell und dunkel) geprüft: kein horizontales Scrollen in Empty State und aufgeklappter Set-Ansicht, Varianten, Bedeutungen, Grammatik, Beispiele und Notizen richtig dargestellt, `persistRequested` nach dem Laden in `meta`, Konsole leer. Wie beim Öffnen über die Liste setzt die Set-Ansicht keinen Fokus (Fokus danach auf `body`); für S-23 vormerken. Aufgefallen: Die Wortart erscheint so, wie sie im Set steht („Wortart: noun“), das Format sieht englische Werte vor.
- 🔲 **S-17** Sitzung einrichten: Auswahl Sektionen, Richtung, Anzahl, Multiple-Choice-Anteil; gemerkte Einstellungen – FR-07, FR-08, FR-21
- 🔲 **S-18** Multiple Choice mit Kandidatenregeln (testgetrieben), Bedienwege Karteikarte – FR-09, AK-22  
  Dazu Notiz, Beispiele und Grammatik eines Eintrags auf der Rückseite der Karteikarte zeigen (seit S-12 gespeichert).
- 🔲 **S-19** Fehlerwiederholung, Zwischenstand, Fortsetzen, Ergebnis, „Nur Fehler üben“ – FR-10, FR-12
- 🔲 **S-20** Lernüberblick aus Events (testgetrieben) – FR-11, AK-17
- 🔲 **S-21** Einstellungen, Hell/Dunkel, App-Version – FR-21, FR-25
- 🔲 **S-22** Speicherfehler und Statusanzeige – FR-23, AK-26
- 🔲 **S-23** Mobile- und Barrierearmut-Durchsicht, E2E-05, E2E-06, E2E-10 – FR-24, FR-27, NFR-09–NFR-13  
  E2E-06 besteht seit S-12, E2E-10 seit S-14.
- 🔲 **S-24** Performance-Messung (15.6) – TAK-15

### M2 – Daten sichern

- 🔲 **S-25** Backup vollständig: Vorschau mit Umfang, Warnung, Angebot eines vorherigen Backups – FR-19, AK-10  
  Baut auf S-09 auf. Ergänzen: Warnung nur bei vorhandenen lokalen Daten, Angebot eines Backups des aktuellen Stands vor dem Ersetzen, Wiederherstellen per eingefügtem Text (11.4).
- 🔲 **S-26** Speicherschutz-Hinweise und iOS-Installationsanleitung – FR-31, AK-20
- 🔲 **S-27** Backup-Erinnerung mit Zurückstellen – FR-31, AK-20
- 🔲 **S-28** Sicherungskopie vor Migrationen (7.3) – FR-33, D-14
- 🔲 **S-29** Erste Auslieferung vorbereiten: eigene Domain, `DB_VERSION` und Formate einfrieren, Fixtures v1 anlegen – FR-33, T-23  
  Das Fixture `tests/fixtures/db/v1.json` ist die Grundlage für E2E-04 bei der ersten Erhöhung von `DB_VERSION` (7.4, S-10).

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
