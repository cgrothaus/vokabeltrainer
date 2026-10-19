# TDD: Allgemeiner, mobiler Vokabeltrainer

**Version:** 1.0 – technischer Entwurf für die nächste Entwicklungsiteration  
**Stand:** 18. Oktober 2026  
**Bezug:** PRD „Allgemeiner, mobiler Vokabeltrainer“, Version 2.1  
**Status:** Architekturvorschlag; vor der Umsetzung anhand der offenen Punkte in Kapitel 15 zu überprüfen  
**KI-Autor:** ChatGPT (OpenAI), Modell **GPT-6**; KI-gestützter Entwurf in iterativer Zusammenarbeit mit dem Nutzer  
**Denkaufwand:** Reasoning-Modell; eine konkrete Stufe (z. B. Medium/High) und eine Modell-Snapshot-ID wurden für diese Erstellung nicht als überprüfbare Metadaten bereitgestellt  
**Knowledge Cutoff:** Dezember 2025 (vortrainiertes Modellwissen); technische Randbedingungen mit späterem Stand wurden zusätzlich recherchiert (siehe Kapitel 16, geprüft am 18. Oktober 2026)  
**Arbeitsgrundlage:** PRD Version 2.1, bestehender HTML-Prototyp, gemeinsamer Anforderungsdialog und die in Kapitel 16 aufgeführte technische Recherche; Autorhinweis ergänzt am 18. Oktober 2026

---

## 1. Zweck und Geltungsbereich

Dieses Dokument übersetzt das PRD in konkrete technische Entscheidungen, Datenstrukturen, Abläufe und Tests. Es ist auf die nächste ausgebaute Version ausgerichtet: die vorhandene einzelne HTML-App wird verallgemeinert und um lokale Datenhaltung, Bearbeitung, Import/Export und dauerhaften Lernfortschritt erweitert.

Das TDD beschreibt **wie** die Produktanforderungen umgesetzt werden sollen. Es ersetzt weder das PRD noch die separate Nutzerdokumentation und die eigenständige Formatspezifikation für Vokabelsets.

### 1.1 Verbindliche Rahmenbedingungen

- Eine eigenständige HTML-Datei mit eingebettetem CSS und JavaScript.
- Keine externen Laufzeitbibliotheken, CDN-Aufrufe, Server-APIs oder Benutzerkonten.
- Lokale Vokabelsets, Präferenzen und Lernhistorie.
- Primäre Bedienung auf Smartphone und Tablet; Desktop bleibt unterstützt.
- Ein gemeinsamer, verständlicher Import-Einstieg für neue und bereits bekannte Sets.
- Importierte Inhalte gelten ausschließlich als Daten und dürfen nie als Code interpretiert werden.
- Kein automatischer Synchronisierungsdienst in dieser Version.
- Didaktische Erweiterungen werden durch das Datenmodell vorbereitet, aber nicht auf Kosten der Datenintegrität vorgezogen.

### 1.2 Begriffe

- **Vokabelset:** Eine eigenständig importier- und exportierbare Sammlung mit Sprachpaar, Metadaten und Sektionen.
- **Sektion:** Ein benannter, sortierter Teil eines Sets, z. B. Lektion, Lernkasten oder Thema.
- **Eintrag:** Ein Vokabelpaar aus Lernform und Bedeutung, optional mit weiteren Formen und Hinweisen.
- **Importumfang (scope):** Kennzeichnet, ob eine Datei ein ganzes Set oder nur bestimmte Sektionen betrifft.
- **Update:** Importierte Datensätze werden ergänzt bzw. anhand stabiler IDs aktualisiert; fehlende Datensätze werden nicht automatisch gelöscht.
- **Replace:** Der ausdrücklich ausgewiesene Importumfang wird vollständig durch den importierten Inhalt ersetzt.
- **Lernhistorie:** Zeitgestempelte einzelne Antwort-/Bewertungsereignisse.
- **Lernstand:** Abgeleiteter bzw. zusammengefasster Zustand pro Vokabeleintrag.
- **Backup:** Vollständiger Export des lokalen Anwendungsbestands, nicht nur der Lerninhalte.

---

## 2. Technische Architektur auf einen Blick

### 2.1 Architekturschichten

Die Implementierung bleibt eine einzige Datei, wird intern aber in klar getrennte Bereiche gegliedert.

```text
HTML-Datei
├── UI / Views
│   ├── Bibliothek und Empty State
│   ├── Set- und Sektionsansicht
│   ├── Editor
│   ├── Importvorschau / Backup-Wiederherstellung
│   ├── Übung und Auswertung
│   └── Einstellungen und kontextbezogene Hilfe
├── App-Use-Cases
│   ├── create / edit / delete set, section, entry
│   ├── import preview / commit
│   ├── export set / section selection / backup
│   └── start / answer / finish practice session
├── Domain / pure functions
│   ├── validation and normalization
│   ├── import diff and merge rules
│   ├── ID handling
│   ├── learning event and progress calculations
│   └── data migrations
├── Persistence adapters
│   ├── IndexedDB repository
│   └── JSON file read / download
└── Browser capabilities
    ├── storage status / quota / optional persistence request
    └── pointer, keyboard and viewport behavior
```

Die Schichten werden in der HTML-Datei als getrennte Objekte/Funktionsbereiche bzw. unmittelbar aufeinanderfolgende Script-Abschnitte umgesetzt. UI-Handler sollen keine eigenständigen Datenbanklogik oder Merge-Regeln enthalten. Reine Funktionen für Validierung, Diff und Merge sollen ohne DOM-Zugriff testbar sein.

### 2.2 Prinzipien

1. **Eine Quelle der Wahrheit:** Der persistierte Bestand liegt in IndexedDB; UI-Zustand ist eine Darstellung davon.
2. **Vorbereiten, dann übernehmen:** Datei parsen, prüfen, normalisieren und eine Vorschau berechnen, bevor geschrieben wird.
3. **Schreibvorgänge sind atomar:** Eine Änderung, die mehrere Stores betrifft, erfolgt in einer gemeinsamen IndexedDB-Transaktion.
4. **Benutzerinhalte sind Text:** Importierte Strings werden als Text ausgegeben, nicht in `innerHTML` eingesetzt.
5. **Fehler bleiben sichtbar:** Die App bestätigt eine Speicherung oder einen Export nicht, bevor der jeweilige Browservorgang erfolgreich zurückgemeldet wurde.
6. **Keine stille Mehrdeutigkeit:** Wenn IDs fehlen oder widersprüchlich sind, wird keine unsichere automatische Zuordnung vorgenommen.
7. **Runtime ohne Abhängigkeiten:** JSON-Validierung und Datenzugriff sind in der HTML-Datei implementiert. Entwicklungs-/Testwerkzeuge dürfen extern sein, werden aber nicht ausgeliefert.

### 2.3 Laufzeitstruktur ohne Framework

Empfohlene interne Namensräume:

- `App` – Start, Zustandsnavigation und UI-Komposition
- `Domain` – reine Funktionen und fachliche Regeln
- `Storage` – Datenbank öffnen, lesen, schreiben, migrieren
- `ImportExport` – Dateiein-/ausgabe, Schema-Prüfung, Vorschau, Backup
- `Practice` – Sitzungsablauf und Erfassung von Antwortereignissen
- `A11y` – Fokusmanagement, Tastaturverhalten und zugängliche Rückmeldungen

Dies sind logische Module, keine zusätzlichen Dateien oder global verteilten Einzelzustände. Die Implementierung soll den bestehenden Stil schrittweise modernisieren, ohne dafür einen Build-Prozess vorauszusetzen.

---

## 3. Bereitstellung und Grenzen der Browser-Speicherung

### 3.1 Primärer Betriebsweg: eine feste statische HTTPS-Adresse

Die HTML-Datei kann unverändert auf einem statischen Webhost bereitgestellt werden. Es wird kein Anwendungsserver benötigt. HTTPS mit einem stabilen Origin ist der empfohlene Hauptbetrieb, insbesondere für mobile Browser.

**Wichtig:** Browser-Speicher ist origin-gebunden. Ein Umzug von einer Domain, einem Protokoll oder Port zu einem anderen Origin überträgt IndexedDB-Daten nicht automatisch. Das Backup ist der vorgesehene Transportweg zwischen Origins und Geräten.

### 3.2 Direktes Öffnen von `file://`

Der direkte Aufruf der HTML-Datei aus dem Dateisystem soll nach Möglichkeit funktionieren, ist aber wegen browserabhängiger Behandlung von Datei-Origin und persistentem Speicher als **Best-Effort-Modus** zu behandeln. Die Webplattform garantiert nicht, dass das Verhalten beim Öffnen und Verschieben lokaler HTML-Dateien browserübergreifend gleich ist. Dieser Modus ist vor Freigabe in konkreten Zielbrowsern zu testen.

Die App darf bei nicht verfügbarem IndexedDB nicht stillschweigend auf einen nur flüchtigen Speicher zurückfallen und dabei „gespeichert“ anzeigen. Stattdessen muss sie in einen klaren Fehler-/Einschränkungszustand wechseln, erklären, dass dauerhafte Speicherung in diesem Startmodus nicht verfügbar ist, und den bevorzugten Betriebsweg nennen. Ein ungesicherter Arbeitsspeicher-Modus darf nicht als vollständige App-Nutzung erscheinen.

### 3.3 IndexedDB und Speicherschutz

- Primärer Speicher ist IndexedDB.
- Beim ersten Öffnen wird die DB angelegt bzw. auf die unterstützte Version migriert.
- Schreibfehler wie `QuotaExceededError`, Abbruch oder gesperrter Speicher müssen behandelt und verständlich angezeigt werden.
- `navigator.storage.estimate()` kann, sofern verfügbar, zur Diagnose einer ungefähren Speichernutzung verwendet werden. Die Werte sind Schätzungen und dürfen nicht als garantierte Restkapazität dargestellt werden.
- `navigator.storage.persist()` kann auf unterstützten sicheren Origins optional angefragt werden, nachdem tatsächlich Daten angelegt wurden. Die Erteilung ist Browserentscheidung; Ablehnung verhindert die Benutzung nicht. Die App darf dennoch nie garantieren, dass Daten nicht durch Browser-/Profil-Löschung verloren gehen.
- Ein Hinweis auf regelmäßige vollständige Backups bleibt unabhängig vom Ergebnis einer Persistenzanfrage erforderlich.

Diese Einschränkungen ergeben sich aus dem browserverwalteten Speicher- und Eviction-Modell; siehe Quellen in Kapitel 16.

### 3.4 Keine Abhängigkeit von speziellen Dateisystem-APIs

Für den Import wird ein normales `<input type="file">` mit expliziter Dateiauswahl verwendet. Für den Export wird eine JSON-`Blob`-URL mit einem Download-Link bzw. einer gleichwertigen kompatiblen Auslösung verwendet. Die File System Access API kann später als progressive Verbesserung betrachtet werden, wird aber wegen ihrer unterschiedlichen Browserunterstützung nicht zum Basispfad.

---

## 4. IndexedDB-Datenmodell

### 4.1 Datenbank

**Datenbankname:** `VokabeltrainerDB`  
**Initiale Datenbankversion:** `1`

Alle Objektstores werden unter einem gemeinsamen DB-Upgrade angelegt. Zukünftige strukturelle Änderungen erhöhen die IndexedDB-Version; `onupgradeneeded` migriert nur lokal vorhandene Daten. Datenmigrationen dürfen nicht von Netzwerkzugriffen abhängen.

| Object Store | Schlüssel | Inhalt | Zweck |
|---|---|---|---|
| `sets` | `id` | Ein kompletter Set-Datensatz mit eingebetteten Sektionen und Einträgen | Set-Inhalt in einer atomar austauschbaren Einheit |
| `progress` | zusammengesetzter Schlüssel `[setId, entryId]` | Zusammengefasster Lernstand pro Eintrag | Schnelle Statusanzeige und Vorbereitung späterer Lernplanung |
| `reviewEvents` | `id` | Einzelne zeitgestempelte Antworten/Bewertungen | Historie und Grundlage künftiger didaktischer Auswertung |
| `sessions` | `id` | Metadaten und Resultat einer Lernsitzung | Sitzungsübersicht und Auswertungen |
| `settings` | `key` | Einstellungen, z. B. Theme und letzte Auswahl | Persistente Präferenzen |
| `meta` | `key` | App-/Schema-Metadaten, z. B. installierte Datenmodellversion | Migration, Backup-Status und interne Wartungsdaten |

Sektionen und Vokabeleinträge liegen zunächst verschachtelt im jeweiligen Set. Für die derzeit erwartete Größe vereinfacht dies Export, Validierung, Undo-/Replace-Planung und atomare Set-Änderungen. Lernereignisse liegen separat, damit der Inhaltsbestand nicht bei jeder Antwort neu geschrieben werden muss.

Ein späteres Performance-Problem könnte eine Normalisierung auf Einträge als eigene Datensätze rechtfertigen. Sie ist für die erste ausgebaute Version nicht nötig und würde die atomare Set-Übernahme komplexer machen.

### 4.2 Beispielstruktur eines gespeicherten Sets

Das hier ist die interne Zielstruktur in verständlichem Pseudocode. Die konkrete externe Importdatei ist in Kapitel 5 spezifiziert; sie ist davon getrennt.

```json
{
  "id": "set-uuid",
  "revision": 4,
  "createdAt": "2026-10-18T18:00:00.000Z",
  "updatedAt": "2026-10-18T18:30:00.000Z",
  "title": "Beispiel Englisch – Grundwortschatz",
  "languages": {
    "term": { "tag": "en", "name": "English" },
    "meaning": { "tag": "de", "name": "Deutsch" }
  },
  "level": "Klasse 6",
  "metadata": {
    "source": "optional",
    "reviewStatus": "optional"
  },
  "sections": [
    {
      "id": "section-uuid",
      "title": "Freizeit",
      "entries": [
        {
          "id": "entry-uuid",
          "term": { "text": "to visit", "acceptedVariants": [] },
          "meaning": { "text": "besuchen", "acceptedVariants": [] },
          "notes": "optional"
        }
      ]
    }
  ]
}
```

`revision` ist eine interne Ganzzahl, die bei erfolgreicher fachlicher Änderung des Sets erhöht wird. Sie ist kein Ersatz für die stabile fachliche `id` und wird nicht als fremde ID aus der Importdatei übernommen. `createdAt` und `updatedAt` sind ISO-8601-Zeitstempel in UTC. Reihenfolge in Arrays ist maßgeblich; es soll nicht gleichzeitig eine zweite, widersprüchliche Sortierreihenfolge über `order`-Felder eingeführt werden.

### 4.3 IDs

- Set-, Sektions- und Eintrags-IDs sind opake Zeichenketten, vorzugsweise UUID v4.
- IDs werden für neue lokale Datensätze mit `crypto.randomUUID()` erzeugt, soweit verfügbar, andernfalls aus `crypto.getRandomValues()`.
- IDs sind Identifikatoren, keine Geheimnisse oder Sicherheitsberechtigungen.
- Die Eindeutigkeit von Sektions- und Eintrags-IDs wird mindestens innerhalb eines Sets geprüft. Fortschritt wird über die Kombination `setId + entryId` zugeordnet, damit versehentliche ID-Gleichheiten in verschiedenen Sets keine Lernstände vermischen.
- Neue externe Sets dürfen IDs auslassen; die App erzeugt sie beim Import.
- Bei einem App-Export müssen IDs enthalten sein und bei externer Korrektur erhalten bleiben.
- Ein Export, dessen Set-ID auf eine lokal existierende Set-ID verweist, wird als bekannte Sammlung erkannt. Ein Import darf vorhandene IDs niemals aufgrund gleicher Worttexte automatisch auf ein anderes Set übertragen.

### 4.4 Fortschritts- und Historienmodell

`reviewEvents` enthält ein Ereignis pro beantworteter bzw. bewerteter Karte. Mindestfelder:

```json
{
  "id": "review-event-uuid",
  "sessionId": "session-uuid",
  "setId": "set-uuid",
  "entryId": "entry-uuid",
  "occurredAt": "2026-10-18T18:31:00.000Z",
  "direction": "term-to-meaning",
  "mode": "flashcard",
  "result": "correct",
  "firstAttempt": true
}
```

Zulässige Werte für `direction`, `mode` und `result` sind in der Implementierung Konstanten und werden validiert. Für Selbstbewertung ist „correct“ hier die technische Abbildung von „gewusst“ und „incorrect“ die Abbildung von „nochmal“; diese Werte bedeuten nicht, dass bereits eine objektive freie-Antwort-Bewertung erfolgt.

`progress` ist ein schneller, abgeleiteter Zustand, z. B. Anzahl Versuche, zuletzt geübt, letzter Ausgang, zuletzt beim ersten Versuch gewusst. Die Rohereignisse bleiben maßgeblich für die Historie. Die konkrete Lernplanung – inklusive Intervallalgorithmus und Mastery-Modell – wird nicht vorweggenommen. Felder wie `nextDueAt` dürfen später hinzukommen und müssen migrierbar sein.

Beim Löschen einer Vokabel werden ihre Review-Ereignisse nicht automatisch gelöscht; so bleibt die historische Aufzeichnung erhalten. Der aktive Lernstand für einen nicht mehr vorhandenen Eintrag wird in der normalen Lernansicht nicht angeboten. Ein neu angelegter Eintrag erhält eine neue ID und beginnt mit leerem Lernstand.

### 4.5 Sitzungen

Ein `sessions`-Datensatz enthält mindestens ID, Start- und Endzeit, Set-/Sektionsauswahl, Konfiguration (Abfragerichtung, Anzahl, Abfrageformen) und zusammenfassendes Resultat. Eine aktive Sitzung darf im Arbeitsspeicher geführt werden; die PRD-Anforderung verlangt keinen garantierten Wiederaufbau einer laufenden Sitzung nach einem vollständigen Reload. Abgeschlossene Ereignisse und Resultate müssen dauerhaft geschrieben sein.

### 4.6 Datenbankmigrationen

- `DB_VERSION` wird zentral definiert.
- Jede `upgradeneeded`-Migration ist klein, deterministisch und lokal.
- Vor einer nichttrivialen Migration soll die App prüfen, ob ein Backup angeboten bzw. empfohlen werden muss.
- Eine fehlgeschlagene Migration darf die App nicht in einem scheinbar funktionierenden, teilweise migrierten Zustand weiterlaufen lassen.
- Mehrere geöffnete Tabs müssen auf `versionchange` reagieren, ihre DB-Verbindung schließen und bei blockierter Migration eine verständliche Meldung ermöglichen.
- Tests decken mindestens Installation auf leerer DB und Migration von jeder unterstützten Vorgängerversion ab.

---

## 5. Austauschformat für Vokabelsets

### 5.1 Entwurfsentscheidungen

- **Formatkennung:** `vokabeltrainer-set`
- **Formatversion:** ganzzahliger `formatVersion`-Wert, beginnend mit `1`
- **Zeichenkodierung:** UTF-8
- **Dateiendung:** `.json`
- **Sprachkennung:** BCP 47/BCP-47-kompatibler Sprach-Tag (z. B. `en`, `en-GB`, `fr`, `de`, `la`), nach RFC 5646
- **IDs bei neu erstellten Dateien:** optional
- **IDs bei exportierten Dateien:** vorhanden und unverändert zu erhalten
- **Lernhistorie:** nicht Bestandteil eines normalen Set-Exports
- **Validierung:** lokaler Validator ohne Runtime-Abhängigkeit; separate JSON-Schema-Datei als lesbare Spezifikation und Referenz für Ersteller/LLMs

JSON Schema Draft 2020-12 wird als Schema-Dialekt empfohlen. Es bietet eine standardisierte Möglichkeit, Struktur und zulässige Felder maschinenlesbar zu beschreiben. Die Runtime muss jedoch keine externe JSON-Schema-Bibliothek nachladen; die eingebaute Prüfung wird durch gemeinsame Testfixtures mit dem veröffentlichten Schema synchron gehalten.

### 5.2 Vokabelset-Datei: minimales Beispiel

Die genaue Formatspezifikation wird als begleitendes Dokument erstellt. Dieses Beispiel zeigt die voraussichtliche Grundform.

```json
{
  "format": "vokabeltrainer-set",
  "formatVersion": 1,
  "scope": { "type": "set" },
  "set": {
    "title": "Beispiel Englisch – Klasse 6",
    "languages": {
      "term": { "tag": "en", "name": "English" },
      "meaning": { "tag": "de", "name": "Deutsch" }
    },
    "level": "Klasse 6"
  },
  "sections": [
    {
      "title": "Freizeit",
      "entries": [
        {
          "term": { "text": "weekend" },
          "meaning": { "text": "Wochenende" }
        },
        {
          "term": { "text": "each" },
          "meaning": {
            "text": "jede/-r/-s",
            "acceptedVariants": ["jeder", "jede", "jedes"]
          }
        }
      ]
    }
  ]
}
```

IDs und optionale Metadaten dürfen in diesem Minimalformat fehlen. Die App ergänzt IDs und notwendige interne Zeit-/Versionsfelder nach erfolgreicher Validierung. Das Format muss klar zwischen der angezeigten Form (`text`) und ausdrücklich akzeptierten Antwortvarianten (`acceptedVariants`) unterscheiden. Diese Varianten sind zunächst Daten; eine automatische Freitextbewertung gehört zu einer späteren Iteration.

### 5.3 Exportumfang

Ein vollständiger Set-Export enthält:

```json
"scope": { "type": "set" }
```

Ein Teil-Export enthält die IDs der **bereits bestehenden Sektionen**, die durch diese Datei verwaltet werden sollen:

```json
"scope": {
  "type": "sections",
  "sectionIds": ["section-uuid-1", "section-uuid-2"]
}
```

Bei einem Teil-Export bleiben Set-ID und IDs der exportierten Sektionen und Einträge erhalten. Die `sectionIds` definieren die schon vorhandenen Sektionen, die vom Reimport betroffen sein dürfen. Neue Sektionen dürfen zusätzlich im `sections`-Array enthalten sein und werden als neue Sektionen ergänzt; ihre IDs dürfen bei extern neu erstellten Sektionen fehlen und werden dann beim Import vergeben. Ein Import darf niemals eine bereits lokal vorhandene, nicht im Scope aufgeführte Sektion aufgrund derselben ID verändern. Set-Metadaten und andere Sektionen bleiben bei einem Teil-Export unberührt.

Für einen frisch extern erzeugten Satz ohne IDs gilt `scope.type = "set"`. Dateien mit nicht unterstützter Formatversion werden abgelehnt, bis eine passende Migration vorhanden ist. Das ist sicherer als das teilweise Interpretieren einer zukünftigen, unbekannten Struktur.

### 5.4 Pflichtfelder und semantische Validierung

Der Validator muss mindestens prüfen:

- gültiges JSON und erwartete Formatkennung;
- unterstützte Formatversion;
- Set-Titel und beide Sprachen mit gültigen Sprach-Tags;
- vorhandene Arrays für Sektionen und Einträge;
- nichtleere Vokabel- und Bedeutungsanzeige nach Trimmen der Rand-Leerzeichen;
- Typen aller optionalen Felder;
- Gültigkeit und Eindeutigkeit von IDs innerhalb der vorgesehenen Bereiche;
- `scope.sectionIds`-Referenzen; beim Teilimport dürfen existierende Sektionen außerhalb des Scope nicht verändert werden; neue Sektionen im Inhalt sind als Ergänzungen möglich;
- keine unzulässigen doppelten IDs innerhalb desselben Sets;
- eine vernünftige maximale Dateigröße bzw. eine verständliche Fehlermeldung bei übergroßen Dateien (Startwert: 10 MiB, als Implementierungskonstante leicht anpassbar).

Fehler, die eine sichere Interpretation verhindern (ungültiges JSON, unbekannte Hauptversion, widersprüchlicher Scope, doppelte IDs), blockieren den Import. Optionale Metadatenfehler sollen möglichst genau lokalisiert und verständlich erklärt werden. Unbekannte Felder werden in Version 1 nicht stillschweigend verworfen: Sie erhalten eine konkrete Fehlermeldung oder Warnung entsprechend der Formatspezifikation. Bevorzugt wird ein klar definierter `extensions`-Bereich, falls später benutzerdefinierte Erweiterungen tatsächlich erforderlich werden.

### 5.5 Normalisierung und Sicherheit

Nach erfolgreicher Prüfung wird eine normalisierte Kopie erstellt:

- ID- und Textfelder trimmen, ohne bedeutungstragende Binnenzeichen zu verändern;
- IDs für Einträge/Sektionen ergänzen, wenn es sich um einen neuen, ID-losen Inhalt handelt;
- keine unscharfe automatische Zuordnung allein aufgrund ähnlicher Vokabeltexte;
- unterstützte Versionen in ein internes aktuelles Modell migrieren;
- keine importierten Werte mit `eval`, dynamischen Script-Tags oder unbereinigter `innerHTML`-Interpolation verarbeiten;
- alle im UI dargestellten Nutzdaten über `textContent` oder sichere DOM-Textknoten darstellen.

Ein optionaler Source-/Review-Metadatensatz darf fehlen. Fehlen IDs in einem erkannten bestehenden Set, werden betroffene Datensätze nicht automatisch als bestehende Einträge behandelt; die Vorschau weist darauf hin, dass sie als neue Einträge hinzugefügt werden könnten.

---

## 6. Einheitlicher Importablauf

### 6.1 UX-Ziel

Es gibt einen einzigen Einstieg **„Vokabelset importieren“**. Nutzende sollen nicht zwischen separaten Werkzeugen für Neuimport, Update und Replace wählen müssen. Die App leitet die passende Ansicht aus Format, IDs und Umfang ab.

### 6.2 Ablauf

```text
Datei auswählen
    ↓
Datei lesen und JSON parsen
    ↓
Format- und Inhaltsprüfung (noch keine Datenänderung)
    ↓
Set anhand der Set-ID zuordnen
    ├── keine bekannte Set-ID → neuer Set-Import
    └── bekannte Set-ID → Update-/Replace-Vorschau
    ↓
Änderungsübersicht: Ziel, Umfang, neu/geändert/unverändert/entfernt
    ↓
Nutzende bestätigen oder brechen ab
    ↓
revision erneut prüfen + alle Änderungen in einer IDB-Transaktion schreiben
    ↓
Erfolgsmeldung und Ansicht des importierten Sets
```

### 6.3 Erkennung ohne interne IDs

- Hat die Datei keine Set-ID und keine IDs, wird sie als neues Set behandelt; notwendige IDs werden lokal vergeben.
- Hat die Datei eine Set-ID, die lokal existiert, ist das Set eindeutig erkannt.
- Enthält eine ID-lose Datei einen sehr ähnlichen Titel und dasselbe Sprachpaar wie ein vorhandenes Set, darf die App auf einen möglichen Doppelimport hinweisen. Sie darf daraus aber nicht automatisch einen Update machen.
- Fehlt die Set-ID eines zuvor exportierten Sets, kann eine sichere automatische Zuordnung nicht garantiert werden. Die App informiert darüber und importiert es nicht stillschweigend in ein vermeintlich bestehendes Set.
- Die App verwendet keine versteckten, wortbasierten Fuzzy-Matching-Regeln für IDs. Das würde falsche Zusammenführungen und Verlust bzw. Fehlzuordnung von Lernstand riskieren.

### 6.4 Update-Semantik

Update ist die nichtdestruktive Standardoption für ein wiedererkanntes Set.

- Set-Metadaten werden nur aktualisiert, wenn der Importumfang das ganze Set umfasst.
- Sektionen im ausgewiesenen Importumfang werden anhand ihrer IDs aktualisiert; Sektionstitel und Metadaten dieser Sektionen dürfen auch bei einem Teil-Export korrigiert werden.
- In der Datei enthaltene Einträge werden anhand ihrer IDs aktualisiert.
- Neue Sektionen/Einträge werden ergänzt und erhalten bei fehlender ID eine neue ID.
- Sektionen und Einträge, die innerhalb des Update-Umfangs nicht vorkommen, werden **nicht gelöscht**.
- Reihenfolge der importierten Einträge wird innerhalb des eingelesenen Bereichs angewandt; nicht enthaltene bestehende Einträge bleiben erhalten und werden nach den importierten Einträgen in ihrer bisherigen relativen Reihenfolge angefügt. Ein Replace bildet die Reihenfolge exakt anhand der Datei ab.
- Ein bestehendes Objekt, das anhand einer ID erkannt wird, wird als Ganzes aktualisiert. Nicht angegebene optionale Felder können dadurch entfernt werden; diese Wirkung muss in der Formatdokumentation klar erklärt sein.

Die letzte Regel verhindert, dass veraltete optionalen Angaben aus dem lokalen Datensatz unbeabsichtigt erhalten bleiben, wenn das exportierte Objekt vollständig korrigiert wurde. Für Felder, die nicht bekannt oder nicht editierbar sind, darf die Runtime keine Daten stillschweigend verlieren; entweder sind sie Teil des stabilen Schemas oder als expliziter Erweiterungsbereich zu erhalten.

### 6.5 Replace-Semantik

Replace ersetzt den ausdrücklich ausgewiesenen Umfang und niemals automatisch die ganze Bibliothek.

- `scope.type = "set"`: Metadaten, Sektionen und Einträge des bekannten Sets werden durch den importierten vollständigen Set-Inhalt ersetzt.
- `scope.type = "sections"`: Nur die in `scope.sectionIds` aufgeführten, bereits existierenden Sektionen dürfen ersetzt oder entfernt werden. Nicht aufgeführte bestehende Sektionen und Set-Metadaten bleiben unberührt. Neue Sektionen im Inhalt werden als Ergänzungen angelegt; eine vorhandene lokale Sektion außerhalb des Scope mit einer im Import vorkommenden ID führt zu einem Validierungsfehler.
- Ein in `scope.sectionIds` aufgeführter, bereits existierender Sektions-Identifier, der beim Replace im Inhalt fehlt, bedeutet, dass diese Sektion entfernt werden soll. Die Vorschau muss diesen Vorgang deutlich als Löschung ausweisen.
- Ein fehlender Eintrag innerhalb einer enthaltenen Sektion wird beim Replace dieser Sektion entfernt.
- Gelöschte Einträge entfernen nicht ihre historischen Review-Ereignisse. Diese bleiben bei der Auswertung des aktuellen Sets außer Betracht, aber für Historie/Backup erhalten.
- Replace benötigt eine gesonderte, klare Bestätigung, wenn Sektionen oder Einträge gelöscht werden.

### 6.6 Änderungsdiff und Vorschau

Die Diff-Funktion ist eine reine Fachfunktion ohne DOM-/Datenbankabhängigkeit. Sie erzeugt Zählungen und eine Liste von Aktionen, beispielsweise:

- unverändert
- geändert
- neu
- wird entfernt
- kann wegen fehlender/eindeutiger ID nicht sicher zugeordnet werden

Im UI genügen gruppierte Zähler und eine aufklappbare Liste der konkret betroffenen Sektionen/Einträge. Ein vollwertiger visueller JSON-Diff ist nicht erforderlich.

### 6.7 Schutz vor konkurrierenden Änderungen

Beim Öffnen der Vorschau speichert die App die aktuelle interne `revision` des Zielsets. Beim Bestätigen startet sie eine Read-Write-Transaktion, liest das Zielset erneut und vergleicht die Revision. Hat ein zweiter Tab oder eine andere Operation das Set verändert, wird der Commit abgebrochen und die Vorschau neu berechnet. Die App darf keine veraltete Vorschau ungeprüft anwenden.

Alle Validierung und Berechnung, die nicht von IndexedDB abhängt, geschieht vor der Transaktion. Innerhalb der Transaktion werden nur Datenbankoperationen und synchron verfügbare Merge-Schritte ausgeführt; keine Netzwerkaufrufe oder beliebigen asynchronen Wartezeiten. Die Commit-Transaktion umfasst `sets` und die erforderlichen `progress`-Änderungen, damit Änderungen vollständig oder gar nicht wirksam werden.

### 6.8 Fehlerfälle

- Ungültiges JSON: Import abbrechen, genaue Fehlerart anzeigen; nichts schreiben.
- Unbekannte Formatversion: Import abbrechen, Versionsproblem nennen.
- Ungültige oder doppelte IDs: Import abbrechen oder sichere, ausdrücklich markierte Neu-ID-Erzeugung nur für einen eindeutig neuen Set-Import zulassen.
- Storage-Fehler/Transaktionsabbruch: keine Erfolgsmeldung; vorheriger Bestand bleibt vollständig erhalten.
- Abbrechen in Vorschau: keine Datenänderung.
- Unklare Teil-Export-Semantik: Import ablehnen, statt den möglichen Wirkungsbereich zu erraten.

---

## 7. Bearbeitung in der App

### 7.1 Editorumfang

Der Set-Editor unterstützt in dieser Version:

- Set-Titel, Sprachpaar und optionale Metadaten ändern;
- Sektionen hinzufügen, umbenennen, sortieren und löschen;
- Einträge hinzufügen, bearbeiten, sortieren und löschen;
- Anzeigeform und optionale akzeptierte Varianten für beide Seiten pflegen;
- optionale Hinweise/Notizen pflegen;
- speichern und zur vorherigen Ansicht zurückkehren.

Die Oberfläche soll auf Smartphones ohne horizontales Scrollen funktionieren. Eine einzelne Vokabel wird in einem kompakten Formular bearbeitet, nicht in einer breiten Tabellenzeile. Bei Löschen von Inhalten ist eine bestätigende Rückfrage erforderlich, wenn der Vorgang nicht einfach rückgängig zu machen ist.

### 7.2 Speichern und ungesicherte Änderungen

- Änderungen im Editor werden zunächst in einem lokalen Editorzustand gesammelt und als Set gespeichert, sobald die Person „Speichern“ auswählt bzw. beim ausdrücklich so gestalteten Auto-Save.
- Für die erste Ausbaustufe wird ein expliziter Speichern-/Abbrechen-Ablauf empfohlen, sofern kein zuverlässiges, gut kommuniziertes Auto-Save mit Undo vorgesehen ist.
- Bei Navigation mit ungespeicherten Änderungen zeigt die App eine klare Wahl: Änderungen speichern, verwerfen oder zurückkehren.
- Erst nach erfolgreichem DB-Commit zeigt die App die Änderung als gespeichert an.
- `revision` und `updatedAt` werden bei jeder erfolgreichen inhaltlichen Änderung erhöht/erneuert.

### 7.3 Sicherheit der Darstellung

Vokabeltext, Notizen, Quellenangaben und importierte Metadaten sind nicht vertrauenswürdige Eingaben. Sie werden nie als HTML interpretiert. Wo Zeilenumbrüche erwünscht sind, werden sie durch CSS bzw. Textknoten angezeigt; externe URLs werden nicht ungeprüft automatisch geöffnet.

---

## 8. Export und vollständiges Backup

### 8.1 Export einzelner Inhalte

Der Set-/Sektionsexport erstellt ein neues JSON-Objekt nach der externen Formatspezifikation. Er enthält:

- Formatkennung und Formatversion;
- stabile IDs der betroffenen Set-, Sektions- und Eintragsobjekte;
- den genauen Exportumfang in `scope`;
- Sprachkennungen, Titel, Reihenfolge und optionale Metadaten;
- keine persönliche Lernhistorie, appweite Präferenzen oder persönlichen Sitzungsstatistiken.

Ein Dateiname soll Set-Titel und Exportdatum enthalten, dabei problematische Dateisystemzeichen entfernen und auf eine sinnvolle Länge begrenzt sein. Der Export darf den lokalen Bestand nicht ändern.

### 8.2 Vollständiges Backupformat

**Formatkennung:** `vokabeltrainer-backup`  
**Formatversion:** `1`

Beispielhafte Struktur:

```json
{
  "format": "vokabeltrainer-backup",
  "formatVersion": 1,
  "exportedAt": "2026-10-18T18:45:00.000Z",
  "appDataVersion": 1,
  "data": {
    "sets": [],
    "progress": [],
    "reviewEvents": [],
    "sessions": [],
    "settings": {}
  }
}
```

Es wird kein separater Exportmodus für jedes einzelne interne Objekt angeboten. Der vollständige Backup-Export enthält alle Nutzerdaten, die für die Wiederherstellung benötigt werden. Technische Cache-Daten können ausgenommen sein, sofern sie sicher neu aufgebaut werden können und keine Nutzerdaten darstellen.

### 8.3 Snapshot-Konsistenz

Der Export liest alle benötigten Stores in einer gemeinsamen Read-Only-Transaktion aus. Die resultierende Datei enthält damit einen konsistenten DB-Snapshot und nicht zeitlich vermischte Teilstände. JSON-Serialisierung und Download erfolgen danach außerhalb der Transaktion.

### 8.4 Wiederherstellung

- Backupdatei auswählen, parsen und vollständig validieren, bevor lokale Daten verändert werden.
- Kompatibilität der Backupversion sowie alle notwendigen Referenzen prüfen.
- Vorab Set-Anzahl, Eintragszahl, Sitzungen und weitere relevante Datenbereiche anzeigen.
- Wenn bereits lokale Daten existieren, ausdrücklich erklären, dass die Wiederherstellung den lokalen Datenbestand ersetzt, und Bestätigung einholen.
- Optional bzw. empfohlen: vor dem Überschreiben einen aktuellen Backup-Download anbieten.
- Alle betroffenen Stores in einer einzigen Read-Write-Transaktion ersetzen. Schlägt eine Operation fehl, wird die Transaktion abgebrochen und der bisherige Bestand bleibt bestehen.
- Nach erfolgreichem Commit UI-Zustand neu laden und Erfolg anzeigen.
- Backup eines neueren, nicht unterstützten Formats ablehnen; kein teilweises Wiederherstellen.

Die erste Version bietet **keine automatische Zusammenführung zweier vollständiger Backups**. Das wäre ein eigener Sync-/Merge-Fall mit Konfliktbehandlung und ist nicht Teil der aktuellen Produktanforderung.

### 8.5 Plattformübergreifende Grenzen

Der Backup-Import ist das offizielle Verfahren für Gerätewechsel und Origin-Wechsel. Automatischer Browserprofiltransfer, Zugriff auf den Dateisystempfad oder Synchronisierung werden nicht vorausgesetzt. Die App erklärt, dass Browserdaten gelöscht werden können und ein erfolgreich heruntergeladenes Backup separat sicher aufbewahrt werden muss.

---

## 9. Lernablauf und didaktische Erweiterbarkeit

### 9.1 Beibehaltung der vorhandenen Kernfunktionen

Die aktuelle Implementierung wird nicht unverändert übernommen, sondern in die neuen Datenzugriffs- und Ansichtsbereiche überführt. Erhalten bleiben, soweit sinnvoll:

- Auswahl einzelner oder mehrerer Sektionen;
- beide Abfragerichtungen und gemischte Richtung;
- konfigurierbarer Umfang und Multiple-Choice-Anteil;
- Karteikarten mit sichtbarem Umdrehhinweis;
- Buttons plus optionale Wisch-/Tastaturbedienung;
- Wiederholung falscher Karten in derselben Sitzung;
- Erstversuchsquote, Fehlerliste und Fehlertraining;
- verständlicher Zwischenstand und Fortsetzen während derselben aktiven Sitzung.

### 9.2 Persistenz von Bewertungen

Jede bewertete Antwort wird als `reviewEvent` gespeichert. Die Speicherung muss vor einer als abgeschlossen angezeigten Sitzungszusammenfassung erfolgreich sein. Mehrere Bewertungsereignisse für dieselbe Karte bleiben unterscheidbar, damit Wiederholungsschleifen nicht mit Erstversuchsresultaten verwechselt werden.

Die Sitzung definiert `firstAttempt` fachlich pro Eintrag und Sitzung, nicht pro Bildschirmdarstellung. Wiederholte falsche Karten zählen nicht erneut als erste Antwort. Bei einer späteren freien Eingabe werden Ergebnis, Antworttext bzw. erkannte Antwort und Bewertungsregel nur dann ergänzt, wenn Datenschutz und Datensparsamkeit dies rechtfertigen; der konkrete Inhalt ist vor Implementierung dieses späteren Features festzulegen.

### 9.3 Keine vorzeitige Festlegung des Spaced-Repetition-Algorithmus

Das Datenmodell speichert ausreichend Ereignisse, damit ein späterer Algorithmus auf Lernverlauf aufbauen kann. Diese Version implementiert jedoch keinen unüberprüften „intelligenten“ Algorithmus allein deshalb, weil Daten gespeichert werden. Lernplanung und Beherrschungsstatus werden als eigene spätere Designentscheidung behandelt, mit Tests und pädagogischer Begründung.

### 9.4 Antwortvarianten

`acceptedVariants` werden beim Import und in der Bearbeitung validiert und exportiert, aber in der ersten ausgebauten Version noch nicht als automatische Regel für freie Eingaben bewertet. Im aktuellen Lernmodus können sie höchstens als Referenz für die Anzeige bzw. Bearbeitung verwendet werden. So wird das Datenformat vorbereitet, ohne eine halbfertige Bewertungslogik einzuführen.

---

## 10. UX, Empty State und barrierearme Bedienung

### 10.1 Empty State als Einstieg

Wenn die Bibliothek leer ist:

- kurz und altersgerecht sagen, was sich mit der App machen lässt;
- eine primäre Aktion „Erstes Vokabelset importieren“ anbieten;
- eine sekundäre, leicht auffindbare Möglichkeit „Wie erstelle ich ein Vokabelset?“ bzw. „Formatbeispiel“ bereitstellen;
- nicht voraussetzen, dass Nutzende wissen, was JSON oder eine ID ist;
- keine leere Navigationshierarchie ohne nächste Handlung darstellen;
- nicht bei jedem Start erneut als Tour erscheinen, wenn bereits Sets existieren.

Der Empty State wird aus dem aktuellen Datenbestand abgeleitet und erscheint daher auch wieder, wenn das letzte Set gelöscht wird.

### 10.2 Kontextbezogene Hilfe

Kurze In-place-Hinweise sind besonders sinnvoll bei:

- Import: Was wird gerade importiert?
- Update: Fehlende Einträge bleiben bestehen.
- Replace: Welche Einträge/Sektionen werden entfernt?
- Teil-Export: Nur die gewählten Sektionen gehören zur Datei.
- Backup: Die Datei enthält auch persönlichen Lernfortschritt und kann bestehende lokale Daten ersetzen.
- Speichern: Wann sind Änderungen dauerhaft gespeichert?

Hilfetext darf keine unklare Schaltfläche oder schlechte Navigation entschuldigen. Bei kritischen Folgen soll die Oberfläche diese in der Zusammenfassung direkt vor der Bestätigung benennen.

### 10.3 Mobile-first Regeln

- Primäre Aufgaben müssen auf kleinen Displays ohne horizontales Scrollen möglich sein.
- Als Designziel werden Touch-Ziele vorzugsweise mindestens etwa **44 × 44 CSS-Pixel** groß gestaltet; **24 × 24 CSS-Pixel** ist der maßgebliche Mindestwert nach WCAG 2.2 AA (unter Berücksichtigung der dort definierten Ausnahmen). 44 px ist hier eine Komfortempfehlung, keine WCAG-Aussage.
- sichtbarer Tastaturfokus, sinnvolle Tab-Reihenfolge und semantische Buttons, Labels und Formulare;
- Wischgesten nie als einzige Bedienmöglichkeit;
- Status nicht allein über Farbe kommunizieren;
- Buttons mit konkreten Verben und Folge benennen, z. B. „Ersetzen“ statt nur „OK“;
- Fokus nach Modalabschluss sinnvoll zum aufrufenden Steuerelement zurückführen;
- Validierungs- und Speicherfehler in der Nähe des betroffenen Bereichs anzeigen.

### 10.4 Tastatur- und Gestenregeln

Bei Karteikarten gelten:

- Tippen/Enter/Leertaste deckt die Karte auf;
- Buttons „Nochmal“ und „Gewusst“ bleiben immer sichtbar, sobald bewertet werden kann;
- Pfeil-links/-rechts können ergänzend bewerten, dürfen aber nicht in Eingabefeldern oder anderen Komponenten ungewollt Aktionen auslösen;
- horizontales Wischen darf nicht mit vertikalem Scrollen konkurrieren;
- bei reduzierter Bewegung bzw. `prefers-reduced-motion` werden unnötige Animationen reduziert.

---

## 11. Datenschutz und Sicherheit

- Es gibt keine automatischen Netzwerkaufrufe mit Vokabeln, Antworten, Lernhistorie oder Einstellungen.
- Es dürfen keine Analytics-, Werbe-, Telemetrie- oder Drittanbieter-SDKs eingebunden werden.
- Importdaten werden als nicht vertrauenswürdig angesehen; die App verarbeitet nur Datenstrukturen, keine ausführbaren Inhalte.
- Dateigröße, Stringlängen, Arraygrößen und Verschachtelung werden begrenzt oder sinnvoll abgesichert, um Browserblockaden durch extrem große Dateien zu vermeiden.
- Fehlermeldungen dürfen keine unnötigen persönlichen Daten ausgeben.
- Ein Export wird nur durch bewusste Nutzeraktion ausgelöst. Die App legt kein verborgenes Backup im Downloadordner oder in einem anderen Speicher an.
- Ein normales Set enthält keine Lernhistorie; ein vollständiges Backup dagegen ausdrücklich schon und wird entsprechend bezeichnet.
- Kein Schutzversprechen für Daten, die der Nutzer auf einem gemeinsam genutzten Browserprofil speichert. Eine optionale Löschfunktion für alle lokalen Daten ist deutlich gekennzeichnet und durch Bestätigung geschützt.

---

## 12. Umsetzungsmigration vom bestehenden Prototyp

### 12.1 Fachliche Übernahme

Die vorhandenen Übungsfunktionen werden als Ausgangspunkt genutzt, aber von globalen Variablen und eingebetteten festen Daten entkoppelt.

- `D` und `C` als im Code fest verdrahtete Wortlisten werden nicht länger die fachliche Datenquelle.
- Die bisherige Englisch-Wortliste wird in ein reguläres Vokabelset-JSON umgewandelt, damit sie über denselben Importpfad wie alle anderen Sets funktioniert.
- Ein neuer Installationszustand wird nicht automatisch mit einer fixen Klasse-/Sprachbibliothek befüllt; der Empty State bleibt erreichbar.
- Soll die vorhandene Liste als Starthilfe ausgeliefert werden, wird sie als optional importierbarer Beispieldatensatz behandelt, nicht als Sonderlogik im Code.
- Sitzungszustand (`st`) wird durch einen klareren, abgegrenzten `Practice`-Zustand ersetzt. Datenzugriff erfolgt nicht direkt aus dem UI-Code.

### 12.2 Reihenfolge für die Umsetzung

1. Datenmodell, IndexedDB-Repository und Fehlerbehandlung.
2. Migration/Validierung sowie initiale Datensatz-JSON-Datei aus der vorhandenen Wortliste.
3. Bibliothek/Empty State und Set-/Sektion-Navigation.
4. Vokabeleditor mit dauerhafter Speicherung.
5. Ein zentraler Importablauf inkl. Diff, Update und Replace.
6. Set-/Teil-Export und vollständiges Backup/Restore.
7. Übungsmodi an frei gewählte Daten anbinden und Lernereignisse persistieren.
8. UX-Politur, mobile Tests, Regressionstest und ergänzende Dokumentation.

Diese Reihenfolge priorisiert zunächst Datenintegrität und einen funktionsfähigen Datenlebenszyklus; die didaktische Vertiefung folgt als nächster großer Schwerpunkt nach dem Scope der ersten ausgebauten Version.

---

## 13. Teststrategie und Abnahmekriterien

Tests sind außerhalb der ausgelieferten HTML-Datei erlaubt; Produktionscode benötigt dennoch keine externe Runtime-Abhängigkeit. Reine Domain-Funktionen werden isoliert getestet. Zusätzlich sind Integrationstests mit echter IndexedDB und manuelle Tests auf realen Mobilgeräten erforderlich.

### 13.1 Unit-Tests

Mindestens folgende Bereiche:

- JSON parsen, Schema-Version prüfen und Fehlermeldungen erzeugen;
- erforderliche Felder, optionalen Metadaten, leere Strings und ungültige Typen prüfen;
- doppelte Set-/Sektion-/Eintrags-IDs erkennen;
- ID-lose frische Dateien normalisieren und IDs vergeben;
- Set-ID und Scope zuordnen;
- Update-Diff, Replace-Diff für komplettes Set und Replace-Diff für Teilsektionen;
- Update löscht nie unbeabsichtigt nicht enthaltene Einträge;
- Replace löscht nur innerhalb seines expliziten Scope;
- fehlende IDs lösen keine wortbasierte, stillschweigende Zuordnung aus;
- Änderung optionaler Felder und Reihenfolge gemäß Merge-Regeln;
- Review-Events pro Versuch erzeugen, `firstAttempt` korrekt behandeln und Kennzahlen korrekt aggregieren;
- Dateinamen bereinigen, unbekannte Versionen zurückweisen und Sicherheitsgrenzen einhalten.

### 13.2 IndexedDB-Integrationstests

- Installation auf leerem Speicher;
- Schreiben/Lesen mehrerer Sets;
- Set-, Progress- und Review-Änderungen erfolgreich gemeinsam committen;
- erzwungener Fehler führt zu vollständigem Rollback;
- Importpreview ist nicht bereits eine schreibende Aktion;
- Revision-Konflikt zwischen Vorschau und Commit wird erkannt;
- Backup liest einen konsistenten Snapshot;
- Restore ersetzt alle vorgesehenen Stores in einer Transaktion;
- fehlerhaftes Backup lässt existierende Daten unverändert;
- Upgrade von jeder unterstützten DB-Version;
- Speicher-Quota-/Abort-/DB-unavailable-Fehler werden abgefangen.

### 13.3 End-to-End-Testfälle

**A. Erststart und Onboarding**
1. App mit leerer DB öffnen.
2. Empty State erklärt den ersten Schritt und bietet Import sowie Format-Hilfe.
3. Eine gültige ID-lose JSON-Datei importieren.
4. Set erscheint in der Bibliothek; eine erste Lernsitzung kann ohne manuelles Refresh gestartet werden.

**B. Korrekturworkflow**
1. Vorhandenes Set mit mehreren Sektionen anlegen.
2. Mindestens einen Eintrag üben, damit Lernfortschritt existiert.
3. Set bzw. zwei Sektionen exportieren.
4. Datei extern verändern: Worttext korrigieren, einen Eintrag hinzufügen und einen vorhandenen Eintrag löschen.
5. Als Update zurückimportieren: geänderter Eintrag wird aktualisiert, neuer Eintrag ergänzt, nicht enthaltener Eintrag bleibt erhalten, andere Sektionen bleiben unberührt.
6. Dasselbe als Replace für den expliziten Scope wiederholen: fehlender Eintrag wird nach Bestätigung entfernt, nicht betroffene Sektionen bleiben erhalten.
7. Prüfen, dass das Review-Historienmaterial für bestehende IDs weiterhin zugeordnet bleibt und gelöschte Einträge keine aktive Karte mehr erzeugen.

**C. Fehler und Konflikte**
1. Ungültiges JSON und eine nicht unterstützte Formatversion auswählen.
2. Doppelte IDs sowie widersprüchliche Scope-Angaben testen.
3. Während die Vorschau offen ist, dasselbe Set in einem anderen Tab ändern.
4. In allen Fällen darf kein Teilimport und kein unbemerkter Datenverlust auftreten.

**D. Vollständige Wiederherstellung**
1. Set, mehrere Lernereignisse, Sitzungsverlauf und nichtstandardmäßige Präferenzen anlegen.
2. Vollständiges Backup herunterladen.
3. Daten löschen bzw. in einer frischen DB starten.
4. Backup importieren und Wiederherstellung bestätigen.
5. Sets, Sortierung, Lernstand, Verlauf und Präferenzen mit dem Ausgangszustand vergleichen.
6. Fehlerhafte Backupdatei sowie Restore-Abbruch prüfen.

### 13.4 Browser- und Gerätetestmatrix

Die genauen Mindestversionen werden vor Release festgelegt. Mindestens praktisch zu prüfen:

| Umgebung | Prüffokus |
|---|---|
| Safari auf iOS/iPadOS, reales iPhone und iPad soweit verfügbar | IndexedDB-Persistenz, Dateiauswahl, Downloadverhalten, Touch/Gesten, Tastatur-/Viewport-Verhalten |
| Chrome auf Android, reales Android-Gerät | IndexedDB, Dateiauswahl und Download in Dateien-App, Rotation, Wischgesten, Bildschirmtastatur |
| Safari auf macOS | Speichern, Import/Export, lokale Datei (`file://`) und statisches HTTPS |
| Chrome oder Edge Desktop | Standardpfad, parallele Tabs, Backup/Restore und Tastaturbedienung |
| Firefox Desktop | IndexedDB, Import/Export, Tastatur und `file://`-Besonderheiten |

`file://` und statisches HTTPS werden als unterschiedliche Betriebsarten separat getestet. Ein erfolgreicher Test in einer Browserfamilie darf nicht als Beleg für andere Browser gelten.

### 13.5 UX-/Accessibility-Prüfungen

- Alle kritischen Pfade auf einem schmalen Smartphone-Viewport funktionieren ohne horizontales Scrollen.
- Touch-Ziele sind vorzugsweise 44 × 44 CSS-Pixel; mindestens die geltenden WCAG-2.2-AA-Anforderungen an Zielgrößen/Abstände werden geprüft.
- sichtbarer Tastaturfokus und logische Fokusreihenfolge;
- Wischgesten sind nicht erforderlich, wenn sichtbare Buttons dasselbe leisten;
- Fehlermeldungen erscheinen in passendem Kontext und sagen, was als Nächstes getan werden kann;
- Empty State und Hilfe enthalten keine Begriffe wie „ID“, „Revision“ oder „IndexedDB“, ohne diese für Nutzende verständlich zu erklären.
- Testperson ohne Vorwissen kann ein neues Set importieren und eine Übung starten, ohne eine externe Anleitung lesen zu müssen.

### 13.6 Performance-Ziele

Für das erwartete Schulvokabelmaterial muss sich die Anwendung auf typischen Mobilgeräten flüssig anfühlen. Als erste technische Testgröße wird ein Set mit 3.000 Einträgen und ein Backup mit mehreren Sets verwendet; der Import soll ohne Browserstillstand und ohne blockierende Langaufgabe erfolgen. Bei großen Dateien können Validierung und Diff ggf. in mehreren Arbeitsschritten erfolgen, jedoch ohne externe Worker-Datei vorauszusetzen. Messwerte werden bei der ersten Implementierung real erhoben und anschließend als konkrete Release-Grenzen dokumentiert; die Zahl 3.000 ist ein Testfixture-Ziel, kein künstliches Produktlimit.

---

## 14. Technische Akzeptanzkriterien

Die Architektur ist implementierungsseitig abnahmefähig, wenn alle folgenden Punkte erfüllt sind:

1. Die ausgelieferte App ist eine einzelne HTML-Datei; Kernfunktionen funktionieren ohne externe Runtime-Ressourcen.
2. Es gibt keine hardcodierte Sprache oder Klassenstufe in der Lernlogik.
3. IndexedDB ist primärer Speicher; Schreibfehler werden abgefangen.
4. Die Kernentitäten und Lernereignisse sind getrennt gespeichert; Set-Struktur und Reihenfolge bleiben erhalten.
5. Das Importformat ist versioniert; ID-lose frische Dateien werden unterstützt.
6. Der gemeinsame Import erkennt bekannte Sets durch Set-ID und fordert nur die dafür nötigen Entscheidungen an.
7. Update und Replace besitzen präzise, getestete Semantik für ganze Sets und ausgewählte Sektionen.
8. Preview verändert keine Daten; Commit prüft Set-Revision und schreibt atomar.
9. Ein fehlerhafter Import oder Restore verändert keine bestehenden Daten.
10. Export und Wiederherstellung bilden einen geprüften Round-Trip, der Lernfortschritt und Einstellungen bewahrt.
11. Eingelesene Daten werden nicht als HTML oder JavaScript ausgeführt.
12. Set-Dokumentation und JSON Schema werden zusammen mit Testfixtures bereitgestellt und mit dem Runtime-Validator abgeglichen.
13. Der Empty State führt zum Import des ersten Sets; Hilfetexte sind kontextuell, kurz und nicht blockierend.
14. Die zentralen Abläufe sind auf den wichtigsten mobilen Browsern praktisch getestet; Grenzen des `file://`-Modus sind dokumentiert.
15. Lernereignisse werden dauerhaft gespeichert; späterer Spaced-Repetition- und Freitextmodus erfordert keinen grundsätzlichen Wechsel der Datenbank.

---

## 15. Offene Entscheidungen und Risiken

Die folgenden Punkte sind bewusst nicht als unumstößlich festgelegt und sollten vor bzw. während der Implementierung entschieden werden.

### 15.1 Unterstützung von `file://`

**Risiko:** Der Browser kann persistenten Speicher für eine direkt geöffnete lokale HTML-Datei anders behandeln als für eine statisch gehostete HTTPS-Seite. Browser- und Versionsunterschiede können die Zusage „dauerhaft lokal gespeichert“ schwächen.

**Empfehlung:** Statisches HTTPS als vollständig unterstützten Zielpfad festlegen; `file://` als Best Effort dokumentieren und auf den Zielgeräten testen. Falls direkte Datei-Nutzung eine harte Muss-Anforderung für iOS/Safari wird, ist ein eigener technischer Spike erforderlich, bevor die Implementierung als zuverlässig zugesagt wird.

### 15.2 Eine oder mehrere Dateien für Begleitdokumentation

Die Laufzeit-App bleibt eine HTML-Datei. Formatspezifikation, JSON Schema, Beispielsets und Tests müssen jedoch nicht in dieser einen Datei stecken. Empfohlen werden getrennte, menschenlesbare Artefakte:

- `TDD_Vokabeltrainer_Allgemein_v1.md`
- `Vokabelset-Format_v1.md`
- `vokabeltrainer-set.schema.json`
- Beispiel eines neuen Sets ohne IDs
- Beispiel eines exportierten Sets/Teil-Sets mit IDs
- Testfixtures für gültige und ungültige Importe

### 15.3 Entfernte IDs und mögliche Dubletten

Wenn eine externe Bearbeitung IDs löscht, ist eine sichere Zuordnung bestehender Lernstände nicht garantiert. V1 verwendet keine unsichtbare Wort-Fuzzy-Zuordnung. Ein mögliches Duplikat wird erkannt soweit Name und Sprachpaar als Indikator dienen, aber die Person muss entscheiden, ob sie als neues Set importiert oder abbricht. Eine spätere optionale, interaktive Zuordnung ist gesondert zu spezifizieren.

### 15.4 Inhaltliche Änderungen und Lernstand

Eine einfache Rechtschreibkorrektur sollte den Lernstand bewahren; eine grundlegend geänderte Bedeutung kann den bisherigen Kenntnisstatus entwerten. V1 bewahrt die Historie bei derselben ID und zeigt im Lernmodus den aktuellen Text. Eine automatische Erkennung semantisch bedeutender Änderung wird nicht versprochen. Eine spätere Lernlogik kann Einträge als „Inhalt geändert – erneut prüfen“ markieren, wenn sich bestimmte bewertungsrelevante Felder ändern.

### 15.5 Backup-Größe und Speicherdauer

Die erwarteten Sets sind textbasiert und klein, aber die Lernhistorie wächst über die Zeit. Es gibt zunächst keine automatische Datenbereinigung. Bei langen Nutzungszeiträumen muss geprüft werden, ob eine manuelle Lösch-/Archivierungsoption für alte Review-Events sinnvoll ist. Eine solche Bereinigung darf ohne Backup-/Bestätigungskonzept keine Daten unbemerkt vernichten.

### 15.6 Lokale Spracheingabe

Spracheingabe ist in späteren Iterationen nachrangig. Die Browser-Spracherkennung mit lokalem Modus ist laut aktueller MDN-Dokumentation experimentell und benötigt installierte Sprachpakete; die Verfügbarkeit ist nicht browserübergreifend gleich. Deshalb ist dies kein Bestandteil der ersten ausgebauten Version. Bei späterer Umsetzung ist lokaler Modus ausdrücklich zu prüfen und ein stiller Cloud-Fallback auszuschließen.

---

## 16. Quellen und Recherchegrundlage

Die folgenden Quellen stützen vor allem die technischen Randbedingungen. Produktentscheidungen wie die Aufteilung in Stores, die Merge-Semantik und die Importoberfläche sind Architekturentscheidungen für dieses Projekt und keine Vorgaben der Webstandards. Quellen wurden am **18. Oktober 2026** geprüft.

1. **MDN – IndexedDB API**: Beschreibung als asynchrone, strukturierte clientseitige Datenbank mit Indizes; Hinweis auf Same-Origin-Bezug.  
   https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
2. **MDN – Using IndexedDB**: praktische Nutzung, Fehler-/Shutdown-Verhalten und Transaktionsbehandlung.  
   https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
3. **W3C – Indexed Database API 3.0**: Transaktionen schützen vor konkurrierenden Änderungen; atomare Commit-/Rollback-Semantik.  
   https://www.w3.org/TR/IndexedDB/
4. **MDN – Storage quotas and eviction criteria**: browserabhängige Speicherlimits und Eviction; best-effort versus persistent storage.  
   https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
5. **MDN – StorageManager.persist()**: persistente Speicherung kann angefragt werden, aber Browser entscheiden, ob sie gewährt wird; sichere Kontexte erforderlich.  
   https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
6. **MDN – Window.localStorage**: Verhalten von `file:`-URLs ist nicht definiert und kann zwischen Browsern abweichen. Die gleiche Vorsicht ist beim Betriebsmodus direkter lokaler Dateien generell erforderlich.  
   https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
7. **MDN – Same-origin policy**: Datei-Origin kann opak bzw. implementierungsabhängig sein; Herkunft ist relevant für den Zugriff auf lokale Browserdaten.  
   https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy
8. **JSON Schema – Draft 2020-12**: Standardisierte Schemaspezifikation zur maschinellen Validierung von JSON-Daten.  
   https://json-schema.org/draft/2020-12
9. **RFC 5646 / BCP 47 – Tags for Identifying Languages**: standardisierte Struktur von Sprachkennungen für Sprachinhalte.  
   https://www.rfc-editor.org/rfc/rfc5646
10. **MDN – File API**: Zugriff auf vom Nutzer ausgewählte Dateien per Dateiinput und Lesen ihrer Inhalte.  
    https://developer.mozilla.org/en-US/docs/Web/API/File_API
11. **MDN – HTMLAnchorElement.download**: weit verbreiteter Weg, einen Link als Download anzubieten; der tatsächliche Download hängt weiterhin vom Browser ab.  
    https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/download
12. **W3C – WCAG 2.2**: Mindestzielgröße für Pointer-Ziele von 24 × 24 CSS-Pixeln unter den spezifizierten Ausnahmen; die im Design empfohlene größere Touchfläche ist darüber hinausgehende UX-Praxis.  
    https://www.w3.org/TR/WCAG22/
13. **MDN – SpeechRecognition.processLocally**: lokale Spracherkennung ist als experimentell gekennzeichnet. Nur relevant für den späteren Ausblick, nicht für den Umfang dieser Version.  
    https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally

---

## 17. Kurzfassung der Architekturentscheidungen

| Thema | Entscheidung für V1 |
|---|---|
| Laufzeit | Eine HTML-Datei mit eingebettetem CSS/JavaScript, keine Runtime-Abhängigkeiten |
| Hosting | Statisches HTTPS als empfohlener, persistenter Betriebsweg; `file://` separat testen und als Best Effort behandeln |
| Speicherung | IndexedDB, getrennte Stores für Sets, Fortschritt, Ereignisse, Sitzungen, Einstellungen und Meta |
| Set-Struktur | Ein Set als atomar gespeichertes Dokument; Sektionen und Einträge verschachtelt |
| IDs | UUID-ähnliche stabile IDs; bei neuen externen Sets optional, bei App-Exporten erforderlich |
| Sprachkennungen | BCP 47 |
| Setformat | `vokabeltrainer-set`, Version 1; JSON Schema 2020-12 als externe Referenz + eingebauter Validator |
| Import | Ein Einstieg, automatische Erkennung anhand Set-ID, Vorschau vor Schreibvorgang |
| Update | Nicht destruktiv: fehlende Einträge werden beibehalten |
| Replace | Destruktiv ausschließlich im ausgewiesenen Scope, mit deutlicher Löschvorschau und Bestätigung |
| Atomarität | Schreiben über IndexedDB-Transaktionen; Revision-Check gegen veraltete Vorschau |
| Backup | Separates, versioniertes Komplettformat; Restore validiert zuerst und ersetzt atomar |
| Lernfortschritt | Zeitgestempelte Review-Events plus Progress-Zusammenfassung; kein voreilig festgelegter SRS-Algorithmus |
| UX | Mobile-first, Empty State, kurze Kontext-Hilfe, keine Pflichttour |
| Didaktik | Bestehende Karteikarten/MC-Funktionen erhalten; Lernalgorithmus, freie Eingabe und Aussprache später ausbauen |
| Spracheingabe | Nicht in V1; niedrigste spätere Priorität |
