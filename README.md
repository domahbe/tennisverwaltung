# 🎾 TC Graben-Neudorf – Tennisverwaltung & Platzbuchung

Moderne, Apple-inspirierte **Progressive Web App** für Tennisvereine: Platzbuchung in 3 Klicks, Mitglieder, Mannschaften, Turniere, Gastspieler, Wetter und Adminbereich – mobile-first für iPhone & Android.

## 📱 Live-Demo

**https://domahbe.github.io/tennisverwaltung/**

Direkt auf dem Handy in Safari/Chrome öffnen. Als App installieren:

- **iPhone (Safari)**: Teilen-Button → „Zum Home-Bildschirm"
- **Android (Chrome)**: Menü ⋮ → „App installieren"

Jeder Push auf diesen Branch wird automatisch per GitHub Actions auf GitHub Pages veröffentlicht (`.github/workflows/deploy.yml`).

## Schnellstart

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Produktions-Build
npm start          # Produktionsserver
```

Beim ersten Aufruf auf der Login-Seite eine Demo-Rolle wählen:

| Rolle | Demo-Nutzer | Sieht zusätzlich |
| --- | --- | --- |
| Mitglied | Anna Becker (LK 8) | – |
| Trainer | Carlos Romero | Platzsperrung / Trainerzeiten |
| Admin | Peter Lindner | Statistik-Dashboard, Platz- & Mitgliederverwaltung, Audit-Log |

## Features

- **Dashboard**: Begrüßung, Live-Wetter für Graben-Neudorf (Open-Meteo) mit Stundenverlauf & Warnungen, eigene Reservierungen (stornierbar), nächstes Punktspiel, Vereinsnews, Schnellbuchung
- **Platzbuchung in ≤ 3 Klicks**: FAB → freier Slot (vorausgewählt) → „Jetzt reservieren“. Zeitraster mit Ampelfarben (grün/orange/rot), Mitspieler & Gastspieler (inkl. Gebühr), Regeln (max. Dauer, Buchungslimit, Sperrzeiten), **Warteliste** mit Benachrichtigung
- **Kalender**: Tages-Timeline im Apple-Kalender-Stil (alle Plätze, Jetzt-Linie, Farbkodierung nach Buchungstyp) + Wochenansicht
- **Verein**: Newsfeed, Mitgliederliste mit Suche/Favoriten/Spielpartner-Filter, Mannschaften (Tabelle, Ergebnisse, nächste Spiele), Turniere mit An-/Abmeldung
- **Profil**: Mitteilungszentrale, Dark/Light Mode, Push-Berechtigung, DSGVO-Hinweise, Logout
- **Admin**: Auslastung pro Platz, beliebte Spielzeiten, Mitgliederaktivität, Gastgebühren, Audit-Log, Plätze sperren/freigeben
- **PWA**: installierbar (iOS & Android), Offline-Fallback, App-Shortcuts, Service Worker mit Network-first-API-Cache, Push-fähig

## Apple-inspiriertes Design

SF-Pro-Systemschrift, #007AFF als Primärfarbe, Frosted-Glass-Bottom-Bar, Karten mit 20 px Radius und sanften Schatten, Segmented Controls, Bottom Sheets mit Drag-to-dismiss, Skeleton Loader, Haptik (`navigator.vibrate`), Spring-Animationen (Framer Motion), Safe-Area-Unterstützung, nativer Date-Picker, Pull-to-Refresh.

## Technik

- **Frontend**: Next.js 14 (App Router, statischer Export), React 18, TypeScript, Tailwind CSS, Framer Motion
- **Demo-Backend**: Die veröffentlichte Demo läuft komplett im Browser – `lib/clientApi.ts` emuliert die REST-API aus [`docs/API.md`](docs/API.md) auf der Demo-Datenbank (`lib/store.ts`) und persistiert in `localStorage` (Daten bleiben pro Gerät erhalten, Demo-Seed wird täglich aufgefrischt)
- **Produktion**: Schema für **Supabase/PostgreSQL** inkl. Row Level Security liegt in [`db/schema.sql`](db/schema.sql); `apiFetch()` wird dann durch echte `fetch()`-Aufrufe ersetzt – die Screens bleiben unverändert
- **Sicherheit**: rollenbasierte Zugriffe, Datensparsamkeit (Kontaktdaten nur für Admins), Audit-Log; produktiv zusätzlich TLS, RLS, EU-Hosting (DSGVO)

## Dokumentation

- [`docs/KONZEPT.md`](docs/KONZEPT.md) – UX/UI-Konzept & Design-System
- [`docs/DATENMODELL.md`](docs/DATENMODELL.md) – Datenmodell & Entitäten
- [`docs/API.md`](docs/API.md) – API-Architektur
- [`db/schema.sql`](db/schema.sql) – PostgreSQL/Supabase-Schema mit Row Level Security

## Projektstruktur

```
app/                  # Next.js App Router
  (tabs)/             # Screens mit Bottom-Navigation (Dashboard, Buchen, Kalender, Verein, Profil, Admin)
  api/                # REST-Endpunkte (Auth, Courts, Bookings, Members, Teams, Tournaments, …)
  login/              # Demo-Login
components/           # UI-Bausteine (BottomNav, FAB, Sheet, Segmented, Skeleton, …)
lib/                  # Typen, Demo-Datenbank, Buchungsregeln, Auth
public/               # PWA: Manifest, Service Worker, Icons, Offline-Seite
db/schema.sql         # Produktions-Datenbankschema
```
