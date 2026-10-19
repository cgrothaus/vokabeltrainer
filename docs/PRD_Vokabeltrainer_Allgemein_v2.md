# Product Requirements Document (PRD)

## Allgemeiner, mobiler Vokabeltrainer

**Version:** 2.1 – UX-Prinzipien und Onboarding ergänzt  
**Stand:** 18. Oktober 2026  
**Status:** Entwurf für die nächste Entwicklungsiteration  
**Ausgangspunkt:** Bestehender HTML-Prototyp „Vokabeltrainer Englisch“  
**KI-Autor:** ChatGPT (OpenAI), Modell **GPT-6**; KI-gestützter Entwurf in iterativer Zusammenarbeit mit dem Nutzer  
**Denkaufwand:** Reasoning-Modell; eine konkrete Stufe (z. B. Medium/High) und eine Modell-Snapshot-ID wurden für diese Erstellung nicht als überprüfbare Metadaten bereitgestellt  
**Knowledge Cutoff:** Dezember 2025 (vortrainiertes Modellwissen)  
**Arbeitsgrundlage:** Nutzeranforderungen, gemeinsamer Anforderungsdialog und bestehender HTML-Prototyp; Autorhinweis ergänzt am 18. Oktober 2026

---

## 1. Produktvision

Der Vokabeltrainer ist eine **mobile-first, lokal arbeitende Web-App**, mit der Lernende Vokabeln verschiedener Sprachen, Lernstufen und Lehrwerke in einer persönlichen Bibliothek verwalten, lernen und dauerhaft wiederholen können.

Die App läuft als einzelne, eigenständige HTML-Datei mit eingebettetem JavaScript und CSS. Sie benötigt weder ein Backend noch ein Benutzerkonto. Vokabelsets können aus dokumentierten JSON-Dateien importiert, in der App bearbeitet, zum externen Korrigieren exportiert und anschließend gezielt aktualisiert werden. Ein vollständiger Export ermöglicht den Umzug auf ein anderes Gerät.

Die App soll nicht auf ein bestimmtes Lehrwerk, eine Sprache oder ein Schuljahr festgelegt sein. Das bisherige Englisch-Set für die 6. Klasse bleibt ein möglicher Inhalt, ist aber kein Bestandteil der Programm-Logik.

### 1.1 Problem

Vokabellisten liegen in unterschiedlichen Lehrwerken, Lernkästen, Arbeitsblättern und selbst erstellten Sammlungen vor. Lernende benötigen eine einfache Möglichkeit, diese Inhalte in einem gemeinsamen Werkzeug zu sammeln und zu üben. Zugleich sollen Vokabelsets mit Unterstützung von Menschen oder LLMs erstellt und qualitätsgesichert werden können, ohne dass Lernfortschritt und persönliche Einstellungen verloren gehen.

### 1.2 Ziele

1. Vokabeln mehrerer Sprachen, Lernstufen und Lehrwerke in einer App verwalten.
2. Auf Smartphones und Tablets besonders einfach und angenehm lernen; Desktop-Nutzung bleibt möglich.
3. Vokabelsets und Lernfortschritt lokal und dauerhaft speichern.
4. Neue Vokabelsets möglichst einfach importieren und vorhandene Inhalte sicher aktualisieren.
5. Vokabeln direkt in der App korrigieren und strukturieren können.
6. Vokabelsets und ausgewählte Sektionen für Weitergabe und externe Qualitätssicherung exportieren.
7. Den vollständigen lokalen Bestand einschließlich Lernfortschritt und Einstellungen sichern und auf einem anderen Gerät wiederherstellen können.
8. Eine dokumentierte, stabile und LLM-freundliche Dateiformatspezifikation bereitstellen.
9. Die Lernfunktionen schrittweise didaktisch verbessern, ohne die grundlegende Architektur später neu aufbauen zu müssen.
10. Die App so intuitiv gestalten, dass neue Nutzende ohne Anleitung beginnen können; kontextbezogene Hilfen unterstützen nur dort, wo die Bedienung allein nicht ausreichend verständlich ist.

### 1.3 Nicht-Ziele

- Keine Benutzerkonten, kein Backend und keine verpflichtende Cloud.
- Keine automatische geräteübergreifende Synchronisierung in der ersten ausgebauten Version.
- Kein eingebauter KI- oder OCR-Dienst. Lernmaterial kann extern, beispielsweise mithilfe eines LLMs oder OCR-Werkzeugs, aufbereitet und danach importiert werden.
- Keine native App aus einem App-Store; das Produkt bleibt eine eigenständige Web-App.
- Keine Pflicht, Lernmaterial aus einem bestimmten Schulbuch oder für eine bestimmte Klassenstufe zu verwenden.

---

## 2. Zielgruppen und Nutzungssituationen

### 2.1 Primäre Zielgruppe

Schülerinnen und Schüler sowie andere Lernende, die Vokabeln regelmäßig auf einem Smartphone oder Tablet üben. Die Bedienung muss ohne technische Vorkenntnisse und ohne Unterstützung durch Eltern oder Lehrkräfte verständlich sein.

### 2.2 Sekundäre Zielgruppe

Eltern, Lehrkräfte und Lernende, die Vokabelmaterial zusammenstellen, korrigieren, strukturieren, sichern oder mit anderen teilen.

### 2.3 Zentrale Nutzungssituationen

- Ein Kind importiert ein neues Vokabelset und beginnt direkt mit dem Lernen.
- Lernende wechseln zwischen mehreren Sprachen, Lernstufen, Lehrwerken und Sektionen.
- Eine Person öffnet die App zum ersten Mal und sieht noch keine Vokabelsets; sie versteht, wie sie beginnen kann, und findet den Import ihres ersten Sets.
- Bei einer weniger vertrauten Aktion – zum Beispiel dem Aktualisieren eines bestehenden Sets oder dem Wiederherstellen eines Backups – erhält die Person bei Bedarf eine kurze Erklärung genau an dieser Stelle.
- Ein Set wird aus einem Foto, einer Buchseite, einer Wortliste oder einer anderen Quelle extern erstellt und als JSON importiert.
- Ein vorhandenes Set wird exportiert, extern geprüft und korrigiert und anschließend aktualisiert.
- Einzelne Sektionen werden exportiert, überarbeitet und zurückgespielt, ohne andere Sektionen unbeabsichtigt zu verändern.
- Lernende üben weiter, nachdem sie die App geschlossen oder das Gerät neu gestartet haben.
- Der gesamte lokale Bestand wird auf ein anderes Gerät übertragen.

---

## 3. Produktprinzipien

### 3.1 Mobile first

Die App wird zuerst für Smartphones gestaltet und anschließend für größere Bildschirme angepasst. Häufige Aufgaben müssen mit wenigen Schritten erreichbar sein. Touch-Flächen, Schriftgrößen, Karten, Slider und Dialoge müssen auf kleinen Bildschirmen gut bedienbar bleiben. Wischgesten sind eine Ergänzung, dürfen aber keine einzige Möglichkeit zur Bedienung darstellen.

### 3.2 Selbsterklärende Bedienung, kontextbezogene Hilfe und Onboarding

Die Oberfläche soll in erster Linie durch klare Struktur, verständliche Bezeichnungen und vorhersehbares Verhalten intuitiv sein. Hilfetexte sind kein Ersatz für gutes UI/UX-Design. Wo sich eine Aktion oder eine wichtige Folge nicht ausreichend aus der Oberfläche erschließt, erhält die Person eine kurze, leicht verständliche Erklärung direkt im passenden Kontext („in-place“). Hilfen sollen relevante Entscheidungen erleichtern, aber nicht dauerhaft ablenken oder den Arbeitsfluss blockieren.

Wenn noch keine Vokabelsets vorhanden sind, dient ein klarer Empty State als Onboarding: Er erklärt knapp, was die App ermöglicht und was der nächste sinnvolle Schritt ist, und bietet eine eindeutig erkennbare primäre Aktion zum Importieren des ersten Sets. Eine leicht erreichbare Hilfe mit Formatbeispiel beziehungsweise Hinweisen zur Erstellung eines importierbaren Sets soll den Einstieg unterstützen. Ein obligatorischer, mehrstufiger Einführungstour-Dialog ist nicht erforderlich. Derselbe hilfreiche Leerzustand wird auch angezeigt, wenn die Bibliothek später wieder leer ist.

### 3.3 Lokal und selbstbestimmt

Vokabelsets, Lernfortschritt und Einstellungen bleiben im Browser des verwendeten Geräts. Die App sendet keine Lern- oder Vokabeldaten an einen Server. Ein Export ist jederzeit möglich. Die App weist verständlich darauf hin, dass lokale Browserdaten kein Ersatz für ein Backup sind.

### 3.4 Einfacher Import statt technischer Importmodi

Es gibt einen zentralen, verständlichen Import-Einstieg. Die App entscheidet anhand der Datei und vorhandener IDs, ob ein neues Set hinzugefügt oder ein bekanntes Set aktualisiert werden kann. Nutzende werden nur dann zu einer Auswahl aufgefordert, wenn sie für die sichere Übernahme wirklich nötig ist. Fachbegriffe wie „interne ID“ müssen in der normalen Bedienoberfläche nicht im Vordergrund stehen.

### 3.5 Inhalte bleiben unabhängig von der App bearbeitbar

Das JSON-Format ist offen dokumentiert, versioniert, menschenlesbar und für LLMs leicht zu erzeugen und zu korrigieren. Eine externe Bearbeitung soll insbesondere dann möglich sein, wenn ein Set zuvor aus der App exportiert wurde.

### 3.6 Lernfortschritt gehört zum Inhalt, nicht zur Datei zum Teilen

Ein normales Vokabelset enthält Lerninhalte, aber keine persönlichen Lernhistorien oder Einstellungen. Diese werden im lokalen Anwendungsbestand gespeichert und nur im vollständigen Backup mitgenommen.

### 3.7 Didaktischer Nutzen vor zusätzlichen Effekten

Neue Lernfunktionen sollen nachweisbar beim Behalten, Abrufen und gezielten Wiederholen helfen. Optische Spielereien oder Sprachtechnik haben geringere Priorität als gute Lernabläufe und verlässliche Daten.

---

## 4. Informationsarchitektur und Datenmodell auf Produktebene

Die App verwaltet mehrere unabhängige Vokabelsets in einer persönlichen Bibliothek. Die Navigation orientiert sich an folgender Hierarchie:

**Lernsprache → Schuljahr/Lernstufe → Vokabelset → geordnete Sektionen → Vokabeleinträge**

Beispiele für Sektionen sind Lektionen, Teile einer Lektion, Lernkästen, Themen oder frei benannte Abschnitte.

### 4.1 Lernsprache und Bedeutungssprache

Jedes Vokabelset legt mindestens die Sprache fest, in der gelernt wird, und die Sprache, in der die Bedeutung angegeben ist. Dadurch sind Abfragen in beide Richtungen möglich. Die Oberfläche ist zunächst auf Deutsch ausgelegt; die Datenstruktur darf nicht auf Deutsch als Bedeutungssprache festgelegt sein.

### 4.2 Schuljahr und Lernstufe

Schuljahr beziehungsweise Lernstufe dienen der Orientierung und Sortierung. Die Angabe soll nicht unnötig eng auf deutsche Schulklassen festgelegt sein; beispielsweise können auch Kursstufen oder freie Niveaubezeichnungen genutzt werden. Für Sets, bei denen diese Information nicht passt oder nicht bekannt ist, sollte sie optional bleiben.

### 4.3 Vokabelset

Ein Set besitzt einen Titel und die für den Betrieb erforderlichen Sprachangaben. Quelle, Lehrwerk, Ausgabe, Lernstufe, Hinweise zur Herkunft und Bearbeitungs- beziehungsweise Prüfstatus sind optionale Metadaten.

### 4.4 Sektionen

Sektionen haben einen Namen und eine definierte Reihenfolge. Sie können einzeln gelernt, ausgewählt, exportiert und aktualisiert werden. Die Reihenfolge muss nach Import und Export erhalten bleiben.

### 4.5 Vokabeleinträge

Ein Eintrag enthält die darzustellende Form und die Bedeutung beziehungsweise Übersetzung. Das Format muss mehrere gültige Antwortvarianten und optionale Hinweise ermöglichen, ohne zusätzliche Felder für jede Sprache verpflichtend zu machen. Beispiele, Grammatikhinweise, Genus, Pluralformen, Stammformen, Notizen, Quelle und Bearbeitungsstatus sind optionale Erweiterungsmöglichkeiten.

Einträge und Sektionen benötigen stabile Identitäten, wenn der Inhalt exportiert und später wieder importiert wird. Bei neu erstellten Sets dürfen solche IDs in der Importdatei fehlen; die App vergibt sie beim Import. IDs aus einem Export müssen bei einer externen Korrektur erhalten bleiben, damit Änderungen zuverlässig zugeordnet und Lernstände bewahrt werden können.

---

## 5. Umfang der nächsten ausgebauten Version

Die folgende Version verallgemeinert den bestehenden Prototyp und ergänzt die fehlende lokale Datenverwaltung. Sie ist kein vollständiger Neustart der Anwendung; vorhandene Lernfunktionen werden weiterverwendet, soweit sie zur Produktvision passen.

### 5.1 In Scope – verbindliche Anforderungen

- Verwaltung mehrerer Sprachen, Lernstufen, Vokabelsets und Sektionen.
- Import neuer Sets aus einem dokumentierten JSON-Format, auch wenn die Datei keine internen IDs enthält.
- Wiedererkennen vorhandener Sets anhand erhaltener IDs und Aktualisierung über denselben Import-Einstieg.
- Einfache Importvorschau und verständliche Validierungsfehler.
- Bearbeiten, Ergänzen, Löschen und Umsortieren von Vokabeln und Sektionen.
- Export eines vollständigen Vokabelsets sowie ausgewählter Sektionen.
- Sicheres Aktualisieren beziehungsweise Ersetzen des importierten Inhaltsbereichs, ohne nicht betroffene Sektionen zu verändern.
- Vollständiger Backup-Export aller lokal gespeicherten Sets, Lernstände, Lernhistorien und Einstellungen sowie Wiederherstellung auf einem anderen Gerät.
- Lokale, dauerhafte Speicherung ohne Backend; IndexedDB ist als primärer Speicher vorgesehen.
- Persistente Präferenzen und Lernfortschritte über das Schließen und erneute Öffnen der App hinweg.
- Weiterführung der vorhandenen Übungsformen und Sitzungsfunktionen, angepasst an die neue Set-Struktur.
- Dokumentation des Importformats mit Schema, Beispielen, Regeln und Hinweisen für LLM-gestützte Erstellung und Korrektur.

### 5.2 Bewusst nicht Teil dieser Version

- Automatische Synchronisierung zwischen Geräten.
- Benutzerprofile oder Cloud-Accounts.
- Integrierte OCR- oder LLM-Verarbeitung.
- Freie Texteingabe als Bewertungsmodus, sofern sie nicht ohne größere Umbauten in die neue Basis passt; sie gehört zunächst in die didaktische Weiterentwicklung.
- Verpflichtende Aussprache- oder Spracheingabefunktionen.

---

## 6. Funktionale Anforderungen

Prioritäten: **MUST** = erforderlich für die nächste ausgebaute Version; **SHOULD** = sinnvoll, sofern ohne Gefährdung der Kernanforderungen umsetzbar; **LATER** = spätere Iteration.

### 6.1 Bibliothek und Navigation

**FR-01 – Mehrere Sprachen und Lernstufen (MUST)**  
Die App muss mehrere Lernsprachen und Bedeutungssprachen sowie mehrere Schuljahre beziehungsweise Lernstufen parallel unterstützen. Keine Sprache und keine Klassenstufe darf fest in der Programm-Logik vorausgesetzt werden.

**FR-02 – Vokabelsets (MUST)**  
Nutzende können mehrere Vokabelsets anlegen beziehungsweise importieren. Sets besitzen Titel und Sprachangaben sowie optionale Metadaten. Die App zeigt Sets und zugehörige Sektionen übersichtlich an.

**FR-03 – Sektionen und Reihenfolge (MUST)**  
Sektionen können angezeigt, ausgewählt, erstellt, umbenannt, umsortiert und – unter Beachtung der enthaltenen Einträge – gelöscht werden. Die Reihenfolge bleibt erhalten.

### 6.2 Inhalte pflegen

**FR-04 – Vokabeleditor (MUST)**  
Nutzende können vorhandene Vokabeln direkt in der App ansehen, korrigieren, ergänzen und löschen. Vokabeln können einer Sektion zugeordnet und innerhalb einer Sektion sortiert werden. Änderungen werden lokal dauerhaft gespeichert.

**FR-05 – Optionale Zusatzinformationen (MUST)**  
Das Datenformat darf optionale Angaben wie gültige Antwortvarianten, Grammatikhinweise, Genus, Pluralformen, Stammformen, Beispiele, Notizen, Quelle und Prüfstatus enthalten. Fehlende optionale Angaben verhindern den Import nicht.

**FR-06 – Schutz vor versehentlichem Datenverlust (MUST)**  
Löschungen und ersetzende Änderungen müssen vor der Übernahme verständlich angekündigt werden. Bei einem fehlerhaften Import darf der bestehende Datenbestand nicht teilweise verändert zurückbleiben.

### 6.3 Lernen

**FR-07 – Auswahl des Lernstoffs (MUST)**  
Lernende können ein Vokabelset, einzelne Sektionen oder mehrere Sektionen auswählen. Die verfügbaren Vokabelzahlen richten sich nach der Auswahl. Eine Auswahl aller oder keiner Sektion ist möglich.

**FR-08 – Konfiguration einer Sitzung (MUST)**  
Die Abfragerichtung lässt sich auf die beiden Sprachrichtungen oder gemischte Richtungen stellen. Die Anzahl der Vokabeln und der Anteil verschiedener Abfrageformen lassen sich festlegen. Der konkrete Standardwert für den Multiple-Choice-Anteil bleibt konfigurierbar.

**FR-09 – Abfrageformen und Bedienung (MUST)**  
Die bestehende Kombination aus Karteikarten und Multiple Choice bleibt erhalten. Karteikarten können aufgedeckt und als „gewusst“ oder „nochmal“ bewertet werden. Buttons, Tastatur und geeignete Wischgesten dürfen dabei nicht zu konkurrierenden, unzuverlässigen Bedienwegen werden.

**FR-10 – Fehlerwiederholung in der Sitzung (MUST)**  
Falsch beantwortete Vokabeln können innerhalb derselben Sitzung erneut abgefragt werden. Am Sitzungsende werden mindestens die Erstversuchsquote und die beim ersten Versuch falsch beantworteten Vokabeln angezeigt. Fehler können erneut geübt werden.

**FR-11 – Lernstand dauerhaft speichern (MUST)**  
Die App speichert Lernresultate über Sitzungen hinweg. Mindestens müssen pro Eintrag und Sitzung die für eine Auswertung notwendigen Ergebnisse und Zeitinformationen erhalten bleiben. Ein einfacher Überblick über bisherige Lernergebnisse muss möglich sein. Der Lernstand darf nicht ausschließlich im flüchtigen Arbeitsspeicher existieren.

**FR-12 – Sitzung unterbrechen und fortsetzen (MUST)**  
Eine vorzeitig beendete Sitzung zeigt einen verständlichen Zwischenstand und erlaubt, die Sitzung fortzusetzen. Der aktuelle Sitzungszustand muss bei einem versehentlichen Neuladen nicht zwingend erhalten bleiben; abgeschlossene Lernergebnisse müssen aber dauerhaft gespeichert sein.

### 6.4 Import, Aktualisierung und Export

**FR-13 – Ein zentraler Importablauf (MUST)**  
Die App bietet einen einzigen, leicht auffindbaren Einstieg zum Importieren. Neue Sets ohne interne IDs müssen ohne manuelle ID-Erstellung importierbar sein. Die App prüft die Datei, vergibt bei Bedarf IDs und führt verständlich durch die Übernahme.

**FR-14 – Erkennen bestehender Sets (MUST)**  
Enthält eine Importdatei IDs, die zu einem lokal gespeicherten Set gehören, soll die App dieses Set erkennen und eine einfache Vorschau der Änderungen zeigen. Nutzende müssen nicht in mehreren voneinander unabhängigen Importwerkzeugen arbeiten.

**FR-15 – Kontextbezogene Übernahme (MUST)**  
Bei einem neuen Set wird der Import als neues Set angeboten. Bei einem bekannten Set werden nur die zur sicheren Übernahme nötigen Optionen eingeblendet: Änderungen übernehmen, ohne nicht enthaltene Einträge automatisch zu löschen, oder den im Export bezeichneten Bereich durch den Importinhalt ersetzen. Ein Import einzelner Sektionen darf andere Sektionen nicht verändern.

**FR-16 – Vorschau und Validierung (MUST)**  
Vor der Übernahme zeigt die App in einfacher Form an, welches Set beziehungsweise welcher Bereich betroffen ist und wie viele Einträge neu, geändert, unverändert oder entfernt werden. Ungültige Dateien erhalten verständliche Fehlermeldungen. Das Importieren muss vor der Änderung des lokalen Bestands validiert werden.

**FR-17 – Stabiler Korrekturworkflow (MUST)**  
Ein aus der App exportiertes Set oder eine Auswahl an Sektionen muss extern korrigiert und erneut importiert werden können. Stabile IDs und der exportierte Umfang müssen erhalten beziehungsweise erkannt werden, damit bestehende Einträge aktualisiert und nicht betroffene Bereiche geschützt werden. Wenn notwendige Identifikatoren fehlen oder widersprüchlich sind, muss die App dies erklären und darf keine stillschweigende, unsichere Zuordnung vornehmen.

**FR-18 – Export von Lerninhalten (MUST)**  
Nutzende können ein komplettes Vokabelset oder ausgewählte Sektionen als JSON exportieren. Dieser Export enthält keine persönliche Lernhistorie oder App-Einstellungen. Die Reihenfolge, Metadaten, IDs und der exportierte Umfang bleiben soweit vorhanden erhalten.

**FR-19 – Vollständiges Backup und Wiederherstellung (MUST)**  
Nutzende können alle lokal gespeicherten Daten einschließlich Sets, Sektionen, IDs, Lernfortschritt, Lernhistorie und Einstellungen in einem Backup exportieren und auf einem anderen Gerät wiederherstellen. Die Wiederherstellung zeigt vorab den Umfang und warnt, wenn vorhandene lokale Daten ersetzt werden. Ein Backup ist klar von einem gewöhnlichen Vokabelset-Export unterscheidbar.

**FR-20 – Dokumentiertes JSON-Format (MUST)**  
Es gibt eine separate, verständliche Spezifikation des Vokabelset-Formats mit Versionsregel, Pflicht- und optionalen Feldern, Beispielen, Regeln für stabile IDs, Sektionen und Antwortvarianten sowie Anweisungen für LLMs. Mindestens ein Minimalbeispiel für ein neu erstelltes Set und ein Beispiel für einen exportierten, später zu korrigierenden Datensatz sind erforderlich.

### 6.5 Einstellungen und lokale Datenhaltung

**FR-21 – Präferenzen lokal speichern (MUST)**  
Relevante Präferenzen wie Theme, Standard-Abfragerichtung und weitere vorhandene Einstellungen werden lokal gespeichert und in den vollständigen Backup-Export aufgenommen.

**FR-22 – Lokale Persistenz (MUST)**  
Die App verwendet IndexedDB oder eine für strukturierte lokale Daten nachweislich geeignete Alternative als primären Speicher. Vokabelsets, Lernstand und Einstellungen müssen in derselben Browserinstallation nach einem Neustart verfügbar bleiben, solange die Browserdaten nicht gelöscht wurden.

**FR-23 – Speicherprobleme verständlich behandeln (MUST)**  
Wenn der Browser Daten nicht speichern kann oder eine Wiederherstellung scheitert, zeigt die App eine verständliche Meldung. Sie darf nicht fälschlich so tun, als seien Daten dauerhaft gespeichert worden.

### 6.6 Oberfläche und Datenschutz

**FR-24 – Mobilfreundliche Oberfläche (MUST)**  
Die App ist für kleine Touchscreens zuerst gestaltet. Häufige Aktionen sind leicht erreichbar, Touch-Flächen ausreichend groß, Inhalte lesbar und Dialoge auch auf kleinen Displays bedienbar. Desktoplayout ist ebenfalls möglich.

**FR-25 – Heller und dunkler Modus (SHOULD)**  
Heller und dunkler Modus werden unterstützt; eine Systemeinstellung kann berücksichtigt werden. Eine manuelle Einstellung hat Vorrang, wenn sie angeboten wird.

**FR-26 – Keine Datenübertragung (MUST)**  
Kernfunktionen benötigen keinen Backend-Dienst. Vokabeldaten, Lernhistorie und Einstellungen werden nicht automatisch an externe Dienste übertragen. Es dürfen keine externen Bibliotheken oder CDNs erforderlich sein, um die Kernfunktionen zu nutzen.

**FR-27 – Verständliche Oberfläche (MUST)**  
Die Benutzeroberfläche verwendet klare, altersgerechte deutsche Texte, eindeutige Beschriftungen und verständliche Rückmeldungen. Häufige Aufgaben und ihre Folgen sollen möglichst aus der Oberfläche selbst hervorgehen. Interne technische Konzepte wie Datenbank- oder ID-Verwaltung werden von der normalen Bedienoberfläche ferngehalten.

**FR-28 – Kontextbezogene Hilfe und Erststart-Onboarding (MUST)**  
Wenn eine Aktion nicht ausreichend selbsterklärend ist oder eine folgenreiche Entscheidung erfordert, zeigt die App eine kurze Erklärung direkt am betreffenden Bereich oder Schritt. Hilfetexte sind konkret, handlungsorientiert und auf das notwendige Maß begrenzt; sie kompensieren keine grundsätzlich unklare Navigation oder Beschriftung. Bei leerer Vokabelbibliothek zeigt die App einen Empty State, der den Zweck der App knapp erklärt, den nächsten Schritt sichtbar macht und eine primäre Aktion zum Import des ersten Vokabelsets anbietet. Von dort sind Hinweise zum Importformat und ein Beispiel leicht erreichbar. Das Onboarding blockiert die Nutzung nicht und erscheint nicht als aufdringliche, obligatorische Tour. Der Empty State wird immer dann verwendet, wenn keine Sets vorhanden sind.

---

## 7. Anforderungen an Datenformat und Datenintegrität

Diese Anforderungen legen fest, **was** das Format gewährleisten muss. Die konkrete technische Umsetzung und das genaue Schema werden im zugehörigen TDD beziehungsweise in der Formatspezifikation ausgearbeitet.

1. **Versionierung:** Jede Datei muss als zu einer unterstützten Formatversion gehörig erkennbar sein.
2. **LLM-Tauglichkeit:** Feldnamen, Typen und Beispiele sind konsistent und ohne implizites Vorwissen verständlich.
3. **Einfache Erstellung:** IDs sind für neu erstellte externe Sets optional. Sprachangaben und grundlegende Vokabelinhalte sind erforderlich; Herkunft, Quelle und Bearbeitungsstatus bleiben optional.
4. **Stabile Identität:** Bei App-Exporten enthalten Set, Sektionen und Einträge stabile IDs. Externe Korrekturen sollen diese IDs unverändert beibehalten.
5. **Antwortvarianten:** Pro Sprachseite kann es eine angezeigte Hauptform und mehrere ausdrücklich akzeptierte Varianten geben. Diese Struktur bereitet spätere Eingabemodi vor.
6. **Sprachunabhängigkeit:** Sprachkennungen dürfen nicht auf Englisch und Deutsch beschränkt sein.
7. **Teil-Export:** Ein Export muss erkennen lassen, welche Sektionen enthalten sind, damit beim Reimport nur der beabsichtigte Bereich bearbeitet wird.
8. **Sichere Verarbeitung:** Importierte Daten werden als Daten behandelt, nicht als ausführbarer Code oder HTML.
9. **Atomare Übernahme:** Wenn Validierung oder Speicherung fehlschlägt, bleibt der vorherige Datenbestand unverändert.
10. **Fortschritt schützen:** Inhaltliche Änderungen sollen Lernfortschritt zuordnen können, solange stabile IDs erhalten bleiben. Wird ein Eintrag gelöscht oder seine Identität unklar, muss die App diese Situation nachvollziehbar behandeln.

---

## 8. Nicht-funktionale Anforderungen

### 8.1 Bereitstellung und Offline-Verhalten

- Die Anwendung wird als einzelne eigenständige HTML-Datei mit eingebettetem CSS und JavaScript ausgeliefert.
- Kein eigener Server, keine Anmeldung, kein Backend und keine externen Runtime-Abhängigkeiten.
- Hosting auf einem statischen Webserver ist möglich; die Anwendung soll nach dem Laden keine Netzwerkverbindung für ihre Kernfunktionen benötigen.
- Die tatsächliche Unterstützung persistenter Browserdaten beim direkten Öffnen über `file://` muss für die Zielbrowser praktisch geprüft und dokumentiert werden. Ein Problem in diesem Startmodus darf nicht unbemerkt zu Datenverlust führen.

### 8.2 Zielgeräte

- Vorrang: Smartphones und Tablets, mit besonderem Augenmerk auf iOS/Safari und Android/Chrome.
- Zusätzlich: gängige Desktopbrowser.
- Der genaue Umfang unterstützter Browserversionen und Startmodi wird in der technischen Spezifikation und Tests festgelegt.

### 8.3 Bedienbarkeit und Barrierearmut

- Bedienung per Touch und Tastatur.
- Wischgesten sind optional und durch sichtbare Buttons ergänzbar.
- Ausreichender Kontrast, verständliche Statusanzeigen und semantisch sinnvolle Steuerelemente.
- Keine Funktion darf ausschließlich durch Farbe oder eine Geste erkennbar beziehungsweise bedienbar sein.
- Hilfetexte sind knapp, kontextbezogen und bei Bedarf erreichbar. Sie dürfen wichtige Steuerelemente nicht verdecken oder unnötige Schritte erzwingen. Die Oberfläche selbst bleibt die primäre Orientierungshilfe.

### 8.4 Zuverlässigkeit

- Import und Wiederherstellung validieren Daten vor der Übernahme.
- Schreibvorgänge dürfen den lokalen Bestand bei Fehlern nicht teilweise überschreiben.
- Die App unterscheidet erfolgreich gespeicherte Daten von noch nicht gesicherten Änderungen.
- Import- und Backupfehler werden verständlich erklärt und lassen den bestehenden Datenbestand unangetastet.

### 8.5 Erweiterbarkeit und Wartbarkeit

- Datenformat, gespeicherte Inhalte und UI-Logik werden konzeptionell sauber getrennt.
- Format- und Datenbankänderungen sind versionierbar und ermöglichen spätere Migrationen.
- Neue Sprachen, optionale grammatische Informationen und weitere Lernmodi erfordern keine grundlegende Neustrukturierung der Daten.

---

## 9. Erfolgskriterien und überprüfbare Akzeptanzkriterien

Die nächste Version gilt als fachlich erfolgreich, wenn mindestens die folgenden Prüfungen bestanden werden:

1. **Neues Set:** Eine gültige JSON-Datei ohne interne IDs kann über den zentralen Importablauf als neues Set übernommen werden. Die App vergibt benötigte IDs automatisch.
2. **Mehrere Sets:** Sets für mindestens zwei verschiedene Lernsprachen und mehrere Lernstufen können parallel gespeichert, geöffnet und geübt werden.
3. **Bearbeitung:** Eine Vokabel kann geändert, ergänzt und gelöscht werden; nach einem Neustart bleiben gültige Änderungen vorhanden.
4. **Round-trip-Korrektur:** Ein Set wird exportiert, extern inhaltlich korrigiert und erneut importiert. Einträge mit erhaltenen IDs werden erkannt und aktualisiert; der Lernfortschritt bleibt ihnen zugeordnet.
5. **Teilbereich:** Werden einzelne Sektionen exportiert und zurückimportiert, bleiben nicht exportierte Sektionen unverändert.
6. **Vorschau:** Vor einer Aktualisierung oder Ersetzung ist erkennbar, welche Bereiche und wie viele Einträge betroffen sind. Abweichungen und Löschungen werden nicht stillschweigend durchgeführt.
7. **Importfehler:** Eine ungültige Datei verändert den bestehenden Datenbestand nicht teilweise.
8. **Lernsitzung:** Die vorhandenen Abfrageformen, Fehlerwiederholung und Erstversuchsauswertung funktionieren mit frei ausgewählten Sets und Sektionen.
9. **Persistenz:** Nach Schließen und erneutem Öffnen sind Vokabelsets, abgeschlossene Lernergebnisse und Einstellungen vorhanden, sofern Browserdaten nicht gelöscht wurden.
10. **Backup:** Ein vollständiges Backup kann auf einer frischen App-Installation wiederhergestellt werden und enthält Sets, IDs, Lernhistorie, Lernstände und Einstellungen.
11. **Keine Übertragung:** Die Kernfunktionen sind ohne Backend nutzbar; Vokabeldaten werden nicht an externe Dienste übertragen.
12. **Mobile Nutzung:** Die zentralen Wege – Set auswählen, Sitzung starten, Karte bewerten, Ergebnis ansehen, Vokabel bearbeiten, importieren und exportieren – funktionieren auf einem Smartphone ohne horizontales Scrollen der Hauptoberfläche.
13. **Dokumentation:** Eine Person oder ein LLM kann anhand der Formatspezifikation ein neues gültiges Set erstellen und versteht, wie IDs bei einer externen Korrektur zu erhalten sind.
14. **Erststart:** Bei einer leeren Bibliothek erklärt der Empty State knapp, wie die App funktioniert, und bietet einen gut erkennbaren Weg zum Import des ersten Sets samt schnell auffindbarer Format-Hilfe. Ein neuer Nutzer muss weder die interne Datenstruktur noch die Bedeutung von IDs kennen.
15. **Kontextbezogene Hilfe:** Bei Import, Aktualisierung, Ersetzung und Backup-Wiederherstellung sind die jeweils wichtigen Folgen vor der Bestätigung verständlich erklärt. Hinweise stehen am passenden Schritt und verlangen keine Suche in einer separaten Anleitung.
16. **Nicht aufdringliche Führung:** Die Kernwege bleiben ohne obligatorische Einführungstour nutzbar. Hilfetexte behindern die Bedienung auf einem kleinen Bildschirm nicht und ersetzen keine notwendigen Verbesserungen an Navigation, Beschriftungen oder Rückmeldungen.

### 9.1 Produktindikatoren für spätere Evaluation

- Lernende können ohne Anleitung ein neues Set importieren und eine erste Sitzung starten.
- Der Wechsel zwischen Set- und Sektionsebene ist verständlich.
- Die Erstversuchsquote für wiederholt geübte Sektionen entwickelt sich über mehrere Sitzungen nachvollziehbar.
- Nutzende können den externen Korrekturworkflow durchführen, ohne versehentlich andere Sektionen oder ihren Lernfortschritt zu verlieren.
- Neue Nutzende finden beim ersten Aufruf aus dem Empty State heraus den Import ihres ersten Vokabelsets; potenzielle Missverständnisse bei Import und Wiederherstellung werden durch kurze kontextbezogene Erklärungen reduziert.

Diese Indikatoren sind Ziele für eine spätere Evaluation und keine bereits nachgewiesenen Ergebnisse.

---

## 10. Risiken und offene Punkte für das TDD

1. **Persistenz bei `file://`:** IndexedDB und Browser-Speicher können sich je nach Browser und Herkunft unterschiedlich verhalten. Die Zielkonfiguration muss praktisch getestet werden.
2. **Identität nach externer Bearbeitung:** Entfernte oder geänderte IDs erschweren ein sicheres Update. Das Format muss die Erhaltung von IDs für Korrekturen klar erklären; mehrdeutige Fälle benötigen eine sichere, verständliche Behandlung.
3. **Replace und Teil-Exporte:** Der Umfang einer Ersetzung muss in der Datei erkennbar sein, damit nicht versehentlich das gesamte Set ersetzt wird.
4. **Lernfortschritt bei inhaltlichen Änderungen:** Es muss festgelegt werden, wann die Historie erhalten bleibt und wann eine Änderung so wesentlich ist, dass ein bisheriger Beherrschungsstatus zurückgesetzt oder als überprüfungsbedürftig markiert wird.
5. **Datenmigration:** Künftige Versionen benötigen einen Plan für Änderungen am Datenmodell und am lokalen Speicher.
6. **Importqualität:** Das Format muss ausdrucksstark genug für verschiedene Sprachen sein, dabei aber für manuelle und LLM-gestützte Erstellung einfach bleiben.
7. **Backup-Wiederherstellung:** Das Produkt muss klar zwischen dem Import von Lerninhalten und dem Ersetzen des vollständigen persönlichen Datenbestands unterscheiden.

Diese Punkte sind im TDD zu konkretisieren; sie sollen nicht durch unklare Annahmen in der Implementierung entschieden werden.

---

## 11. Ausblick und Prioritäten späterer Iterationen

### Priorität 1: Didaktik und Lernwirksamkeit verbessern

- Verteiltes Wiederholen: Vokabeln abhängig vom individuellen Lernstand zu sinnvollen Zeitpunkten erneut abfragen.
- Lernplanung, die neue Vokabeln, fällige Wiederholungen und gezieltes Nachlernen sinnvoll kombiniert.
- Bessere Einschätzung des Beherrschungsgrads einzelner Vokabeln über mehrere Sitzungen hinweg.
- Lernmodi für verschiedene Situationen, beispielsweise kurzfristige Vorbereitung auf einen Test oder langfristigen Aufbau eines Wortschatzes.
- Nutzbare Rückmeldungen und Fortschrittsübersichten, die motivieren, ohne falsche Genauigkeit vorzutäuschen.

### Priorität 2: Aktiver Abruf mit freier Eingabe

- Lernende geben die Übersetzung selbst ein, statt nur aus Auswahlmöglichkeiten zu wählen.
- Die Bewertung berücksichtigt Groß-/Kleinschreibung, überflüssige Leerzeichen, explizit hinterlegte Antwortvarianten und sprachspezifische Schreibweisen.
- Eine begrenzte, nachvollziehbare Fehlertoleranz kann Tippfehler auffangen, darf aber nicht beliebige falsche Übersetzungen akzeptieren.
- Kurzformen wie „jede/-r/-s“ müssen durch explizite akzeptierte Varianten abgebildet werden können, etwa „jeder“, „jede“ und „jedes“.
- Bei unsicheren Fällen soll die App eine faire Rückmeldung ermöglichen, statt eine nicht identische, aber gültige Übersetzung automatisch abzulehnen.

### Priorität 3: Sprachausgabe

- Vokabeln und gegebenenfalls Antworten können vorgelesen werden.
- Die Stimme richtet sich nach der Sprache des Eintrags.
- Verfügbarkeit und Qualität der Stimmen hängen vom Gerät und Browser ab; externe Dienste dürfen nicht stillschweigend vorausgesetzt werden.

### Priorität 4: Spracheingabe

- Die Spracheingabe ist nachrangig gegenüber didaktischen Verbesserungen, freier Texteingabe und Sprachausgabe.
- Falls umgesetzt, hat lokale Verarbeitung Vorrang. Es darf keinen stillen Rückfall auf Cloud-Verarbeitung geben.
- Die Funktion muss pro Browser und Sprache geprüft werden; Tastatureingabe bleibt immer verfügbar.
- Eine unsichere Spracherkennung darf nicht automatisch als Lernfehler gewertet werden, ohne dass Lernende die erkannte Antwort prüfen oder korrigieren können.

### Weitere mögliche Ausbaustufen

- Optionale geräteübergreifende Synchronisierung, falls später ein geeigneter, datenschutzbewusster Mechanismus gewünscht ist.
- Zusätzliche Sprachen, grammatische Merkmale und spezifische Lernmodi.
- Komfortfunktionen zur Unterstützung der externen Erstellung und Qualitätskontrolle von Lernmaterial, ohne die lokale und einfache Grundarchitektur aufzugeben.

---

## 12. Abgrenzung zum technischen Design

Dieses PRD beschreibt das Produktverhalten und überprüfbare Anforderungen. Die konkrete Architektur, IndexedDB-Struktur, Datenmigration, genaue JSON-Spezifikation, Algorithmen für IDs, Importabgleich, atomare Schreibvorgänge und technische Teststrategie werden im **Technical Design Document (TDD)** beschrieben.

Das TDD muss insbesondere sicherstellen, dass die zentrale Produktanforderung erfüllt bleibt: **Ein neues Set lässt sich einfach hinzufügen; ein bekanntes Set lässt sich ebenso einfach und sicher korrigieren und aktualisieren – ohne den Lernfortschritt oder nicht betroffene Inhalte zu verlieren.**
