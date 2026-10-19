# Product Requirements Document (PRD)

## Allgemeiner, mobiler Vokabeltrainer

**Version:** 2.2 – Review eingearbeitet (Speicherschutz, statisches Hosting, Import per Text, Antwortprotokoll, Meilensteine)  
**Stand:** 19. Oktober 2026  
**Status:** Entwurf für die nächste Entwicklungsiteration  
**Ausgangspunkt:** Bestehender HTML-Prototyp „Vokabeltrainer Englisch“  
**Entstehung und Autorenschaft:** siehe Kapitel 13 (Änderungshistorie)

---

## 1. Produktvision

Der Vokabeltrainer ist eine **mobile-first, lokal arbeitende Web-App**, mit der Lernende Vokabeln verschiedener Sprachen, Lernstufen und Lehrwerke in einer persönlichen Bibliothek verwalten, lernen und dauerhaft wiederholen können.

Die App wird über statisches Hosting bereitgestellt und lässt sich auf dem Smartphone wie eine App zum Home-Bildschirm hinzufügen. Sie besteht im Kern aus einer HTML-Datei mit eingebettetem JavaScript und CSS, ergänzt nur um die für Installation und Offline-Betrieb nötigen Dateien. Sie benötigt weder ein Backend noch ein Benutzerkonto. Vokabelsets können aus dokumentierten JSON-Dateien oder per eingefügtem Text importiert, in der App bearbeitet, zum externen Korrigieren exportiert und anschließend gezielt aktualisiert werden. Ein vollständiger Export ermöglicht den Umzug auf ein anderes Gerät.

Die App soll nicht auf ein bestimmtes Lehrwerk, eine Sprache oder ein Schuljahr festgelegt sein. Die im Prototyp eingebetteten Vokabeln stammen aus einem Lehrwerk; sie werden weder in der App noch in Beispiel- oder Testdaten unverändert verwendet (siehe FR-32).

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
- Keine native App aus einem App-Store; das Produkt bleibt eine eigenständige, installierbare Web-App.
- Keine Benutzerprofile. Teilen sich mehrere Lernende ein Gerät, teilen sie auch Bibliothek und Lernstand; das wird bewusst in Kauf genommen.
- Keine Pflicht, Lernmaterial aus einem bestimmten Schulbuch oder für eine bestimmte Klassenstufe zu verwenden.

---

## 2. Zielgruppen und Nutzungssituationen

### 2.1 Primäre Zielgruppe

Schülerinnen und Schüler ab etwa 10 Jahren sowie andere Lernende, die Vokabeln regelmäßig auf einem Smartphone oder Tablet üben. Die Bedienung muss ohne technische Vorkenntnisse und ohne Unterstützung durch Eltern oder Lehrkräfte verständlich sein.

### 2.2 Sekundäre Zielgruppe

Eltern, Lehrkräfte und Lernende, die Vokabelmaterial zusammenstellen, korrigieren, strukturieren, sichern oder mit anderen teilen.

### 2.3 Zentrale Nutzungssituationen

- Ein Kind importiert ein neues Vokabelset und beginnt direkt mit dem Lernen.
- Lernende wechseln zwischen mehreren Sprachen, Lernstufen, Lehrwerken und Sektionen.
- Eine Person öffnet die App zum ersten Mal und sieht noch keine Vokabelsets; sie versteht, wie sie beginnen kann, und findet den Import ihres ersten Sets.
- Bei einer weniger vertrauten Aktion – zum Beispiel dem Aktualisieren eines bestehenden Sets oder dem Wiederherstellen eines Backups – erhält die Person bei Bedarf eine kurze Erklärung genau an dieser Stelle.
- Ein Set wird aus einem Foto, einer Buchseite, einer Wortliste oder einer anderen Quelle extern erstellt und als JSON importiert.
- Ein Kind kopiert in der App eine Prompt-Vorlage, lässt ein LLM daraus und aus einem Foto der Vokabelseite ein Set erzeugen, kopiert die Antwort und fügt sie direkt in der App ein – ohne eine Datei speichern zu müssen.
- Ein Kind übt längere Zeit nicht (z. B. in den Ferien); Sets und Lernstand dürfen dadurch nicht unbemerkt verloren gehen.
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

Wenn noch keine Vokabelsets vorhanden sind, dient ein klarer Empty State als Onboarding: Er erklärt knapp, was die App ermöglicht und was der nächste sinnvolle Schritt ist, und bietet eine eindeutig erkennbare primäre Aktion zum Importieren des ersten Sets. Als sekundäre Wege stehen „Beispielset ausprobieren“ und „Leeres Set anlegen“ zur Verfügung. Eine leicht erreichbare Hilfe mit Formatbeispiel und einer kopierbaren Prompt-Vorlage für LLMs soll den Einstieg unterstützen. Ein obligatorischer, mehrstufiger Einführungstour-Dialog ist nicht erforderlich. Derselbe hilfreiche Leerzustand wird auch angezeigt, wenn die Bibliothek später wieder leer ist.

### 3.3 Lokal und selbstbestimmt

Vokabelsets, Lernfortschritt und Einstellungen bleiben im Browser des verwendeten Geräts. Die App sendet keine Lern- oder Vokabeldaten an einen Server. Ein Export ist jederzeit möglich.

Browser können lokale Daten von sich aus löschen – Safari auf iOS etwa bei Websites, die einige Tage nicht genutzt wurden, sofern die App nicht zum Home-Bildschirm hinzugefügt wurde. Die App schützt die Daten deshalb aktiv: Sie fordert dauerhaften Speicher beim Browser an, empfiehlt verständlich die Installation auf dem Home-Bildschirm und erinnert an ein Backup, wenn das letzte zu lange zurückliegt.

### 3.4 Einfacher Import statt technischer Importmodi

Es gibt einen zentralen, verständlichen Import-Einstieg. Inhalte können dort als Datei ausgewählt oder als Text eingefügt werden; beide Wege führen durch denselben Ablauf. Die App entscheidet anhand der Datei und vorhandener IDs, ob ein neues Set hinzugefügt oder ein bekanntes Set aktualisiert werden kann. Nutzende werden nur dann zu einer Auswahl aufgefordert, wenn sie für die sichere Übernahme wirklich nötig ist. Fachbegriffe wie „interne ID“ müssen in der normalen Bedienoberfläche nicht im Vordergrund stehen.

### 3.5 Inhalte bleiben unabhängig von der App bearbeitbar

Das JSON-Format ist offen dokumentiert, versioniert, menschenlesbar und für LLMs leicht zu erzeugen und zu korrigieren. Eine externe Bearbeitung soll insbesondere dann möglich sein, wenn ein Set zuvor aus der App exportiert wurde.

### 3.6 Lernfortschritt gehört zum Inhalt, nicht zur Datei zum Teilen

Ein normales Vokabelset enthält Lerninhalte, aber keine persönlichen Lernhistorien oder Einstellungen. Diese werden im lokalen Anwendungsbestand gespeichert und nur im vollständigen Backup mitgenommen.

### 3.7 Didaktischer Nutzen vor zusätzlichen Effekten

Neue Lernfunktionen sollen nachweisbar beim Behalten, Abrufen und gezielten Wiederholen helfen. Optische Spielereien oder Sprachtechnik haben geringere Priorität als gute Lernabläufe und verlässliche Daten.

---

## 4. Informationsarchitektur und Datenmodell auf Produktebene

Die App verwaltet mehrere unabhängige Vokabelsets in einer persönlichen Bibliothek. Die Datenhierarchie lautet:

**Bibliothek → Vokabelset → geordnete Sektionen → Vokabeleinträge**

Lernsprache, Bedeutungssprache und Lernstufe sind **Eigenschaften eines Sets**, keine eigenen Navigationsebenen. Die Bibliothek nutzt sie zum Gruppieren, Sortieren und Filtern, z. B. als Liste nach Lernsprache gruppiert. Bei wenigen Sets darf die Navigation keine zusätzlichen Ebenen erzwingen; Sets ohne Lernstufe erscheinen ganz normal in ihrer Sprachgruppe.

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

Ein Eintrag enthält die darzustellende Form und die Bedeutung beziehungsweise Übersetzung. Das Format muss mehrere gültige Antwortvarianten und optionale Hinweise ermöglichen, ohne zusätzliche Felder für jede Sprache verpflichtend zu machen.

Dabei sind zwei Fälle zu unterscheiden, die im Prototyp beide mit „;“ getrennt sind:

- **Varianten derselben Bedeutung** (Synonyme, Schreibweisen, Kurzformen), z. B. *car* → „Auto; Wagen“ – jede davon ist eine gleichwertig richtige Antwort.
- **Verschiedene Bedeutungen** eines Wortes, z. B. *bank* → „Bank (Geldinstitut)“ und „Ufer“ oder *to miss* → „vermissen“ und „verpassen“ – sie können getrennt angezeigt, abgefragt und später getrennt bewertet werden.

Das Format muss beide Fälle abbilden können; für einfache Einträge bleibt eine einzelne Bedeutung ohne Zusatzstruktur ausreichend. Beispiele, Grammatikhinweise, Genus, Pluralformen, Stammformen, Notizen, Quelle und Bearbeitungsstatus sind optionale Erweiterungsmöglichkeiten.

Einträge und Sektionen benötigen stabile Identitäten, wenn der Inhalt exportiert und später wieder importiert wird. Bei neu erstellten Sets dürfen solche IDs in der Importdatei fehlen; die App vergibt sie beim Import. IDs aus einem Export müssen bei einer externen Korrektur erhalten bleiben, damit Änderungen zuverlässig zugeordnet und Lernstände bewahrt werden können.

---

## 5. Umfang der nächsten ausgebauten Version

Die folgende Version verallgemeinert den bestehenden Prototyp und ergänzt die fehlende lokale Datenverwaltung. Sie ist kein vollständiger Neustart der Anwendung; vorhandene Lernfunktionen werden weiterverwendet, soweit sie zur Produktvision passen.

### 5.1 In Scope – verbindliche Anforderungen

- Verwaltung mehrerer Sprachen, Lernstufen, Vokabelsets und Sektionen.
- Import neuer Sets aus einem dokumentierten JSON-Format, auch wenn die Datei keine internen IDs enthält – per Dateiauswahl oder per eingefügtem Text.
- Wiedererkennen vorhandener Sets anhand erhaltener IDs und Aktualisierung über denselben Import-Einstieg.
- Einfache Importvorschau und verständliche Validierungsfehler.
- Bearbeiten, Ergänzen, Löschen und Umsortieren von Vokabeln und Sektionen.
- Export eines vollständigen Vokabelsets sowie ausgewählter Sektionen.
- Sicheres Aktualisieren beziehungsweise Ersetzen des importierten Inhaltsbereichs, ohne nicht betroffene Sektionen zu verändern.
- Vollständiger Backup-Export aller lokal gespeicherten Sets, Lernstände, Lernhistorien und Einstellungen sowie Wiederherstellung auf einem anderen Gerät.
- Lokale, dauerhafte Speicherung ohne Backend; IndexedDB ist als primärer Speicher vorgesehen.
- Aktiver Schutz vor Datenverlust durch den Browser: Anfrage nach dauerhaftem Speicher, Empfehlung zur Installation auf dem Home-Bildschirm, Backup-Erinnerung.
- Persistente Präferenzen und Lernfortschritte über das Schließen und erneute Öffnen der App hinweg; jede Antwort wird protokolliert.
- Weiterführung der vorhandenen Übungsformen und Sitzungsfunktionen, angepasst an die neue Set-Struktur.
- Dokumentation des Importformats mit Schema, Beispielen, Regeln, einer kopierbaren Prompt-Vorlage und Hinweisen für LLM-gestützte Erstellung und Korrektur.
- Ein rechtlich unbedenkliches Beispielset (Englisch–Deutsch, Niveau etwa 6. Klasse), das zugleich als Testdatensatz dient (FR-32). Die Vokabeln des Prototyps werden nicht unverändert übernommen.
- Bereitstellung über statisches Hosting als installierbare, offline nutzbare Web-App.

### 5.2 Bewusst nicht Teil dieser Version

- Automatische Synchronisierung zwischen Geräten.
- Benutzerprofile oder Cloud-Accounts.
- Integrierte OCR- oder LLM-Verarbeitung.
- Freie Texteingabe als Bewertungsmodus (LATER, siehe Kapitel 11, Priorität 2). Das Datenformat bereitet sie über Antwortvarianten bereits vor.
- Verpflichtende Aussprache- oder Spracheingabefunktionen.
- Start der App direkt aus einer lokal gespeicherten Datei (`file://`); dieser Startmodus wird nicht unterstützt.
- Zusammenführen eines Backups mit vorhandenen Daten; eine Wiederherstellung ersetzt immer den gesamten lokalen Bestand.

### 5.3 Meilensteine innerhalb der Version

Die Anforderungen werden in folgender Reihenfolge umgesetzt. Jeder Meilenstein ergibt eine nutzbare App; der Schutz der Daten kommt bewusst früh.

| Meilenstein | Inhalt | Wesentliche Anforderungen |
|---|---|---|
| **M1 – Lernen mit eigenen Sets** | Datenhaltung, Bibliothek, Import neuer Sets (Datei und Text), Löschen von Sets, Empty State mit Prompt-Vorlage und Beispielset, Lernsitzungen mit dauerhaftem Antwortprotokoll, Präferenzen, Hosting und Offline-Betrieb | FR-01, FR-02 (ohne „Leeres Set anlegen“), FR-03 (Anzeigen und Auswählen), FR-05–13, FR-16, FR-20–28, FR-30, FR-32 |
| **M2 – Daten sichern** | Vollständiges Backup und Wiederherstellung, Speicherschutz und Backup-Erinnerung | FR-19, FR-31 |
| **M3 – Inhalte pflegen und teilen** | Vokabeleditor, leeres Set anlegen, Sektionen anlegen, umbenennen, umsortieren und löschen, Export von Sets und Sektionen | FR-02 (Leeres Set anlegen), FR-03 (Bearbeiten), FR-04, FR-18 |
| **M4 – Korrigieren und aktualisieren** | Erkennen bekannter Sets, Aktualisieren und Ersetzen (auch einzelner Sektionen), Warnung bei lokalen Änderungen seit dem Export | FR-14, FR-15, FR-17, FR-29 |

FR-06 (Schutz vor Datenverlust) und FR-16 (Vorschau und Validierung) gelten in jedem Meilenstein für die dort hinzukommenden Aktionen.

---

## 6. Funktionale Anforderungen

Prioritäten: **MUST** = erforderlich für die nächste ausgebaute Version; **SHOULD** = sinnvoll, sofern ohne Gefährdung der Kernanforderungen umsetzbar; **LATER** = spätere Iteration. Die Reihenfolge der Umsetzung ergibt sich aus den Meilensteinen in Abschnitt 5.3.

Neu hinzugekommene Anforderungen erhalten fortlaufende Nummern ab FR-29 und stehen in ihrem thematischen Abschnitt, damit bestehende Verweise (z. B. im TDD) gültig bleiben.

### 6.1 Bibliothek und Navigation

**FR-01 – Mehrere Sprachen und Lernstufen (MUST)**  
Die App muss mehrere Lernsprachen und Bedeutungssprachen sowie mehrere Schuljahre beziehungsweise Lernstufen parallel unterstützen. Keine Sprache und keine Klassenstufe darf fest in der Programm-Logik vorausgesetzt werden.

**FR-02 – Vokabelsets (MUST)**  
Nutzende können mehrere Vokabelsets importieren, als leeres Set anlegen und wieder löschen. Das Löschen eines Sets wird vorab mit Umfang (Sektionen, Einträge, betroffener Lernstand) angekündigt. Sets besitzen Titel und Sprachangaben sowie optionale Metadaten. Die App zeigt Sets und zugehörige Sektionen übersichtlich an, nach Lernsprache gruppiert (siehe Kapitel 4).

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
Die bestehende Kombination aus Karteikarten und Multiple Choice bleibt erhalten. Karteikarten können aufgedeckt und als „gewusst“ oder „nochmal“ bewertet werden.

Für die Bedienwege gilt:

- Jede Aktion ist über einen sichtbaren Button erreichbar; Tastatur und Wischgesten sind Ergänzungen.
- Eine Eingabe (Tippen, Wischen, Taste) löst genau eine Aktion aus; Doppelauslösungen, etwa Aufdecken und Bewerten durch dieselbe Geste, sind ausgeschlossen.
- Eine Bewertung per Wischgeste ist erst nach dem Aufdecken möglich. Ob Wischen vor dem Aufdecken die Karte aufdeckt oder ignoriert wird, wird bewusst festgelegt und einheitlich umgesetzt.

Für Multiple Choice gilt: Die falschen Antwortmöglichkeiten stammen aus demselben Set und von derselben Sprachseite wie die richtige Antwort. Sie dürfen weder mit der richtigen Antwort noch mit einer ihrer akzeptierten Varianten übereinstimmen. Enthält die Auswahl zu wenige geeignete Einträge, wird die Frage als Karteikarte gestellt.

**FR-10 – Fehlerwiederholung in der Sitzung (MUST)**  
Falsch beantwortete Vokabeln können innerhalb derselben Sitzung erneut abgefragt werden. Am Sitzungsende werden mindestens die Erstversuchsquote und die beim ersten Versuch falsch beantworteten Vokabeln angezeigt. Fehler können erneut geübt werden.

**FR-11 – Lernstand dauerhaft speichern (MUST)**  
Die App speichert Lernresultate über Sitzungen hinweg als Protokoll **jeder einzelnen Antwort**. Pro Antwort werden mindestens gespeichert: der Eintrag, die Abfragerichtung, die Abfrageform (Karteikarte oder Multiple Choice), das Ergebnis, ob es der erste Versuch in der Sitzung war, die Sitzung und der Zeitpunkt. Dieses Protokoll ist die Grundlage für spätere Funktionen wie verteiltes Wiederholen (Kapitel 11) und darf deshalb nicht auf Zusammenfassungen verkürzt werden.

Ein einfacher Überblick über bisherige Lernergebnisse muss möglich sein. Er zeigt mindestens pro Set und Sektion die Zahl der Sitzungen, das Datum der letzten Sitzung und die Erstversuchsquote der letzten Sitzungen. Der Lernstand darf nicht ausschließlich im flüchtigen Arbeitsspeicher existieren.

**FR-12 – Sitzung unterbrechen und fortsetzen (MUST)**  
Eine vorzeitig beendete Sitzung zeigt einen verständlichen Zwischenstand und erlaubt, die Sitzung fortzusetzen. Der aktuelle Sitzungszustand muss bei einem versehentlichen Neuladen nicht zwingend erhalten bleiben; abgeschlossene Lernergebnisse müssen aber dauerhaft gespeichert sein.

### 6.4 Import, Aktualisierung und Export

**FR-13 – Ein zentraler Importablauf (MUST)**  
Die App bietet einen einzigen, leicht auffindbaren Einstieg zum Importieren. Dort können Inhalte entweder als Datei ausgewählt oder als Text eingefügt werden, etwa direkt aus der Antwort eines LLMs. Beim Einfügen werden übliche Begleitformatierungen wie Markdown-Codeblöcke um das JSON herum toleriert. Neue Sets ohne interne IDs müssen ohne manuelle ID-Erstellung importierbar sein. Die App prüft die Datei, vergibt bei Bedarf IDs und führt verständlich durch die Übernahme.

**FR-14 – Erkennen bestehender Sets (MUST)**  
Enthält eine Importdatei IDs, die zu einem lokal gespeicherten Set gehören, soll die App dieses Set erkennen und eine einfache Vorschau der Änderungen zeigen. Nutzende müssen nicht in mehreren voneinander unabhängigen Importwerkzeugen arbeiten.

**FR-15 – Kontextbezogene Übernahme (MUST)**  
Bei einem neuen Set wird der Import als neues Set angeboten. Bei einem bekannten Set werden nur die zur sicheren Übernahme nötigen Optionen eingeblendet: Änderungen übernehmen, ohne nicht enthaltene Einträge automatisch zu löschen, oder den im Export bezeichneten Bereich durch den Importinhalt ersetzen. Ein Import einzelner Sektionen darf andere Sektionen nicht verändern.

**FR-16 – Vorschau und Validierung (MUST)**  
Vor der Übernahme zeigt die App in einfacher Form an, welches Set beziehungsweise welcher Bereich betroffen ist und wie viele Einträge neu, geändert, unverändert oder entfernt werden. Ungültige Dateien erhalten verständliche Fehlermeldungen. Das Importieren muss vor der Änderung des lokalen Bestands validiert werden.

**FR-17 – Stabiler Korrekturworkflow (MUST)**  
Ein aus der App exportiertes Set oder eine Auswahl an Sektionen muss extern korrigiert und erneut importiert werden können. Stabile IDs und der exportierte Umfang müssen erhalten beziehungsweise erkannt werden, damit bestehende Einträge aktualisiert und nicht betroffene Bereiche geschützt werden. Wenn notwendige Identifikatoren fehlen oder widersprüchlich sind, muss die App dies erklären und darf keine stillschweigende, unsichere Zuordnung vornehmen.

**FR-29 – Lokale Änderungen seit dem Export (MUST)**  
Wurden Einträge oder Sektionen eines Sets nach dem Export, aus dem die Importdatei stammt, in der App geändert, darf ein erneuter Import diese Änderungen nicht stillschweigend überschreiben. Die Vorschau weist betroffene Einträge gesondert aus und zeigt bei Bedarf beide Fassungen. Nutzende entscheiden, ob die importierte Fassung übernommen oder die lokale Fassung behalten wird; mindestens eine gemeinsame Entscheidung für alle betroffenen Einträge muss möglich sein.

**FR-30 – Doppelte Importe erkennen (MUST)**  
Wird ein Set ohne IDs importiert, das einem vorhandenen Set offensichtlich entspricht (z. B. gleicher Titel, gleiche Sprachen und weitgehend gleiche Einträge), weist die App vor der Übernahme darauf hin und bietet an, den Import abzubrechen oder dennoch als weiteres Set anzulegen.

**FR-18 – Export von Lerninhalten (MUST)**  
Nutzende können ein komplettes Vokabelset oder ausgewählte Sektionen als JSON exportieren. Dieser Export enthält keine persönliche Lernhistorie oder App-Einstellungen. Die Reihenfolge, Metadaten, IDs und der exportierte Umfang bleiben soweit vorhanden erhalten.

**FR-19 – Vollständiges Backup und Wiederherstellung (MUST)**  
Nutzende können alle lokal gespeicherten Daten einschließlich Sets, Sektionen, IDs, Lernfortschritt, Lernhistorie und Einstellungen in einem Backup exportieren und auf einem anderen Gerät wiederherstellen. Die Wiederherstellung ersetzt immer den gesamten lokalen Bestand; ein Zusammenführen ist nicht vorgesehen. Sie zeigt vorab den Umfang des Backups und warnt, wenn vorhandene lokale Daten ersetzt werden. Ein Backup ist klar von einem gewöhnlichen Vokabelset-Export unterscheidbar. Die App merkt sich den Zeitpunkt des letzten erfolgreichen Backup-Exports.

**FR-20 – Dokumentiertes JSON-Format (MUST)**  
Es gibt eine separate, verständliche Spezifikation des Vokabelset-Formats mit Versionsregel, Pflicht- und optionalen Feldern, Beispielen, Regeln für stabile IDs, Sektionen und Antwortvarianten sowie Anweisungen für LLMs. Mindestens ein Minimalbeispiel für ein neu erstelltes Set und ein Beispiel für einen exportierten, später zu korrigierenden Datensatz sind erforderlich.

Zusätzlich gilt:

- Die App enthält eine **kopierbare Prompt-Vorlage**, mit der ein LLM aus einem Foto, einer Buchseite oder einer Wortliste ein importierbares Set erzeugt, sowie eine Vorlage für die Korrektur eines exportierten Sets unter Erhalt der IDs.
- Die Beispiele in der Spezifikation verwenden ausschließlich Inhalte, die die Anforderungen aus FR-32 erfüllen.

**FR-32 – Rechtlich unbedenkliches Beispielset (MUST)**  
Die App liefert ein Beispielset mit, das im Empty State über „Beispielset ausprobieren“ geladen werden kann und zugleich als realistischer Testdatensatz dient. Dafür gilt:

- **Inhalt:** Englisch–Deutsch auf dem Niveau von etwa Klasse 6, etwa 3 bis 5 Sektionen mit je 10 bis 20 Einträgen. Es enthält bewusst Einträge mit Varianten, mehreren Bedeutungen und optionalen Zusatzangaben, damit es die Möglichkeiten des Formats zeigt.
- **Keine Übernahme aus dem Prototyp:** Die im Prototyp eingebetteten Lehrwerksvokabeln dürfen nicht unverändert verwendet werden – weder in der App noch in Beispiel-, Test- oder Dokumentationsdaten.
- **Herkunft:** Zulässig ist genau einer dieser Wege:
  1. eine nachweislich frei lizenzierte Quelle,
  2. eine eigene Auswahl aus allgemein gebräuchlichem Grundwortschatz, unabhängig von Wortliste, Reihenfolge und Struktur eines bestimmten Lehrwerks,
  3. eine ausreichende Verfremdung der Prototyp-Vokabeln: mindestens eigene Sektionsnamen und ein eigener Zuschnitt der Sektionen, sodass weder Auswahl noch Anordnung des Lehrwerks erkennbar bleiben.

  In allen Fällen sind die Sektionen eigenständig benannt und zugeschnitten (z. B. thematisch: Schule, Freizeit, Essen und Trinken, Reisen).
- **Dokumentation:** Herkunft und Lizenz sind in den Metadaten des Sets und in der Formatspezifikation angegeben (bei Eigenzusammenstellung z. B. als frei verwendbar unter CC0). Bei einer fremden Quelle werden deren Lizenzbedingungen eingehalten, einschließlich einer gegebenenfalls nötigen Namensnennung.

### 6.5 Einstellungen und lokale Datenhaltung

**FR-21 – Präferenzen lokal speichern (MUST)**  
Relevante Präferenzen wie Theme, Standard-Abfragerichtung und weitere vorhandene Einstellungen werden lokal gespeichert und in den vollständigen Backup-Export aufgenommen.

**FR-22 – Lokale Persistenz (MUST)**  
Die App verwendet IndexedDB oder eine für strukturierte lokale Daten nachweislich geeignete Alternative als primären Speicher. Vokabelsets, Lernstand und Einstellungen müssen in derselben Browserinstallation nach einem Neustart verfügbar bleiben, solange die Browserdaten nicht gelöscht wurden. Die App fordert beim Browser dauerhaften Speicher an, damit dieser die Daten nicht von sich aus entfernt.

**FR-23 – Speicherprobleme verständlich behandeln (MUST)**  
Wenn der Browser Daten nicht speichern kann oder eine Wiederherstellung scheitert, zeigt die App eine verständliche Meldung. Sie darf nicht fälschlich so tun, als seien Daten dauerhaft gespeichert worden.

**FR-31 – Speicherschutz und Backup-Erinnerung (MUST)**  
Gewährt der Browser keinen dauerhaften Speicher, erklärt die App kurz und verständlich, dass Daten bei längerer Nichtnutzung verloren gehen können, und empfiehlt den passenden Schutz – auf iOS/iPadOS insbesondere das Hinzufügen zum Home-Bildschirm, mit einer kurzen Anleitung für diesen Schritt. Liegt der letzte Backup-Export länger als 14 Tage zurück oder wurde noch nie ein Backup erstellt, obwohl Sets oder Lernstand vorhanden sind, erinnert die App unaufdringlich daran und bietet den Backup-Export direkt an. Die Erinnerung lässt sich für eine Weile zurückstellen, blockiert aber nie das Lernen.

### 6.6 Oberfläche und Datenschutz

**FR-24 – Mobilfreundliche Oberfläche (MUST)**  
Die App ist für kleine Touchscreens zuerst gestaltet. Häufige Aktionen sind leicht erreichbar, Touch-Flächen ausreichend groß, Inhalte lesbar und Dialoge auch auf kleinen Displays bedienbar. Desktoplayout ist ebenfalls möglich.

**FR-25 – Heller und dunkler Modus (SHOULD)**  
Heller und dunkler Modus werden unterstützt; eine Systemeinstellung kann berücksichtigt werden. Eine manuelle Einstellung hat Vorrang, wenn sie angeboten wird.

**FR-26 – Keine Datenübertragung (MUST)**  
Kernfunktionen benötigen keinen Backend-Dienst. Vokabeldaten, Lernhistorie und Einstellungen werden nicht automatisch an externe Dienste übertragen. Es dürfen keine externen Bibliotheken oder CDNs erforderlich sein, um die Kernfunktionen zu nutzen.

**FR-27 – Verständliche Oberfläche (MUST)**  
Die Benutzeroberfläche verwendet klare, für Lernende ab etwa 10 Jahren verständliche deutsche Texte, eindeutige Beschriftungen und verständliche Rückmeldungen. Häufige Aufgaben und ihre Folgen sollen möglichst aus der Oberfläche selbst hervorgehen. Interne technische Konzepte wie Datenbank- oder ID-Verwaltung werden von der normalen Bedienoberfläche ferngehalten.

**FR-28 – Kontextbezogene Hilfe und Erststart-Onboarding (MUST)**  
Wenn eine Aktion nicht ausreichend selbsterklärend ist oder eine folgenreiche Entscheidung erfordert, zeigt die App eine kurze Erklärung direkt am betreffenden Bereich oder Schritt. Hilfetexte sind konkret, handlungsorientiert und auf das notwendige Maß begrenzt; sie kompensieren keine grundsätzlich unklare Navigation oder Beschriftung. Bei leerer Vokabelbibliothek zeigt die App einen Empty State, der den Zweck der App knapp erklärt, den nächsten Schritt sichtbar macht und eine primäre Aktion zum Import des ersten Vokabelsets anbietet. Sekundär werden „Beispielset ausprobieren“ und „Leeres Set anlegen“ angeboten. Von dort sind Hinweise zum Importformat, ein Beispiel und die kopierbare Prompt-Vorlage für LLMs (FR-20) leicht erreichbar. Das Onboarding blockiert die Nutzung nicht und erscheint nicht als aufdringliche, obligatorische Tour. Der Empty State wird immer dann verwendet, wenn keine Sets vorhanden sind.

---

## 7. Anforderungen an Datenformat und Datenintegrität

Diese Anforderungen legen fest, **was** das Format gewährleisten muss. Die konkrete technische Umsetzung und das genaue Schema werden im zugehörigen TDD beziehungsweise in der Formatspezifikation ausgearbeitet.

1. **Versionierung:** Jede Datei muss als zu einer unterstützten Formatversion gehörig erkennbar sein.
2. **LLM-Tauglichkeit:** Feldnamen, Typen und Beispiele sind konsistent und ohne implizites Vorwissen verständlich.
3. **Einfache Erstellung:** IDs sind für neu erstellte externe Sets optional. Sprachangaben und grundlegende Vokabelinhalte sind erforderlich; Herkunft, Quelle und Bearbeitungsstatus bleiben optional.
4. **Stabile Identität:** Bei App-Exporten enthalten Set, Sektionen und Einträge stabile IDs. Externe Korrekturen sollen diese IDs unverändert beibehalten.
5. **Antwortvarianten und Bedeutungen:** Pro Sprachseite kann es eine angezeigte Hauptform und mehrere ausdrücklich akzeptierte Varianten geben. Zusätzlich kann ein Eintrag mehrere unterscheidbare Bedeutungen haben (siehe 4.5). Diese Struktur bereitet spätere Eingabemodi vor.
6. **Sprachunabhängigkeit:** Sprachkennungen dürfen nicht auf Englisch und Deutsch beschränkt sein.
7. **Teil-Export:** Ein Export muss erkennen lassen, welche Sektionen enthalten sind, damit beim Reimport nur der beabsichtigte Bereich bearbeitet wird.
8. **Sichere Verarbeitung:** Importierte Daten werden als Daten behandelt, nicht als ausführbarer Code oder HTML.
9. **Atomare Übernahme:** Wenn Validierung oder Speicherung fehlschlägt, bleibt der vorherige Datenbestand unverändert.
10. **Fortschritt schützen:** Inhaltliche Änderungen sollen Lernfortschritt zuordnen können, solange stabile IDs erhalten bleiben. Wird ein Eintrag gelöscht oder seine Identität unklar, muss die App diese Situation nachvollziehbar behandeln.

---

## 8. Nicht-funktionale Anforderungen

### 8.1 Bereitstellung und Offline-Verhalten

- Die Anwendung wird über statisches Hosting (z. B. GitHub Pages) per HTTPS ausgeliefert. Das ist der einzige unterstützte Startmodus; das direkte Öffnen einer lokal gespeicherten Datei (`file://`) wird nicht unterstützt.
- Die Anwendung besteht im Kern aus einer HTML-Datei mit eingebettetem CSS und JavaScript. Zusätzliche Dateien sind nur für Installation und Offline-Betrieb vorgesehen (z. B. Web-App-Manifest, Service Worker, App-Icon).
- Die App ist als Web-App zum Home-Bildschirm hinzufügbar und startet nach dem ersten Laden auch ohne Netzwerkverbindung vollständig.
- Kein eigener Server, keine Anmeldung, kein Backend und keine externen Runtime-Abhängigkeiten.
- Aktualisierungen der App dürfen gespeicherte Daten nicht gefährden. Eine neue App-Version wird erst aktiv, wenn keine Lernsitzung oder Bearbeitung läuft.

### 8.2 Zielgeräte

- Vorrang: Smartphones und Tablets, mit besonderem Augenmerk auf iOS/Safari und Android/Chrome – jeweils sowohl im Browser als auch als zum Home-Bildschirm hinzugefügte Web-App.
- Zusätzlich: gängige Desktopbrowser.
- Der genaue Umfang unterstützter Browserversionen wird in der technischen Spezifikation und Tests festgelegt.

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

1. **Neues Set:** Ein gültiges Set ohne interne IDs kann über den zentralen Importablauf sowohl als Datei als auch als eingefügter Text (auch innerhalb eines Markdown-Codeblocks) als neues Set übernommen werden. Die App vergibt benötigte IDs automatisch.
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
14. **Erststart:** Bei einer leeren Bibliothek erklärt der Empty State knapp, wie die App funktioniert, und bietet einen gut erkennbaren Weg zum Import des ersten Sets samt schnell auffindbarer Format-Hilfe und Prompt-Vorlage sowie die Möglichkeit, ein Beispielset auszuprobieren. Neue Nutzende müssen weder die interne Datenstruktur noch die Bedeutung von IDs kennen.
15. **Kontextbezogene Hilfe:** Bei Import, Aktualisierung, Ersetzung und Backup-Wiederherstellung sind die jeweils wichtigen Folgen vor der Bestätigung verständlich erklärt. Hinweise stehen am passenden Schritt und verlangen keine Suche in einer separaten Anleitung.
16. **Nicht aufdringliche Führung:** Die Kernwege bleiben ohne obligatorische Einführungstour nutzbar. Hilfetexte behindern die Bedienung auf einem kleinen Bildschirm nicht und ersetzen keine notwendigen Verbesserungen an Navigation, Beschriftungen oder Rückmeldungen.
17. **Antwortprotokoll:** Nach einer Sitzung ist für jede beantwortete Frage ein Protokolleintrag mit Eintrag, Richtung, Abfrageform, Ergebnis, Erstversuch-Kennzeichen und Zeitpunkt gespeichert und im Backup enthalten. Der Lernüberblick zeigt pro Set und Sektion Sitzungszahl, letzte Sitzung und Erstversuchsquote.
18. **Lokale Änderungen:** Ein Set wird exportiert, danach wird ein Eintrag in der App geändert und derselbe Eintrag in der Exportdatei extern geändert. Beim Reimport weist die Vorschau den Konflikt aus; ohne Entscheidung der Nutzenden wird die lokale Änderung nicht überschrieben.
19. **Doppelter Import:** Wird dieselbe Datei ohne IDs zweimal importiert, weist die App beim zweiten Mal auf das vorhandene, entsprechende Set hin.
20. **Speicherschutz:** Gewährt der Browser keinen dauerhaften Speicher, erscheint ein verständlicher Hinweis mit Handlungsempfehlung. Liegt kein oder nur ein über 14 Tage altes Backup vor, erinnert die App daran, ohne das Lernen zu blockieren.
21. **Installation und Offline-Start:** Die App kann auf iOS und Android zum Home-Bildschirm hinzugefügt werden und startet nach dem ersten Laden auch im Flugmodus mit allen Daten.
22. **Multiple Choice:** In einer Bibliothek mit Sets in mindestens zwei Lernsprachen stammen alle falschen Antwortmöglichkeiten aus dem Set und von der Sprachseite der jeweiligen Frage; keine falsche Antwort entspricht einer akzeptierten Variante der richtigen.
23. **Beispielset:** Das Beispielset lässt sich aus dem Empty State laden und üben; Einträge mit Varianten und mehreren Bedeutungen sind korrekt abgebildet. Herkunft und Lizenz sind dokumentiert, und Sektionsnamen und -zuschnitt stammen nicht aus dem Prototyp oder einem Lehrwerk.

### 9.1 Produktindikatoren für spätere Evaluation

- Lernende können ohne Anleitung ein neues Set importieren und eine erste Sitzung starten.
- Der Wechsel zwischen Set- und Sektionsebene ist verständlich.
- Die Erstversuchsquote für wiederholt geübte Sektionen entwickelt sich über mehrere Sitzungen nachvollziehbar.
- Nutzende können den externen Korrekturworkflow durchführen, ohne versehentlich andere Sektionen oder ihren Lernfortschritt zu verlieren.
- Neue Nutzende finden beim ersten Aufruf aus dem Empty State heraus den Import ihres ersten Vokabelsets; potenzielle Missverständnisse bei Import und Wiederherstellung werden durch kurze kontextbezogene Erklärungen reduziert.

Diese Indikatoren sind Ziele für eine spätere Evaluation und keine bereits nachgewiesenen Ergebnisse.

---

## 10. Risiken und offene Punkte für das TDD

1. **Datenlöschung durch den Browser:** Browser können lokal gespeicherte Daten entfernen – insbesondere Safari auf iOS/iPadOS bei Websites, die einige Tage nicht genutzt wurden und nicht zum Home-Bildschirm hinzugefügt sind. Verhalten mit und ohne Installation sowie mit und ohne gewährten dauerhaften Speicher muss auf den Zielgeräten praktisch geprüft und dokumentiert werden. Backup-Erinnerung und Installationsempfehlung (FR-31) sind die wichtigsten Gegenmaßnahmen.
2. **Identität nach externer Bearbeitung:** Entfernte oder geänderte IDs erschweren ein sicheres Update. Das Format muss die Erhaltung von IDs für Korrekturen klar erklären; mehrdeutige Fälle benötigen eine sichere, verständliche Behandlung.
3. **Replace und Teil-Exporte:** Der Umfang einer Ersetzung muss in der Datei erkennbar sein, damit nicht versehentlich das gesamte Set ersetzt wird.
4. **Lernfortschritt bei inhaltlichen Änderungen:** Es muss festgelegt werden, wann die Historie erhalten bleibt und wann eine Änderung so wesentlich ist, dass ein bisheriger Beherrschungsstatus zurückgesetzt oder als überprüfungsbedürftig markiert wird.
5. **Datenmigration:** Künftige Versionen benötigen einen Plan für Änderungen am Datenmodell und am lokalen Speicher.
6. **Importqualität:** Das Format muss ausdrucksstark genug für verschiedene Sprachen sein, dabei aber für manuelle und LLM-gestützte Erstellung einfach bleiben.
7. **Backup-Wiederherstellung:** Das Produkt muss klar zwischen dem Import von Lerninhalten und dem Ersetzen des vollständigen persönlichen Datenbestands unterscheiden.
8. **Änderungserkennung seit dem Export:** Für FR-29 muss festgelegt werden, woran die App erkennt, dass ein Eintrag seit einem bestimmten Export lokal geändert wurde, und wie der Bezug einer Importdatei zu diesem Export hergestellt wird.
9. **Duplikaterkennung:** Für FR-30 sind Kriterien festzulegen, die echte Duplikate zuverlässig erkennen, ohne ähnliche, aber gewollt getrennte Sets (z. B. zwei Auflagen eines Lehrwerks) fälschlich zu melden.
10. **Qualität eingefügter LLM-Antworten:** LLM-Ausgaben enthalten häufig Begleittext, Codeblöcke oder kleine Formatfehler. Es ist festzulegen, was die App tolerant bereinigt und was sie als verständlichen Fehler meldet.
11. **App-Aktualisierung im Offline-Betrieb:** Der Mechanismus für Offline-Betrieb kann alte App-Versionen zwischenspeichern. Es ist festzulegen, wie neue Versionen zuverlässig, aber ohne Unterbrechung laufender Sitzungen aktiv werden und wie Datenmigrationen dabei ablaufen.

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

---

## 13. Änderungshistorie

| Version | Datum | Änderungen | Entstehung |
|---|---|---|---|
| 2.1 | 18. Oktober 2026 | UX-Prinzipien, kontextbezogene Hilfe und Onboarding ergänzt | KI-gestützter Entwurf mit ChatGPT (OpenAI), Modell GPT-6, in iterativer Zusammenarbeit mit dem Nutzer; Grundlage: Nutzeranforderungen, Anforderungsdialog und HTML-Prototyp. Reasoning-Stufe und Modell-Snapshot-ID nicht als überprüfbare Metadaten verfügbar; Knowledge Cutoff Dezember 2025. |
| 2.2 | 19. Oktober 2026 | Review eingearbeitet: Speicherschutz und Backup-Erinnerung (FR-31), statisches Hosting als installierbare Offline-Web-App statt `file://`, Import per eingefügtem Text und Prompt-Vorlage, Protokoll jeder Antwort (FR-11), Warnung bei lokalen Änderungen seit dem Export (FR-29), Duplikaterkennung (FR-30), Meilensteine (5.3), Hierarchie mit Sprache/Lernstufe als Set-Eigenschaften, Unterscheidung von Varianten und Bedeutungen, Regeln für Multiple-Choice-Antworten und Bedienwege (FR-09), Löschen und Leeranlage von Sets, rechtlich unbedenkliches Beispielset ohne unveränderte Prototyp-Vokabeln (FR-32), Zielalter, Wiederherstellung ersetzt immer, freie Eingabe als LATER, Akzeptanzkriterien 17–23, Risiken 8–11 | Review und Überarbeitung mit Claude (Anthropic), Modell Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer |
