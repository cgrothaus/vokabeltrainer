# Betatest Meilenstein 0: Anleitung

**Stand:** 22. Oktober 2026  
**App:** https://cgrothaus.github.io/vokabeltrainer/

Danke, dass du mittestest! Die App ist noch ein Gerüst: Sie kann Vokabeln importieren, als Karteikarten abfragen und ein Backup speichern. Wir wollen herausfinden, ob dieser Weg auf deinem Handy von vorn bis hinten funktioniert – besonders der Schritt mit dem KI-Chat.

## Überblick

```
Vokabelliste ──Foto──┐
                     ├──► KI-Chat (z. B. ChatGPT, Claude, Gemini) ──► Antwort als Text oder Datei ──► App
Formatbeschreibung ──┘
```

## 1. App einrichten

1. Link oben auf dem Handy öffnen.
2. Zum Home-Bildschirm hinzufügen:
   - **iPhone (Safari):** Teilen-Symbol → „Zum Home-Bildschirm“.
   - **Android (Chrome):** Menü ⋮ → „Zum Startbildschirm hinzufügen“ bzw. „App installieren“.
3. Ab jetzt die App **über das Symbol „Vokabeln“** starten, nicht mehr im Browser.  
   Wichtig auf dem iPhone: Nur so bleiben deine Daten dauerhaft gespeichert. Im Safari-Tab kann iOS sie nach einigen Tagen ohne Nutzung löschen.
4. Zum Kennenlernen ohne eigene Vokabeln: Auf der leeren Startseite „**Beispielset ausprobieren**“ tippen. Für den Test danach bitte trotzdem den Weg mit dem KI-Chat gehen (Abschnitt 2).

## 2. Vokabeln mit dem KI-Chat umwandeln

1. **Foto machen** von einer Vokabelliste, am besten einer selbst geschriebenen. Mehrere Fotos gehen auch.
2. **Vorlage aus der App holen:** In der App „**Wie bekomme ich ein Vokabelset?**“ öffnen (auf der leeren Startseite, unter der Liste oder beim Import) → „**Vorlage kopieren**“. Die Vorlage enthält den Link auf die Formatbeschreibung:  
   https://cgrothaus.github.io/vokabeltrainer/formatspezifikation.md
3. **Im Chat die Vorlage einfügen und die Fotos anhängen.** Kann der Chat den Link nicht öffnen, in der App „**Formatbeschreibung teilen**“ tippen und die Datei im Chat anhängen.

   Mehr bitte nicht vorgeben: Wir testen, ob die Formatbeschreibung allein reicht. Fragt der Chat nach, beantworte die Frage und notiere sie für die Rückmeldung.
4. **Antwort kurz prüfen:** Stimmen Wörter und Übersetzungen? Unsichere Stellen markiert der Chat meist selbst; die App zeigt solche Hinweise noch nicht an.

## 3. Ergebnis in die App übernehmen

In der App „**Vokabelset importieren**“ öffnen, dann eine der beiden Möglichkeiten:

- **Als Text:** Im Chat die Antwort (oder den Codeblock) kopieren → in der App „**Aus Zwischenablage einfügen**“ tippen (das iPhone fragt dann noch einmal mit „Einfügen“). Alternativ lange ins Feld „Text einfügen“ tippen → „Einfügen“ → „**Prüfen**“. Begleittext vor oder nach dem Codeblock stört nicht.
- **Als Datei:** Den Chat bitten „Gib mir das als JSON-Datei“, Datei speichern (z. B. in „Dateien“ bzw. „Downloads“) → in der App „**Oder eine Datei auswählen**“.

Klappt es, zeigt eine **Vorschau** Titel, Sprachen und Sektionen mit der Zahl der Einträge – fehlt eine Lektion? Dann „**Importieren**“; die App wechselt zur Bibliothek und meldet „… gespeichert.“ Hast du ein ähnliches Set schon, weist die Vorschau darauf hin. Bei einer Fehlermeldung: Screenshot machen und die Meldung ruhig an den Chat zurückgeben („Der Import meldet: …“). Wie oft das nötig war, ist eine wichtige Rückmeldung.

## 4. Lernen und sichern

1. **Lernen:** In der Bibliothek beim Set auf „Lernen“ tippen. Danach Sektionen, Richtung (z. B. „Englisch → Deutsch“ oder „Gemischt“) und Anzahl wählen und unten auf „… Vokabeln lernen“ tippen; die App merkt sich die Auswahl pro Set. Karte antippen zum Aufdecken, dann „Gewusst“ oder „Nochmal“. „Nochmal“-Karten kommen später wieder.
   Ein Tipp auf den Titel öffnet das Set: Dort stehen alle Sektionen (antippen zum Aufklappen) mit den Angaben aus dem Chat – ein guter Ort, um zu prüfen, ob das Foto richtig gelesen wurde. Ganz unten lässt sich das Set löschen, samt dem Lernstand dazu.
2. **Backup:** „Backup und Wiederherstellung“ → „Backup speichern“ → im Teilen-Menü z. B. „In Dateien sichern“. Notiere, wo die Datei gelandet ist.
3. **Offline:** Flugmodus an, App vom Home-Bildschirm starten – sie sollte normal laufen.
4. Erscheint unten „Neue Version verfügbar.“, auf „**Jetzt aktualisieren**“ tippen.

## Was die App noch nicht kann

Bitte nicht als Fehler melden – das kommt in späteren Meilensteinen:

- Nur Karteikarten, noch kein Multiple Choice.
- Sets lassen sich nicht bearbeiten, nur löschen und neu importieren.
- Notizen, Beispielsätze und Grammatik aus der Datei werden noch nicht angezeigt.
- Die Schaltfläche „Dauerhaften Speicher anfordern“ ist nur für unsere Messung da.

## Rückmeldung

Bitte schick mir nach dem Test kurz:

1. **Gerät und System**, z. B. „iPhone 15, iOS 26“ oder „Pixel 8, Android 16, Chrome“.
2. **KI-Chat:** App und Modell (z. B. „ChatGPT, GPT-5“), Formatbeschreibung als Link oder Datei, hat der Chat nachgefragt? Haben „Vorlage kopieren“ und „Formatbeschreibung teilen“ geklappt?
3. **Import:** auf Anhieb geklappt? Als Text (über „Aus Zwischenablage einfügen“ oder das Feld) oder Datei? Hat die Vorschau geholfen? Fehlermeldungen als Screenshot.
4. **Inhalt:** falsche Übersetzungen, fehlende Wörter, unsinnig zusammengefasste oder getrennte Bedeutungen.
5. **Backup:** Wo ist die Datei gelandet? Hat Abbrechen im Teilen-Menü etwas gespeichert?
6. **Offline-Start** und **Aktualisieren:** hat beides funktioniert?
7. Alles, was unklar, umständlich oder überraschend war.

Fotos von Schulbuchseiten bitte nicht mitschicken – Testergebnisse werden im öffentlichen Projekt dokumentiert. Screenshots der App und der Chat-Antwort genügen.
