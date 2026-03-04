# PRD: 360degre.es — Reiseblog via Telegram

**Version:** 1.0
**Datum:** 1. März 2026
**Status:** Draft
**Autor:** Bene + Claude

---

## 1. Übersicht

Ein privates Reiseblog für die Familienreise Südspanien → Portugal → Kanaren (März–Mai 2026). Posts werden ausschließlich via Telegram erstellt — Text, Bilder, Standorte vom Handy. Kein CMS, kein Editor, kein Rechner nötig.

**Domain:** 360degre.es
**Stack:** Astro (Static) + Cloudflare Worker + GitHub Actions + GitHub Pages

---

## 2. Ziele & Nicht-Ziele

### Ziele

- Bene und Sandra können jederzeit vom Handy posten
- Posts bestehen aus Text, Bildern und optional einem Standort
- Die Website aktualisiert sich automatisch ohne manuelles Deployment
- Der gesamte Content liegt als Markdown-Dateien im Git-Repo (zukunftssicher)
- Minimale laufende Kosten (idealerweise 0 €)

### Nicht-Ziele (MVP)

- Kein work/private Filter — alles ist privat
- Kein Are.na-Sync (kommt später)
- Kein Editieren/Löschen von Posts via Telegram
- Keine Kommentarfunktion
- Kein Login/Auth auf der Website (Privacy durch Obscurity reicht für MVP)
- Keine Kartenansicht aller Posts (kommt später mit dem Warburg/Aquarium-Ausbau)

---

## 3. Nutzer

| Wer    | Rolle                                                          |
| ------ | -------------------------------------------------------------- |
| Bene   | Postet Text, Bilder, Standorte. Verwaltet das Repo.            |
| Sandra | Postet Text, Bilder, Standorte. Kein technischer Zugang nötig. |
| Leser  | Familie/Freunde die den Link bekommen. Rein passiv.            |

---

## 4. User Flow

### Posten

```
1. Bene oder Sandra öffnen den Telegram Bot
2. Sie schicken eine Nachricht:
   - Nur Text → Text-Post
   - Foto(s) mit Caption → Foto-Post mit Text
   - Foto(s) ohne Caption → Foto-Post ohne Text
   - Location (Pin oder Google Maps Link) → wird dem Post zugeordnet
3. Der Post ist nach ca. 2 Minuten auf 360degre.es live
```

### Lesen

```
1. Besucher öffnen 360degre.es
2. Posts werden chronologisch angezeigt (neueste zuerst)
3. Jeder Post zeigt: Datum, Autor, Text, Bilder, Ortsname (falls vorhanden)
```

---

## 5. Telegram Bot Verhalten

### Nachrichten-Typen

| Telegram Input                        | Ergebnis                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------- |
| Text-Nachricht                        | Post mit Text, kein Bild                                                  |
| Einzelnes Foto + Caption              | Post mit einem Bild + Caption als Text                                    |
| Einzelnes Foto ohne Caption           | Post mit einem Bild, kein Text                                            |
| Media Group (mehrere Fotos) + Caption | Post mit mehreren Bildern + Caption als Text                              |
| Media Group ohne Caption              | Post mit mehreren Bildern, kein Text                                      |
| Location (Telegram Pin)               | Wird dem letzten Post zugeordnet ODER als Standalone-Location gespeichert |
| Google Maps Link im Text              | URL wird geparsed → Koordinaten extrahiert → Reverse Geocoding            |

### Autoren-Erkennung

Der Bot identifiziert den Absender über `message.from.id` und mappt auf einen Namen:

```
BENE_TELEGRAM_ID → "Bene"
SANDRA_TELEGRAM_ID → "Sandra"
```

Unbekannte Absender werden ignoriert (keine Antwort, kein Post).

### Bot-Antworten

Der Bot antwortet minimal:

- ✅ `"Posted!"` — wenn erfolgreich
- ✅ `"Posted! 📍 Sintra, Portugal"` — wenn Location aufgelöst wurde
- ❌ `"Fehler — probier's nochmal."` — bei Fehler

### Media Groups

Telegram sendet Media Groups als einzelne Nachrichten mit einer gemeinsamen `media_group_id`. Der Worker muss:

1. Erste Nachricht der Gruppe empfangen → 2 Sekunden warten
2. Weitere Nachrichten mit gleicher `media_group_id` sammeln
3. Alle Bilder + die Caption (nur eine Nachricht in der Gruppe hat die Caption) zu einem Post zusammenfassen

Hierfür braucht der Worker einen kurzlebigen Cache (Cloudflare KV oder Durable Objects mit ~5s TTL).

---

## 6. Datenmodell

### Post (Markdown Frontmatter)

```yaml
---
date: 2026-03-15T14:32:00+01:00
author: Sandra
location:
  lat: 38.7876
  lng: -9.3907
  name: Sintra, Portugal
images:
  - filename: 2026-03-15-143200-01.jpg
    width: 1600
    height: 1200
  - filename: 2026-03-15-143200-02.jpg
    width: 1200
    height: 1600
---
Heute Sintra erkundet. Die Paläste sind unwirklich —
wie eine Filmkulisse die jemand vergessen hat abzubauen.
```

### Dateistruktur im Repo

```
360degre.es/
├── src/
│   ├── content/
│   │   └── posts/
│   │       ├── 2026-03-15-143200.md
│   │       ├── 2026-03-16-091500.md
│   │       └── ...
│   ├── assets/
│   │   └── posts/
│   │       ├── 2026-03-15-143200-01.jpg
│   │       ├── 2026-03-15-143200-02.jpg
│   │       └── ...
│   ├── layouts/
│   │   └── PostLayout.astro
│   └── pages/
│       └── index.astro          ← Feed (alle Posts, neueste zuerst)
├── astro.config.mjs
├── .github/
│   └── workflows/
│       └── deploy.yml           ← Build & Deploy on push
└── package.json
```

### Dateinamen-Konvention

Posts: `YYYY-MM-DD-HHmmss.md` (UTC-Timestamp der Telegram-Nachricht)
Bilder: `YYYY-MM-DD-HHmmss-NN.jpg` (NN = laufende Nummer bei mehreren Bildern)

---

## 7. Technische Architektur

```
┌──────────┐     Webhook      ┌─────────────────────┐
│ Telegram │ ──────────────── │ Cloudflare Worker   │
│ App      │                  │                     │
└──────────┘                  │ 1. Parse Nachricht  │
                              │ 2. Bilder downloaden│
                              │ 3. Reverse Geocoding│
                              │ 4. MD generieren    │
                              │ 5. GitHub API Push  │
                              └─────────┬───────────┘
                                        │ git push
                              ┌─────────▼───────────┐
                              │ GitHub Actions      │
                              │ astro build         │
                              └─────────┬───────────┘
                                        │ deploy
                              ┌─────────▼───────────┐
                              │ GitHub Pages        │
                              │ 360degre.es         │
                              └─────────────────────┘
```

### Cloudflare Worker

- **Runtime:** Cloudflare Workers (free tier: 100k Requests/Tag)
- **Webhook:** Telegram Bot API Webhook → Worker URL
- **Bilder:** Von Telegram File API downloaden → Base64 → via GitHub Contents API ins Repo pushen
- **Reverse Geocoding:** Nominatim API (OpenStreetMap, kostenlos, kein API Key nötig)
- **GitHub Push:** Per GitHub REST API (`PUT /repos/:owner/:repo/contents/:path`)
- **Media Group Buffer:** Cloudflare KV (free tier reicht) — `media_group_id` als Key, 5s TTL

### Secrets (Cloudflare Worker Environment Variables)

```
TELEGRAM_BOT_TOKEN     — von @BotFather
TELEGRAM_WEBHOOK_SECRET — selbst generiertes Secret zur Webhook-Verifizierung
GITHUB_TOKEN           — Personal Access Token mit repo-Scope
GITHUB_REPO            — "bene/360degre.es"
BENE_TELEGRAM_ID       — Benes Telegram User ID
SANDRA_TELEGRAM_ID     — Sandras Telegram User ID
```

### GitHub Actions Workflow

```yaml
on:
  push:
    branches: [main]
    paths:
      - "src/content/**"
      - "src/assets/**"

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### DNS (360degre.es)

- Hostinger Domain-Verwaltung: A-Records auf GitHub Pages IPs
- CNAME: `www.360degre.es` → `bene.github.io`
- GitHub Repo Settings: Custom Domain `360degre.es`, Enforce HTTPS

---

## 8. Website Design

### Grundprinzip

Minimal. Kein Header, kein Footer, kein Navigation. Ein chronologischer Feed.

### Layout

```
┌─────────────────────────────────────┐
│                                     │
│  360°                               │  ← Titel, einmalig oben
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  15. März 2026 · Sandra             │
│  📍 Sintra, Portugal                │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │         [Foto]              │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│  ┌──────────┐ ┌──────────────┐     │
│  │ [Foto 2] │ │  [Foto 3]   │     │
│  └──────────┘ └──────────────┘     │
│                                     │
│  Heute Sintra erkundet. Die         │
│  Paläste sind unwirklich.           │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  14. März 2026 · Bene               │
│  📍 Lissabon, Portugal              │
│                                     │
│  Ankommen. Müde. Zufrieden.         │
│                                     │
│  ─────────────────────────────────  │
│                                     │
└─────────────────────────────────────┘
```

### Typografie & Farben

- Systemfonts (kein Webfont-Loading)
- Schwarzer Text auf weißem Hintergrund
- Bilder full-width auf Mobile, max-width auf Desktop
- Minimale Abstände, viel Weißraum
- Kein Dark Mode für MVP

### Responsive

- Mobile-first (primäre Nutzung: Freunde/Familie schauen auf dem Handy)
- Bilder: 1 Spalte auf Mobile, Grid auf Desktop (wenn mehrere Bilder)
- Maximale Breite Content: ~640px

---

## 9. Bildverarbeitung

### Im Cloudflare Worker

- Telegram liefert Bilder in mehreren Größen. Wir nehmen die größte verfügbare (`file_id` der größten `PhotoSize`)
- Keine Komprimierung im Worker (zu rechenintensiv für Workers)
- Bilder werden 1:1 ins Repo gepusht

### In Astro (Build-Zeit)

- Astro Image-Optimierung: automatisch WebP/AVIF generieren
- Responsive `srcset` für verschiedene Viewport-Größen
- Lazy Loading für alle Bilder
- EXIF-Daten strippen (Privacy)

### Größen-Limit

- GitHub Contents API erlaubt max. 100 MB pro Datei
- Telegram komprimiert Fotos standardmäßig auf ~1-2 MB → kein Problem
- Bei Videos (Zukunft): müsste eine andere Lösung her (R2, externe Hosting)

---

## 10. Privacy & Zugang

### MVP-Ansatz: Privacy durch Obscurity

- Kein Login, kein Passwort
- Die URL wird nur an Familie/Freunde geteilt
- Nicht in Google indexiert: `<meta name="robots" content="noindex, nofollow">`
- Keine Sitemap
- Kein Link von bewe.is zu 360degre.es

### Telegram Bot Sicherheit

- Nur Nachrichten von bekannten Telegram IDs werden verarbeitet
- Webhook-Secret verifiziert dass Requests von Telegram kommen
- Kein Public Access auf den Bot (kein `/start`-Command für Fremde)

---

## 11. Spätere Erweiterungen (Post-MVP)

Diese Features sind explizit **nicht** Teil des MVP, aber die Architektur soll sie nicht blockieren:

| Feature                  | Beschreibung                                                          |
| ------------------------ | --------------------------------------------------------------------- |
| **Are.na Sync**          | Posts automatisch als Blocks in einen Are.na Channel pushen           |
| **Kartenansicht**        | Alle Posts mit Location auf einer Leaflet-Karte                       |
| **work/private**         | Zweiter Bot oder `/work`-Command für öffentliche Posts                |
| **Editieren**            | `/edit` Command zum Nachbearbeiten des letzten Posts                  |
| **Löschen**              | `/delete` Command zum Entfernen des letzten Posts                     |
| **Video-Support**        | Kurze Videos einbetten (braucht externes Hosting, z.B. Cloudflare R2) |
| **Aquarium-Integration** | 360degre.es wird Teil von bewe.is als "Aquarium"-Sektion              |
| **RSS Feed**             | Für Leser die einen Feed-Reader nutzen                                |

---

## 12. Setup-Schritte

### Reihenfolge

```
1. Telegram Bot erstellen (@BotFather)
2. Astro-Repo aufsetzen (Grundstruktur, erster Dummy-Post)
3. GitHub Pages konfigurieren + Custom Domain 360degre.es
4. DNS bei Hostinger einrichten (A-Records + CNAME)
5. GitHub Actions Workflow erstellen
6. Cloudflare Worker schreiben + deployen
7. Telegram Webhook setzen (Bot → Worker URL)
8. Testen: Nachricht schicken → Post erscheint auf 360degre.es
9. Sandra zum Bot einladen
```

### Zeitschätzung

| Schritt                          | Aufwand     |
| -------------------------------- | ----------- |
| Telegram Bot + Cloudflare Worker | 2-3 Stunden |
| Astro-Repo + Layout + Styling    | 2-3 Stunden |
| GitHub Actions + DNS + Domain    | 1 Stunde    |
| Testing + Bugfixing              | 1-2 Stunden |
| **Gesamt**                       | **~1 Tag**  |

---

## 13. Offene Fragen

- [ ] Soll der Bot eine Bestätigungs-Nachricht mit Link zum Post schicken?
- [ ] Wie sollen mehrere Bilder dargestellt werden? Grid, Carousel, oder einfach untereinander?
- [ ] Soll es eine Monats- oder Tages-Gruppierung geben, oder ein reiner chronologischer Feed?
- [ ] Will Sandra den Bot-Namen sehen oder soll er "unsichtbar" sein (kein Bot-Branding)?
- [ ] Braucht ihr eine Möglichkeit Posts zu planen (z.B. Entwürfe die später veröffentlicht werden)?
