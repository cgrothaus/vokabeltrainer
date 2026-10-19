# Formatspezifikation: Vokabelset-Datei

**Formatkennung:** `vokabeltrainer-set`  
**Formatversion:** 1  
**Dokumentstand:** 19. Oktober 2026 – Entwurf  
**Bezug:** PRD 2.4 (FR-13–FR-20, FR-29, FR-30, FR-32, DF-01–DF-11), TDD v2

Dieses Dokument beschreibt, wie eine Datei aufgebaut sein muss, damit der Vokabeltrainer sie importieren kann. Es richtet sich an drei Gruppen:

- **Menschen**, die ein Set von Hand schreiben oder prüfen,
- **LLMs**, die ein Set aus einem Foto, einer Buchseite oder einer Wortliste erzeugen oder ein exportiertes Set korrigieren (Kapitel 10 und 11),
- **Entwicklung und Tests** als verbindliche Referenz für Validator, JSON Schema und Testfixtures.

Ein maschinenlesbares JSON Schema (Draft 2020-12) folgt als `vokabeltrainer-set.schema.json`. Bei Widersprüchen gilt dieses Dokument.

---

## 1. Das Wichtigste in Kürze

Ein neues Set braucht nur einen Titel, zwei Sprachen und Sektionen mit Einträgen:

```json
{
  "format": "vokabeltrainer-set",
  "formatVersion": 1,
  "set": {
    "title": "Englisch – Freizeit und Essen",
    "termLanguage": "en",
    "meaningLanguage": "de",
    "level": "Klasse 6"
  },
  "sections": [
    {
      "title": "Essen und Trinken",
      "entries": [
        { "term": "apple", "meanings": ["Apfel"] },
        { "term": "breakfast", "meanings": ["Frühstück"] }
      ]
    },
    {
      "title": "Freizeit",
      "entries": [
        { "term": "to miss", "meanings": ["vermissen", "verpassen"] },
        { "term": "football", "meanings": ["Fußball"] }
      ]
    }
  ]
}
```

- `term` ist das Wort in der **Lernsprache** (hier Englisch).
- `meanings` ist eine **Liste von Bedeutungen** in der **Bedeutungssprache** (hier Deutsch).
- IDs werden bei neuen Sets **weggelassen**; die App vergibt sie beim Import.

---

## 2. Aufbau einer Datei

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `format` | ja¹ | String | Immer `"vokabeltrainer-set"` |
| `formatVersion` | ja¹ | Ganzzahl | Immer `1` für diese Spezifikation |
| `exportedAt` | nein | String (ISO 8601, UTC) | Exportzeitpunkt; nur informativ, wird von der App bei Exporten gesetzt |
| `scope` | nein | Objekt | Umfang eines Teil-Exports (Kapitel 7). Fehlt er, betrifft die Datei das ganze Set. |
| `set` | ja | Objekt | Angaben zum Set (Kapitel 3) |
| `sections` | ja | Array | Geordnete Liste der Sektionen (Kapitel 4); mindestens eine |

¹ Fehlen `format` und `formatVersion`, nimmt die App tolerant Formatversion 1 an und weist in der Vorschau darauf hin. Eine Datei mit `formatVersion` größer als 1 wird von einer App, die nur Version 1 kennt, mit einem verständlichen Hinweis abgelehnt (DF-11).

Die Reihenfolge der Sektionen im Array und der Einträge innerhalb einer Sektion ist die Reihenfolge in der App. Es gibt keine separaten Sortierfelder.

---

## 3. Das Set (`set`)

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `id` | nein² | String | Stabile ID des Sets |
| `rev` | nein² | String | Prüfwert der Set-Angaben beim Export (Kapitel 6) |
| `title` | ja | String, 1–200 Zeichen | Titel des Sets |
| `termLanguage` | ja | Sprachcode | Lernsprache, z. B. `"en"`, `"fr"`, `"es"`, `"la"`, `"en-GB"` |
| `meaningLanguage` | ja | Sprachcode | Sprache der Bedeutungen, z. B. `"de"` |
| `level` | nein | String | Lernstufe frei formuliert, z. B. `"Klasse 6"`, `"A2"`, `"Kursstufe"` |
| `textbook` | nein | String | Lehrwerk, falls das Set sich darauf bezieht |
| `edition` | nein | String | Ausgabe oder Auflage des Lehrwerks |
| `source` | nein | String | Herkunft, z. B. „eigene Zusammenstellung“ oder „Arbeitsblatt vom 3. 10.“ |
| `license` | nein | String | Nutzungsrechte, z. B. `"CC0"` |
| `notes` | nein | String | Freie Hinweise zum Set |
| `reviewStatus` | nein | `"unchecked"` oder `"checked"` | Prüfstatus des Sets |

² Bei neu erstellten Sets weglassen. Bei Dateien, die aus der App exportiert wurden, immer vorhanden und **unverändert zu erhalten**.

**Sprachcodes** folgen BCP 47 (wie in `lang`-Attributen von HTML): zwei oder drei Buchstaben für die Sprache, optional mit Region, z. B. `en`, `en-GB`, `pt-BR`, `de`, `la`.

---

## 4. Sektionen (`sections[]`)

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `id` | nein² | String | Stabile ID der Sektion |
| `rev` | nein² | String | Prüfwert des Sektionstitels beim Export |
| `title` | ja | String, 1–200 Zeichen | Name, z. B. „Lektion 3“, „Essen und Trinken“, „Lernkasten Fach 2“ |
| `entries` | ja | Array | Geordnete Liste der Einträge; darf leer sein |

---

## 5. Einträge (`entries[]`)

### 5.1 Felder

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `id` | nein² | String | Stabile ID des Eintrags |
| `rev` | nein² | String | Prüfwert des Eintragsinhalts beim Export |
| `term` | ja | Antwort | Wort oder Ausdruck in der Lernsprache |
| `meanings` | ja | Array von Antworten, mindestens eine | Bedeutungen in der Bedeutungssprache |
| `notes` | nein | String | Hinweis, z. B. „nur britisches Englisch“ oder „unsicher: Foto unscharf“ |
| `examples` | nein | Array | Beispielsätze, je String oder `{ "text", "translation"? }` |
| `grammar` | nein | Objekt | Grammatische Angaben (5.4) |
| `reviewStatus` | nein | `"unchecked"` oder `"checked"` | Prüfstatus des Eintrags |

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
- Leere Texte sind nicht erlaubt; ein optionales Feld lässt man stattdessen weg.

---

## 6. IDs und Prüfwerte (`id`, `rev`)

IDs verbinden einen Eintrag in der Datei mit demselben Eintrag in der App – und damit mit dem Lernfortschritt. Prüfwerte (`rev`) zeigen der App, ob ein Eintrag seit dem Export in der Datei oder in der App verändert wurde.

**Regeln:**

1. **Neue Sets:** `id` und `rev` überall weglassen.
2. **Exportierte Sets korrigieren:** `id` und `rev` **unverändert lassen** – auch dann, wenn der Eintrag inhaltlich korrigiert wird. Nie neu erfinden, nie entfernen, nie zwischen Einträgen vertauschen.
3. **Neue Einträge oder Sektionen in einer exportierten Datei:** ohne `id` und ohne `rev` ergänzen.
4. Jede `id` darf innerhalb eines Sets nur **einmal** vorkommen.

**Form:** IDs, die die App erzeugt, bestehen aus Kleinbuchstaben und Ziffern (Set: 10 Zeichen, Sektion und Eintrag: 6 Zeichen, z. B. `"a8f2kc"`); `rev`-Werte haben 8 Zeichen. Beim Import akzeptiert die App jede ID aus 1–64 Zeichen `A–Z a–z 0–9 _ -`.

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
- `type: "sections"`: Die Datei steht nur für die in `sectionIds` genannten, bereits vorhandenen Sektionen. Andere Sektionen und die Set-Angaben verändert ein Import dieser Datei nicht. Neue Sektionen ohne `id` dürfen ergänzt werden.

`scope` wird von der App beim Export geschrieben und muss bei einer Korrektur **unverändert bleiben**.

---

## 8. Wie die App eine Datei übernimmt

### 8.1 Neues oder bekanntes Set

- Ist die `set.id` in der App **unbekannt** oder fehlt sie, wird die Datei als **neues Set** angelegt. IDs aus der Datei bleiben dabei erhalten; fehlende werden vergeben. Ähnelt das Set stark einem vorhandenen Set, weist die App vorher darauf hin.
- Ist die `set.id` **bekannt**, zeigt die App eine Vorschau der Änderungen und bietet zwei Wege an: **Aktualisieren** oder **Ersetzen**.

### 8.2 Aktualisieren (Standard)

- Einträge und Sektionen mit bekannter `id` werden aktualisiert.
- Einträge und Sektionen ohne `id` werden ergänzt.
- Was in der Datei **fehlt, bleibt erhalten** – sowohl ganze Einträge als auch einzelne Felder.
- Ein Feld mit dem Wert **`null`** löscht dieses Feld, z. B. `"notes": null`. Für Pflichtfelder ist `null` nicht erlaubt.
- Wurde ein Eintrag seit dem Export **sowohl in der App als auch in der Datei** geändert, zeigt die Vorschau beide Fassungen und fragt, welche gelten soll.

### 8.3 Ersetzen

- Der Umfang aus `scope` wird genau so übernommen, wie er in der Datei steht.
- Einträge und Sektionen im Umfang, die in der Datei fehlen, werden **gelöscht**; fehlende optionale Felder ebenfalls.
- Die Vorschau zeigt alle Löschungen ausdrücklich an und verlangt eine Bestätigung.

### 8.4 Toleranz und Prüfung

- **Unbekannte Felder** werden ignoriert und in der Vorschau als „wird ignoriert“ aufgeführt. Der Import scheitert daran nicht.
- **Eingefügter Text** darf das JSON in einem Markdown-Codeblock (```` ```json … ``` ````) oder mit kurzem Begleittext davor oder danach enthalten; die App schneidet das JSON-Objekt heraus.
- Der Schlüssel `meaning` (Einzahl) mit einer einzelnen Antwort wird als `meanings` mit einem Element verstanden; die Vorschau weist darauf hin.
- **Fehler**, die eine sichere Übernahme verhindern, blockieren den Import mit einer verständlichen Meldung samt Fundstelle, z. B. „Sektion 2 „Freizeit“, Eintrag 5: Es fehlt die Bedeutung.“ Dazu gehören: kein gültiges JSON, unbekannte Formatversion, fehlende Pflichtfelder, leere Texte, ungültige Sprachcodes, doppelte IDs, widersprüchlicher `scope`.
- **Grenzen:** Datei höchstens 10 MiB, Titel höchstens 200, Antworttexte höchstens 500, Notizen höchstens 2.000 Zeichen.

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
    "title": "Englisch – Freizeit und Essen",
    "termLanguage": "en",
    "meaningLanguage": "de",
    "level": "Klasse 6"
  },
  "sections": [
    {
      "id": "q7h3kd",
      "rev": "t5m2b8xe",
      "title": "Freizeit",
      "entries": [
        { "id": "a8f2kc", "rev": "3hd9w2mq", "term": "to miss", "meanings": ["vermissen"] },
        { "id": "p3z7rn", "rev": "x9c4k2fj", "term": "footbal", "meanings": ["Fußball"] }
      ]
    }
  ]
}
```

**Korrigierte Fassung** – eine Bedeutung ergänzt, ein Tippfehler behoben, ein neuer Eintrag hinzugefügt:

```json
{
  "format": "vokabeltrainer-set",
  "formatVersion": 1,
  "exportedAt": "2026-10-19T17:00:00Z",
  "scope": { "type": "sections", "sectionIds": ["q7h3kd"] },
  "set": {
    "id": "m4x8c2r9tw",
    "rev": "k2p9w4ha",
    "title": "Englisch – Freizeit und Essen",
    "termLanguage": "en",
    "meaningLanguage": "de",
    "level": "Klasse 6"
  },
  "sections": [
    {
      "id": "q7h3kd",
      "rev": "t5m2b8xe",
      "title": "Freizeit",
      "entries": [
        { "id": "a8f2kc", "rev": "3hd9w2mq", "term": "to miss", "meanings": ["vermissen", "verpassen"] },
        { "id": "p3z7rn", "rev": "x9c4k2fj", "term": "football", "meanings": ["Fußball"] },
        { "term": "to swim", "meanings": ["schwimmen"], "grammar": { "forms": ["swim", "swam", "swum"] } }
      ]
    }
  ]
}
```

`id`, `rev`, `scope` und `exportedAt` sind unverändert; der neue Eintrag hat weder `id` noch `rev`.

---

## 10. Regeln für LLMs

Diese Regeln sind auch in den Prompt-Vorlagen (Kapitel 11) enthalten.

1. Antworte mit **genau einem JSON-Codeblock** und sonst nichts.
2. Verwende **nur die Feldnamen dieser Spezifikation**, genau so geschrieben. Erfinde keine zusätzlichen Felder.
3. **Neues Set:** keine `id`, kein `rev`, kein `scope`, kein `exportedAt`.
4. **Korrektur eines exportierten Sets:** `id`, `rev`, `scope` und `exportedAt` exakt unverändert übernehmen – auch bei korrigierten Einträgen. Neue Einträge ohne `id` und `rev`.
5. Gib **immer die vollständige Datei** zurück, nicht nur die geänderten Teile, und behalte die Reihenfolge bei.
6. `term` ist in der Lernsprache (`termLanguage`), `meanings` in der Bedeutungssprache (`meaningLanguage`).
7. Unterscheide **Varianten** (gleichwertige Wörter derselben Bedeutung → `acceptedVariants`) von **verschiedenen Bedeutungen** (→ mehrere Elemente in `meanings`), siehe 5.3.
8. Verwende die Kurzform (String), wenn eine Antwort keine Varianten hat.
9. Texte ohne HTML oder Markdown. Leere Felder weglassen statt leere Strings zu schreiben.
10. Bei Unsicherheit (z. B. unleserliches Foto) den Eintrag trotzdem aufnehmen, `"reviewStatus": "unchecked"` setzen und den Grund in `notes` nennen.
11. Sprachcodes nach BCP 47, z. B. `en`, `de`, `fr`, `es`, `la`.

---

## 11. Prompt-Vorlagen

Die App bietet diese Vorlagen zum Kopieren an (FR-20). Der Text in eckigen Klammern wird ersetzt.

### 11.1 Neues Set erstellen

````text
Erstelle aus den Vokabeln [auf dem angehängten Foto / in der Liste unten] eine Datei für meinen Vokabeltrainer.

Lernsprache: [Englisch, Code "en"]
Bedeutungssprache: [Deutsch, Code "de"]
Titel des Sets: [z. B. Englisch Unit 3]
Lernstufe (optional): [z. B. Klasse 6]
Sektionen: [z. B. "eine Sektion pro Überschrift" oder "alles in eine Sektion"]

Antworte nur mit einem JSON-Codeblock in genau diesem Aufbau:

```json
{
  "format": "vokabeltrainer-set",
  "formatVersion": 1,
  "set": { "title": "…", "termLanguage": "en", "meaningLanguage": "de", "level": "…" },
  "sections": [
    { "title": "…", "entries": [
      { "term": "apple", "meanings": ["Apfel"] },
      { "term": "to miss", "meanings": ["vermissen", "verpassen"] },
      { "term": "car", "meanings": [{ "text": "Auto", "acceptedVariants": ["Wagen"] }] },
      { "term": "to go", "meanings": ["gehen"], "grammar": { "forms": ["go", "went", "gone"] } }
    ] }
  ]
}
```

Regeln:
- "term" ist das Wort in der Lernsprache, "meanings" die Liste der Bedeutungen.
- Verschiedene Bedeutungen sind getrennte Elemente in "meanings". Gleichwertige Wörter für dieselbe Bedeutung gehören in "acceptedVariants".
- Keine IDs, keine zusätzlichen Felder, kein HTML. Optional erlaubt: "notes", "examples", "grammar" (mit "partOfSpeech", "gender", "plural", "forms").
- Wenn du etwas nicht sicher lesen kannst: Eintrag trotzdem aufnehmen, "reviewStatus": "unchecked" setzen und den Grund in "notes" schreiben.
- Behalte die Reihenfolge der Vorlage bei.

[Liste hier einfügen, falls kein Foto]
````

### 11.2 Exportiertes Set prüfen und korrigieren

````text
Prüfe die folgende Vokabeldatei meines Vokabeltrainers auf Rechtschreibfehler, falsche oder fehlende Bedeutungen und korrigiere sie. [Optional: Ergänze außerdem …]

Wichtige Regeln:
- Antworte nur mit einem JSON-Codeblock, der die vollständige Datei enthält.
- Lass "id", "rev", "scope" und "exportedAt" exakt unverändert, auch bei Einträgen, die du korrigierst.
- Neue Einträge bekommen kein "id" und kein "rev".
- Lösche keine Einträge; wenn ein Eintrag falsch ist, korrigiere ihn.
- Verwende nur die Feldnamen, die schon in der Datei vorkommen, sowie "notes", "examples", "grammar", "acceptedVariants" und "reviewStatus".
- Verschiedene Bedeutungen sind getrennte Elemente in "meanings"; gleichwertige Wörter für dieselbe Bedeutung gehören in "acceptedVariants".
- Behalte die Reihenfolge bei.

[Datei hier einfügen]
````

---

## 12. Versionierung und Kompatibilität

- `formatVersion` wird nur erhöht, wenn eine ältere App eine neue Datei **falsch verstehen** würde. Neue optionale Felder, die ältere Apps gefahrlos ignorieren können, erhöhen die Version nicht.
- Jede App-Version liest Dateien **aller früheren** Formatversionen (DF-11).
- Dateien einer **neueren** Formatversion werden abgelehnt mit dem Hinweis, die App neu zu laden.
- Änderungen an dieser Spezifikation werden in Kapitel 13 festgehalten.

---

## 13. Änderungshistorie

| Stand | Änderung |
|---|---|
| 19. Oktober 2026 | Erster Entwurf für Formatversion 1 (Claude Opus 5.5, in Zusammenarbeit mit dem Nutzer), auf Basis der Review-Entscheidungen vom 19. Oktober 2026 (`20261019_TDD_v1_Review_Notizen.md`, F-03 bis F-07). |
