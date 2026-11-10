# Rätselhafte Weihnachtszeit – Die verschwundenen Werte

Ein persönlicher Rätsel-Adventskalender für Sandra – als Website zum Mitspielen.

## Veröffentlichen mit GitHub Pages
1. Neues Repository anlegen (z. B. `weihnachtszeit`) und den **Inhalt dieses Ordners** hochladen (index.html, style.css, app.js, data/, img/, .nojekyll).
2. Im Repository: **Settings → Pages → Build and deployment → Source: „Deploy from a branch“**, Branch `main`, Ordner `/ (root)`.
3. Nach ca. 1 Minute ist der Kalender unter `https://<benutzername>.github.io/weihnachtszeit/` erreichbar.

## Türchen
- Türchen *n* öffnet sich am *n*. Dezember 2026 (lokale Uhrzeit des Geräts). Ab dem 24.12.2026 sind dauerhaft alle offen.
- **Vorschau für Tim:** `…/?vorschau=tim` schaltet in diesem Browser-Tab alle Türchen frei (gilt nur bis zum Schließen des Tabs).

## Fortschritt
- Wird automatisch doppelt im Browser gespeichert (localStorage und IndexedDB); der Browser wird um dauerhaften Speicher gebeten.
- Im Menü (☰) gibt es einen **Sicherungscode** zum Kopieren oder als Datei; damit lässt sich der Stand auf jedem Gerät wiederherstellen.
- Selbst ohne Sicherung: Gelöste Rätsel sind mit derselben Antwort sofort wieder offen – man muss nichts neu rätseln.

## Hinweise
- Die Fortsetzungen sind mit der jeweils richtigen Antwort verschlüsselt; im Quelltext lässt sich die Lösung daher nicht ablesen.
- Lokal testen: `python3 -m http.server` im Ordner starten und `http://localhost:8000/?vorschau=tim` öffnen (direkt als Datei geöffnet funktioniert die Verschlüsselung nicht).
- Der Name im Menü ersetzt „Sandra“ in allen Geschichten; die Widmung „für Sandra“ bleibt immer sichtbar.
