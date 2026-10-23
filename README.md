# Luna

Tagebuch-App fürs iPhone: Abend-Journal mit Smileys und Spracheingabe, Schlaf-Kalender, Termine mit Erinnerung über den iPhone-Kalender, Essen mit Kalorienziel zum Zunehmen, Rauchfrei mit Live-Zähler und Notfall-Knopf, und Statistik.

Luna ist eine Web-App. Sie läuft offline und speichert alle Einträge nur auf dem Gerät, nichts davon landet in diesem Repository.

## Installieren

1. Die Seite dieses Repositorys (GitHub Pages) in **Safari** öffnen.
2. Auf **Teilen** tippen.
3. **„Zum Home-Bildschirm“** wählen und **Hinzufügen** tippen.

## Updates

Neue Versionen lädt die App beim nächsten Öffnen. Oben erscheint dann „Eine neue Version von Luna ist da“ mit dem Knopf **Aktualisieren**.

## Essen per Foto

Die Nährwert-Schätzung per Foto oder Beschreibung läuft über die kostenlose Gemini-API von Google.
Den Schlüssel gibt es unter [aistudio.google.com](https://aistudio.google.com/apikey) („Create API key“). Er wird in Luna unter **Essen → Foto** eingefügt und bleibt nur auf dem iPhone, auch nicht im Backup.
Ohne Schlüssel funktionieren die Lebensmittel-Liste und die schnelle Eingabe trotzdem.

## Rauchfrei

Im Tab **Rauchfrei** legst du fest, was du rauchst, was es kostet und wann dein Rauchstopp ist (sofort, später oder mit einem Plan zum Reduzieren).
Luna zählt die rauchfreie Zeit live, rechnet das gesparte Geld aus, zeigt, was sich im Körper erholt, und hilft mit **„Lust auf eine?“**, wenn es schwer wird.
Essen und Rauchfrei lassen sich unter Einstellungen → Tableiste ausblenden.

## Backup

Einstellungen → Daten → **Backup erstellen** sichert alles als Datei, am besten in iCloud Drive. Mit **Backup wiederherstellen** holst du die Daten auf ein neues iPhone.
