# Formatspezifikation: Vokabelset-Datei

**Formatkennung:** `vokabeltrainer-set`  
**Formatversion:** 1  
**Dokumentstand:** 29. Oktober 2026

## Wozu diese Beschreibung dient

Der Vokabeltrainer ist eine App zum Vokabellernen auf dem Handy. Lernende üben darin mit Karteikarten und Multiple-Choice-Fragen in beide Richtungen; falsch beantwortete Vokabeln kommen in derselben Runde wieder, und die App merkt sich den Lernstand. Sie läuft im Browser oder als installierte Web-App, ohne Konto und ohne Server: Alle Daten bleiben auf dem Gerät.

Vokabeln kommen als **Vokabelset** in die App, als JSON im Format, das dieses Dokument beschreibt. Meist gibt es eine gedruckte Vorlage, etwa die Vokabelseiten einer Lektion im Schulbuch, ein Arbeitsblatt oder eine handgeschriebene Liste. Der übliche Weg in die App:

1. Lernende fotografieren die Vokabelseiten.
2. Sie geben die Fotos zusammen mit dieser Beschreibung in einen KI-Chat, z. B. ChatGPT, Claude oder Gemini.
3. Der Chat überträgt die Vokabeln von den Fotos in ein Vokabelset und gibt es als JSON-Codeblock aus.
4. Lernende kopieren die Antwort und fügen sie in der App unter „Vokabelset importieren“ ein. Die App zeigt eine Vorschau mit Titel, Sprachen und Sektionen und speichert das Set nach Bestätigung.

Ein zweiter Weg: Ein Set wird aus der App exportiert, von Hand oder in einem KI-Chat geprüft und korrigiert und wieder importiert. Der Lernstand bleibt dabei erhalten (Kapitel 6 bis 9). Kapitel 11 beschreibt beide Wege genauer.

Dieses Dokument richtet sich an

- **Menschen**, die ein Set von Hand schreiben oder prüfen,
- **KI-Assistenten**, die ein Set aus Fotos, einer Buchseite oder einer Wortliste erstellen oder ein exportiertes Set korrigieren (besonders Kapitel 3.1, 4, 5.6 und 10),
- **Programme**, die solche Dateien erzeugen oder prüfen.

Ein maschinenlesbares JSON Schema (Draft 2020-12) liegt als `vokabeltrainer-set.schema.json` neben diesem Dokument (Kapitel 11). Es prüft Aufbau, Typen und Längen; einige Regeln lassen sich darin nicht ausdrücken, etwa doppelte IDs oder das Entfernen von Leerzeichen am Rand. Bei Widersprüchen gilt dieses Dokument.

---

## 1. Das Wichtigste in Kürze

Ein Set entspricht einer Lektion oder einer ähnlich großen Lerneinheit und ist in wenige Sektionen nach den größeren Zwischenüberschriften gegliedert. Ein neues Set braucht nur einen Titel, zwei Sprachen und Sektionen mit Einträgen:

```json
{
  "format": "vokabeltrainer-set",
  "formatVersion": 1,
  "set": {
    "title": "Lektion 4 – In der Stadt",
    "termLanguage": "en",
    "meaningLanguage": "de",
    "level": "Klasse 6"
  },
  "sections": [
    {
      "title": "Unterwegs",
      "entries": [
        { "term": "bus stop", "meanings": ["Bushaltestelle"] },
        { "term": "to miss", "meanings": ["vermissen", "verpassen"] }
      ]
    },
    {
      "title": "Einkaufen",
      "entries": [
        { "term": "money", "meanings": ["Geld"] },
        { "term": "apple", "meanings": ["Apfel"] }
      ]
    }
  ]
}
```

- Ein **Set** ist eine größere Lerneinheit, z. B. eine Lektion; **Sektionen** sind ihre größeren Abschnitte (Kapitel 3.1 und 4).
- `term` ist das Wort in der **Lernsprache** (hier Englisch).
- `meanings` ist eine **Liste von Bedeutungen** in der **Bedeutungssprache** (hier Deutsch).
- IDs werden bei neuen Sets **weggelassen**; die App vergibt sie beim Import.

Ein ausführlicheres Beispiel mit Varianten, mehreren Bedeutungen, Grammatik und Beispielsätzen ist das **Beispielset der App** („Beispielset ausprobieren“ bei leerer Bibliothek). Es ist eine eigene Zusammenstellung aus allgemeinem Grundwortschatz und frei verwendbar unter CC0; beides steht auch in seinen Angaben `source` und `license`.

---

## 2. Aufbau einer Datei

Eine Datei enthält genau ein Set, gegliedert in **Set → Sektionen → Einträge**. Das Set erscheint in der Bibliothek der App als eine Zeile. Seine Sektionen wählt man aus, wenn man eine Lernrunde einrichtet. Ein Eintrag ist eine Vokabel, die als Karteikarte oder Multiple-Choice-Frage abgefragt wird.

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `format` | ja¹ | String | Immer `"vokabeltrainer-set"` |
| `formatVersion` | ja¹ | Ganzzahl | Immer `1` für diese Spezifikation |
| `exportedAt` | nein | String (ISO 8601, UTC) | Exportzeitpunkt; nur informativ, wird von der App bei Exporten gesetzt |
| `scope` | nein | Objekt | Umfang eines Teil-Exports (Kapitel 7). Fehlt er, betrifft die Datei das ganze Set. |
| `set` | ja | Objekt | Angaben zum Set (Kapitel 3) |
| `sections` | ja | Array | Geordnete Liste der Sektionen (Kapitel 4); mindestens eine |

¹ Fehlen `format` und `formatVersion`, nimmt die App tolerant Formatversion 1 an und weist in der Vorschau darauf hin. Eine Datei mit `formatVersion` größer als 1 wird von einer App, die nur Version 1 kennt, mit einem verständlichen Hinweis abgelehnt (Kapitel 12).

Die Reihenfolge der Sektionen im Array und der Einträge innerhalb einer Sektion ist die Reihenfolge in der App. Es gibt keine separaten Sortierfelder.

---

## 3. Das Set (`set`)

### 3.1 Was ein Set ist

Ein Set ist eine **größere, in sich geschlossene Lerneinheit**, mit der man eine Zeit lang arbeitet, typischerweise

- eine Lektion (Unit, Kapitel, Modul) eines Lehrwerks,
- ein Arbeitsblatt oder eine Vokabelliste für eine Klassenarbeit,
- eine eigene Sammlung zu einem Thema.

Ein ganzes Lehrwerk ist **kein** Set; es ergibt so viele Sets, wie es Lektionen hat. So bleibt die Bibliothek übersichtlich: Lernende wählen die aktuelle Lektion aus und sehen pro Set und Sektion, wie gut sie die Vokabeln schon können. Umgekehrt ist eine einzelne Zwischenüberschrift kein eigenes Set, sondern eine Sektion (Kapitel 4).

Stammen die Vokabeln auf den Fotos oder in der Liste aus **mehreren Lektionen**, gehört jede Lektion in ein eigenes Set. Die App übernimmt aus einem eingefügten Text nur das erste Set; jedes Set steht deshalb in einem eigenen JSON-Codeblock und wird für sich kopiert und importiert.

### 3.2 Felder

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `id` | nein² | String | Stabile ID des Sets |
| `rev` | nein² | String | Prüfwert der Set-Angaben beim Export (Kapitel 6) |
| `title` | ja | String, 1–200 Zeichen | Name des Sets in der Bibliothek. Bei einer Lektion am besten ihre Bezeichnung aus der Vorlage mit dem Thema, z. B. „Lektion 4 – In der Stadt“ oder „Unit 2 – My family“. Die Bibliothek sortiert Zahlen in Titeln der Größe nach („Lektion 2“ vor „Lektion 10“). |
| `termLanguage` | ja | Sprachcode | Lernsprache, also die Sprache der Wörter, die gelernt werden, z. B. `"en"`, `"fr"`, `"es"`, `"la"`, `"en-GB"` |
| `meaningLanguage` | ja | Sprachcode | Sprache der Bedeutungen, meist die Muttersprache der Lernenden, z. B. `"de"` |
| `level` | nein | String | Lernstufe frei formuliert, z. B. `"Klasse 6"`, `"A2"`, `"Kursstufe"`. Die Bibliothek gruppiert Sets nach Lernsprache und sortiert sie darin nach Lernstufe und Titel. |
| `textbook` | nein | String | Name des Lehrwerks, aus dem das Set stammt; er gehört hierher und nicht in den Titel |
| `edition` | nein | String | Ausgabe oder Auflage des Lehrwerks |
| `source` | nein | String | Herkunft, z. B. „Arbeitsblatt vom 3. 10.“ oder „eigene Zusammenstellung“ |
| `license` | nein | String | Nutzungsrechte, falls bekannt, z. B. `"CC0"` |
| `notes` | nein | String | Freie Hinweise zum Set; erscheinen in der Set-Ansicht |
| `reviewStatus` | nein | `"unchecked"` oder `"checked"` | Ob das Set als Ganzes geprüft ist |

² Bei neu erstellten Sets weglassen. Bei Dateien, die aus der App exportiert wurden, immer vorhanden und **unverändert zu erhalten**.

**Sprachcodes** folgen BCP 47 (wie in `lang`-Attributen von HTML): zwei oder drei Buchstaben für die Sprache, optional mit Region, z. B. `en`, `en-GB`, `pt-BR`, `de`, `la`.

Optionale Angaben, die aus der Vorlage nicht hervorgehen, etwa Lernstufe oder Lehrwerk, dürfen fehlen.

---

## 4. Sektionen (`sections[]`)

Sektionen gliedern ein Set in **wenige größere Abschnitte**. In der App sind sie

- die Auswahl beim Einrichten einer Lernrunde, z. B. nur „Unterwegs“ üben,
- aufklappbare Abschnitte in der Set-Ansicht, jeweils mit eigenem Lernstand.

Damit das hilft, folgen Sektionen den **größeren Zwischenüberschriften** der Vorlage, etwa den Teilen einer Lektion („Einstieg“, „Text A“, „Text B“) oder ihren Themen. Kleinere Überschriften, Wortfelder, Kästen, Tabellen oder Seitenwechsel ergeben keine eigene Sektion; ihre Einträge gehören zur übergeordneten Überschrift. Eine Sektion mit nur zwei oder drei Einträgen ist meist zu klein. Typisch sind zwei bis sechs Sektionen mit jeweils etwa 10 bis 50 Einträgen. Hat die Vorlage keine Zwischenüberschriften, genügt **eine** Sektion, z. B. mit dem Thema der Lektion als Titel.

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `id` | nein² | String | Stabile ID der Sektion |
| `rev` | nein² | String | Prüfwert des Sektionstitels beim Export |
| `title` | ja | String, 1–200 Zeichen | Name, meist die Zwischenüberschrift der Vorlage, z. B. „Unterwegs“, „Text A“, „Redewendungen“ |
| `entries` | ja | Array | Geordnete Liste der Einträge; darf leer sein |

---

## 5. Einträge (`entries[]`)

### 5.1 Felder

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `id` | nein² | String | Stabile ID des Eintrags |
| `rev` | nein² | String | Prüfwert des Eintragsinhalts beim Export |
| `term` | ja | Antwort | Wort oder Ausdruck in der Lernsprache, so wie er in der Vorlage steht, z. B. „to miss“ oder „la maison“ |
| `meanings` | ja | Array von Antworten, mindestens eine | Bedeutungen in der Bedeutungssprache. Beim Abfragen stehen alle Bedeutungen eines Eintrags gemeinsam auf der Karte (Unterscheidung von Varianten in 5.3). |
| `notes` | nein | String | Hinweis für die Lernenden, z. B. „nur britisches Englisch“, oder auf eine unsichere Stelle, z. B. „unsicher: Foto unscharf“ |
| `examples` | nein | Array | Beispielsätze, je String oder `{ "text", "translation"? }`; `translation` ist die Übersetzung in die Bedeutungssprache |
| `grammar` | nein | Objekt | Grammatische Angaben (5.4) |
| `reviewStatus` | nein | `"unchecked"` oder `"checked"` | `"unchecked"` kennzeichnet einen Eintrag als „ungeprüft“, z. B. weil er auf dem Foto schwer lesbar war |

Notiz, Beispiele und Grammatik erscheinen auf der Rückseite der Karteikarte und in der Set-Ansicht, „ungeprüft“ in der Set-Ansicht am Eintrag.

### 5.2 Antworten: Text und akzeptierte Varianten

`term` und jedes Element von `meanings` ist eine **Antwort**. Eine Antwort kann auf zwei Arten geschrieben werden:

- **Kurzform:** ein String, z. B. `"Apfel"`.
- **Langform:** ein Objekt mit `text` und optional `acceptedVariants`.

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `text` | ja | String, 1–500 Zeichen | So wird die Antwort angezeigt |
| `acceptedVariants` | nein | Array von Strings | Weitere Schreibweisen, die als **gleichwertig richtig** gelten |

`"Apfel"` und `{ "text": "Apfel" }` sind gleichbedeutend. Die App exportiert die Kurzform, wann immer keine Varianten vorhanden sind.

### 5.3 Varianten oder mehrere Bedeutungen?

Das ist die wichtigste inhaltliche Unterscheidung des Formats:

| Fall | Beispiel | So schreiben |
|---|---|---|
| **Eine Bedeutung, mehrere gleichwertige Wörter oder Schreibweisen** (Synonyme, Kurzformen, britisch/amerikanisch) | *car* → Auto oder Wagen | `"meanings": [{ "text": "Auto", "acceptedVariants": ["Wagen"] }]` |
| | *each* → jede/-r/-s | `"meanings": [{ "text": "jede/-r/-s", "acceptedVariants": ["jeder", "jede", "jedes"] }]` |
| | *autumn* (amerikanisch *fall*) → Herbst | `"term": { "text": "autumn", "acceptedVariants": ["fall"] }, "meanings": ["Herbst"]` |
| **Mehrere verschiedene Bedeutungen** eines Wortes | *to miss* → vermissen **und** verpassen | `"meanings": ["vermissen", "verpassen"]` |
| | *bank* → Bank (Geldinstitut) **und** Ufer | `"meanings": ["Bank (Geldinstitut)", "Ufer"]` |

Faustregel: Kann man in jedem Satz das eine Wort durch das andere ersetzen, sind es **Varianten**. Meint man jeweils etwas anderes, sind es **verschiedene Bedeutungen**.

Erläuterungen in Klammern wie „(Geldinstitut)“ gehören zum angezeigten `text`. Für die spätere freie Eingabe kann man die erwartete Eingabe zusätzlich als Variante angeben, z. B. `{ "text": "Bank (Geldinstitut)", "acceptedVariants": ["Bank"] }`.

### 5.4 Grammatik (`grammar`)

Alle Felder sind optional und frei formuliert, damit sie für jede Sprache passen.

| Feld | Typ | Beispiel |
|---|---|---|
| `partOfSpeech` | String | `"verb"`, `"noun"`, `"adjective"` |
| `gender` | String | `"f"`, `"der"`, `"la"` |
| `plural` | String | `"mice"` |
| `forms` | Array von Strings | `["go", "went", "gone"]` |

Beispiel: `{ "term": "to go", "meanings": ["gehen", "fahren"], "grammar": { "partOfSpeech": "verb", "forms": ["go", "went", "gone"] } }`

### 5.5 Texte

- Alle Texte sind **reiner Text**. HTML, Markdown oder Formatierungszeichen werden nicht interpretiert, sondern genau so angezeigt.
- Führende und abschließende Leerzeichen entfernt die App beim Import.
- Pflichttexte (Titel, `term`, Bedeutungen, `text` einer Antwort oder eines Beispiels) dürfen nicht leer sein, ebenso Elemente von Listen (Varianten, Beispiele, Wortformen). Ein Text nur aus Leerzeichen gilt als leer.
- Ein leeres optionales Feld, z. B. `"notes": ""`, `"examples": []` oder `"grammar": {}`, entfernt die App beim Import ohne Rückmeldung. Besser lässt man es weg.

### 5.6 Was wohin gehört

Vokabellisten in Lehrwerken haben oft mehrere Spalten und Zusatzangaben. So verteilen sie sich auf das Format:

| In der Vorlage | Im Set |
|---|---|
| Lektionsbezeichnung und Thema | `title` des Sets; der Name des Lehrwerks in `textbook` |
| Größere Zwischenüberschriften | Sektionen (Kapitel 4) |
| Wort oder Ausdruck in der Lernsprache, wie abgedruckt, also mit „to“, Artikel oder Ergänzungen wie „sb./sth.“ | `term` |
| Übersetzungen, oft durch Komma oder Semikolon getrennt | `meanings` bzw. `acceptedVariants`, je nachdem, ob es verschiedene Bedeutungen oder gleichwertige Wörter sind (5.3) |
| Stammformen unregelmäßiger Verben, Plural, Genus oder Wortart, wenn sie getrennt vom Wort stehen | `grammar` (5.4) |
| Beispielsatz, gegebenenfalls mit Übersetzung | `examples` |
| Hinweise wie „BE“/„AE“, „umgangssprachlich“, Gegenteil oder verwandte Wörter | `notes` |
| Lautschrift | weglassen; dafür gibt es kein Feld |
| Seitenzahlen, Verweise auf Zeilen oder Texte, Nummerierung, Symbole | weglassen |

---

## 6. IDs und Prüfwerte (`id`, `rev`)

IDs verbinden einen Eintrag in der Datei mit demselben Eintrag in der App – und damit mit dem Lernfortschritt. Prüfwerte (`rev`) zeigen der App, ob ein Eintrag seit dem Export in der Datei oder in der App verändert wurde.

**Regeln:**

1. **Neue Sets:** `id` und `rev` überall weglassen.
2. **Exportierte Sets korrigieren:** `id` und `rev` **unverändert lassen** – auch dann, wenn der Eintrag inhaltlich korrigiert wird. Nie neu erfinden, nie entfernen, nie zwischen Einträgen vertauschen.
3. **Neue Einträge oder Sektionen in einer exportierten Datei:** ohne `id` und ohne `rev` ergänzen.
4. Jede `id` darf innerhalb eines Sets nur **einmal** vorkommen.

**Form:** IDs, die die App erzeugt, bestehen aus Kleinbuchstaben und Ziffern (Set: 10 Zeichen, Sektion und Eintrag: 6 Zeichen, z. B. `"a8f2kc"`); `rev`-Werte haben 8 Zeichen. Beim Import akzeptiert die App jede ID und jeden `rev` aus 1–64 Zeichen `A–Z a–z 0–9 _ -`.

**Was passiert, wenn …**

| … | Folge |
|---|---|
| eine `id` fehlt | Der Eintrag gilt als **neu**. Er wird zusätzlich angelegt; ein Lernfortschritt wird ihm nicht zugeordnet. |
| ein `rev` fehlt | Die App kann nicht erkennen, ob der Eintrag zwischenzeitlich in der App geändert wurde. Weicht er ab, fragt sie nach. |
| eine `id` doppelt vorkommt | Der Import wird abgelehnt, weil die Zuordnung unklar ist. |

---

## 7. Teil-Exporte (`scope`)

Eine Datei kann ein ganzes Set oder nur ausgewählte Sektionen enthalten.

```json
"scope": { "type": "set" }
```

```json
"scope": { "type": "sections", "sectionIds": ["q7h3kd", "w2n8vb"] }
```

- `type: "set"` (oder fehlender `scope`): Die Datei steht für das ganze Set.
- `type: "sections"`: Die Datei steht nur für die in `sectionIds` genannten, bereits vorhandenen Sektionen; `sectionIds` ist eine nichtleere Liste verschiedener IDs. Andere Sektionen und die Set-Angaben verändert ein Import dieser Datei nicht. Neue Sektionen ohne `id` dürfen ergänzt werden.

`scope` wird von der App beim Export geschrieben und muss bei einer Korrektur **unverändert bleiben**.

---

## 8. Wie die App eine Datei übernimmt

### 8.1 Neues oder bekanntes Set

- Ist die `set.id` in der App **unbekannt** oder fehlt sie, wird die Datei als **neues Set** angelegt. IDs aus der Datei bleiben dabei erhalten; fehlende werden vergeben. Felder mit dem Wert `null` gelten dabei als nicht angegeben. Ähnelt das Set stark einem vorhandenen Set, weist die App vorher darauf hin.
- Ein **Teil-Export** (`scope.type: "sections"`) kann nicht als neues Set angelegt werden, weil die genannten Sektionen noch nicht vorhanden sind.
- Ist die `set.id` **bekannt**, zeigt die App eine Vorschau der Änderungen und bietet zwei Wege an: **Aktualisieren** oder **Ersetzen**.

### 8.2 Aktualisieren (Standard)

- Einträge und Sektionen mit bekannter `id` werden aktualisiert.
- Einträge und Sektionen ohne `id` werden ergänzt.
- Was in der Datei **fehlt, bleibt erhalten** – sowohl ganze Einträge als auch einzelne Felder.
- Ein Feld mit dem Wert **`null`** löscht dieses Feld, z. B. `"notes": null`. Für Pflichtfelder, `id`, `rev`, `scope`, `exportedAt` und Elemente von Listen ist `null` nicht erlaubt.
- Wurde ein Eintrag seit dem Export **sowohl in der App als auch in der Datei** geändert, zeigt die Vorschau beide Fassungen und fragt, welche gelten soll.

### 8.3 Ersetzen

- Der Umfang aus `scope` wird genau so übernommen, wie er in der Datei steht.
- Einträge und Sektionen im Umfang, die in der Datei fehlen, werden **gelöscht**; fehlende optionale Felder ebenfalls.
- Die Vorschau zeigt alle Löschungen ausdrücklich an und verlangt eine Bestätigung.

### 8.4 Toleranz und Prüfung

- **Unbekannte Felder** werden ignoriert und in der Vorschau als „wird ignoriert“ aufgeführt. Der Import scheitert daran nicht. Stehen `meanings` und `meaning` beide in einem Eintrag, wird `meaning` ignoriert.
- **Eingefügter Text** darf das JSON in einem Markdown-Codeblock (```` ```json … ``` ````) oder mit kurzem Begleittext davor oder danach enthalten; die App schneidet das JSON-Objekt heraus. Enthält der Text mehrere Codeblöcke, nimmt sie den ersten, der ein JSON-Objekt enthält.
- Der Schlüssel `meaning` (Einzahl) mit einer einzelnen Antwort wird als `meanings` mit einem Element verstanden; die Vorschau weist darauf hin.
- **Fehler**, die eine sichere Übernahme verhindern, blockieren den Import mit einer verständlichen Meldung samt Fundstelle, z. B. „Sektion 2 „Einkaufen“, Eintrag 5: Es fehlt die Bedeutung.“ Dazu gehören: kein gültiges JSON, unbekannte Formatversion, fehlende Pflichtfelder, leere Pflichttexte oder Listenelemente, Werte vom falschen Typ (z. B. eine Zahl als `notes`), ein anderer `reviewStatus` als `"unchecked"` oder `"checked"`, ungültige Sprachcodes, IDs oder `rev`-Werte, doppelte IDs, widersprüchlicher `scope`, zu lange Texte.
- **Grenzen:** Datei höchstens 10 MiB, höchstens 500 Sektionen und 20.000 Einträge. Texte höchstens (in Zeichen, ohne Leerzeichen am Rand):

  | Text | Zeichen |
  |---|---|
  | Titel von Set und Sektion; `level`, `textbook`, `edition`, `source`, `license`; Angaben in `grammar` (auch jede Wortform) | 200 |
  | Antworttexte und Varianten; Beispielsätze und ihre Übersetzungen | 500 |
  | `notes` (Set und Eintrag) | 2.000 |

---

## 9. Beispiel: exportiertes Set und seine Korrektur

**Export aus der App** (Teil-Export einer Sektion):

```json
{
  "format": "vokabeltrainer-set",
  "formatVersion": 1,
  "exportedAt": "2026-10-19T17:00:00Z",
  "scope": { "type": "sections", "sectionIds": ["q7h3kd"] },
  "set": {
    "id": "m4x8c2r9tw",
    "rev": "k2p9w4ha",
    "title": "Lektion 4 – In der Stadt",
    "termLanguage": "en",
    "meaningLanguage": "de",
    "level": "Klasse 6"
  },
  "sections": [
    {
      "id": "q7h3kd",
      "rev": "t5m2b8xe",
      "title": "Unterwegs",
      "entries": [
        { "id": "a8f2kc", "rev": "3hd9w2mq", "term": "bus stp", "meanings": ["Bushaltestelle"] },
        { "id": "p3z7rn", "rev": "x9c4k2fj", "term": "to miss", "meanings": ["vermissen"] }
      ]
    }
  ]
}
```

**Korrigierte Fassung** – ein Tippfehler behoben, eine Bedeutung ergänzt, ein neuer Eintrag hinzugefügt:

```json
{
  "format": "vokabeltrainer-set",
  "formatVersion": 1,
  "exportedAt": "2026-10-19T17:00:00Z",
  "scope": { "type": "sections", "sectionIds": ["q7h3kd"] },
  "set": {
    "id": "m4x8c2r9tw",
    "rev": "k2p9w4ha",
    "title": "Lektion 4 – In der Stadt",
    "termLanguage": "en",
    "meaningLanguage": "de",
    "level": "Klasse 6"
  },
  "sections": [
    {
      "id": "q7h3kd",
      "rev": "t5m2b8xe",
      "title": "Unterwegs",
      "entries": [
        { "id": "a8f2kc", "rev": "3hd9w2mq", "term": "bus stop", "meanings": ["Bushaltestelle"] },
        { "id": "p3z7rn", "rev": "x9c4k2fj", "term": "to miss", "meanings": ["vermissen", "verpassen"] },
        { "term": "to ride", "meanings": ["fahren", "reiten"], "grammar": { "forms": ["ride", "rode", "ridden"] } }
      ]
    }
  ]
}
```

`id`, `rev`, `scope` und `exportedAt` sind unverändert; der neue Eintrag hat weder `id` noch `rev`.

---

## 10. Worauf es bei einer erzeugten Datei ankommt

Diese Punkte fassen zusammen, was eine Datei braucht, damit die App sie ohne Nacharbeit übernimmt und das Set gut lernbar ist. Sie gelten für Menschen wie für KI-Assistenten.

1. **Einfügbar:** Eine Antwort aus dem KI-Chat wird meist als Ganzes kopiert und in die App eingefügt. Die App nimmt daraus den ersten JSON-Codeblock; kurzer Begleittext davor oder danach stört nicht (8.4). Ein Set gehört daher vollständig in genau einen Codeblock mit gültigem JSON.
2. **Zuschnitt:** ein Set pro Lektion oder vergleichbarer Lerneinheit (3.1), gegliedert in wenige Sektionen nach den größeren Zwischenüberschriften (4). Mehrere Lektionen ergeben mehrere Sets in getrennten Codeblöcken.
3. **Treu zur Vorlage:** Sektionen und Einträge stehen in der Reihenfolge der Vorlage. Aufgenommen wird, was dort steht, ohne zusätzliche Vokabeln, Bedeutungen oder Beispielsätze. Naheliegende gleichwertige Schreibweisen als `acceptedVariants` (z. B. „jeder“, „jede“, „jedes“ zu „jede/-r/-s“) sind willkommen, weil sie die Abfrage erleichtern.
4. **Zuordnung:** `term` in der Lernsprache (`termLanguage`), `meanings` in der Bedeutungssprache (`meaningLanguage`); Zusatzangaben wie in 5.6. Varianten (gleichwertige Wörter derselben Bedeutung → `acceptedVariants`) und verschiedene Bedeutungen (→ mehrere Elemente in `meanings`) unterscheiden sich wie in 5.3. Ohne Varianten genügt die Kurzform (String).
5. **Feldnamen:** nur die Feldnamen dieser Spezifikation, genau so geschrieben. Zusätzliche Felder ignoriert die App und listet sie in der Vorschau als „wird ignoriert“ auf.
6. **Neues Set:** keine `id`, kein `rev`, kein `scope`, kein `exportedAt`; die App vergibt die IDs selbst (6).
7. **Korrektur eines exportierten Sets:** `id`, `rev`, `scope` und `exportedAt` bleiben exakt erhalten, auch bei korrigierten Einträgen; neue Einträge kommen ohne `id` und `rev` hinzu. Zurück geht immer die vollständige Datei in unveränderter Reihenfolge, denn beim Ersetzen löscht die App, was in der Datei fehlt (8.3).
8. **Reiner Text:** Texte ohne HTML oder Markdown; leere Felder fehlen besser ganz, statt leere Strings zu enthalten (5.5).
9. **Unsicheres kennzeichnen:** Ist etwas unleserlich oder unsicher, wird der Eintrag trotzdem aufgenommen, mit `"reviewStatus": "unchecked"` und dem Grund in `notes`. So sehen Lernende in der App, was sie nachprüfen sollten.
10. **Sprachcodes** nach BCP 47, z. B. `en`, `de`, `fr`, `es`, `la`.

---

## 11. So wird diese Beschreibung genutzt

Die App veröffentlicht dieses Dokument als `formatspezifikation.md` neben sich selbst, unter https://vokabeltrainer.cgrothaus.de/formatspezifikation.md, und das JSON Schema daneben als `vokabeltrainer-set.schema.json`. Ihre Hilfe „Wie bekomme ich ein Vokabelset?“ führt durch die Wege aus der Einleitung:

- **Neues Set:** Lernende fotografieren die Vokabelseiten einer Lektion und geben die Fotos zusammen mit dem Link auf dieses Dokument in einen KI-Chat; die App bietet dafür einen kurzen Begleittext zum Kopieren an. Statt Fotos kann es auch eine abgetippte Wortliste sein. Erwartet wird eine Antwort mit dem Set als JSON-Codeblock, die sich direkt in der App einfügen lässt (Kapitel 1 bis 5 und 10).
- **Prüfen und korrigieren:** Ein aus der App exportiertes Set wird zusammen mit diesem Dokument in einen KI-Chat gegeben oder von Hand bearbeitet. Erwartet wird die vollständige, korrigierte Datei mit unveränderten IDs (Kapitel 6 bis 9).
- Kann ein Chat keine Links öffnen, wird dieses Dokument als Datei angehängt; die App bietet dafür „Formatbeschreibung teilen“ an.

---

## 12. Versionierung und Kompatibilität

- `formatVersion` wird nur erhöht, wenn eine ältere App eine neue Datei **falsch verstehen** würde. Neue optionale Felder, die ältere Apps gefahrlos ignorieren können, erhöhen die Version nicht.
- Jede App-Version liest Dateien **aller früheren** Formatversionen.
- Dateien einer **neueren** Formatversion werden abgelehnt mit dem Hinweis, die App neu zu laden.
- Änderungen an dieser Spezifikation werden in Kapitel 13 festgehalten.

---

## 13. Änderungshistorie

| Stand | Änderung |
|---|---|
| 19. Oktober 2026 | Erster Entwurf für Formatversion 1. Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer. |
| 21. Oktober 2026 | Präzisiert mit der vollständigen Validierung, Formatversion bleibt 1: JSON Schema liegt bei; leere optionale Felder werden entfernt statt abgelehnt (5.5); Form von `rev` und `sectionIds` (6, 7); `null` bei neuen Sets, Teil-Export nicht als neues Set (8.1); `null` nur bei optionalen Feldern (8.2); `meaning` neben `meanings`, vollständige Fehlerliste, Grenzen für alle Texte (8.4). Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer. |
| 21. Oktober 2026 | Kurze Vorlagen mit Link auf dieses Dokument statt der langen Vorlagen (11), nachdem mehrere KI-Assistenten allein mit dieser Spezifikation gültige Sets erzeugt hatten; die App veröffentlicht Spezifikation und Schema neben sich selbst. Formatversion bleibt 1. Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer. |
| 22. Oktober 2026 | Hinweis auf das Beispielset der App mit Herkunft und Lizenz (1). Formatversion bleibt 1. Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer. |
| 29. Oktober 2026 | Eigenständig und mit Kontext, Formatversion bleibt 1: Einleitung zu Zweck und Ablauf; Zuschnitt von Set (3.1) und Sektionen (4); Bedeutung der Felder in der App (2, 3.2, 5.1) und Zuordnung typischer Angaben (5.6); Beispiele als Lektion (1, 9); Hinweise für erzeugte Dateien beschreibend statt als Anweisungen (10); Kapitel 11 beschreibt den Ablauf, die Vorlagen stehen nur noch in der App; keine Verweise auf interne Projektdokumente. Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer. |
| 29. Oktober 2026 | Erste Auslieferung: Formatversion 1 ist verbindlich und ändert sich nur noch so, wie Kapitel 12 es beschreibt; feste Adresse der App (11), das JSON Schema trägt sie als `$id`. Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer. |
