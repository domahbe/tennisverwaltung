# 🎾 TC Grün-Weiß – Tennisverwaltung & Platzbuchung

Moderne, Apple-inspirierte **Progressive Web App** für Tennisvereine: Platzbuchung in 3 Klicks, Mitglieder, Mannschaften, Turniere, Gastspieler, Wetter und Adminbereich – mobile-first für iPhone & Android.

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

- **Dashboard**: Begrüßung, Wetter mit Stundenverlauf & Warnungen, eigene Reservierungen (stornierbar), nächstes Punktspiel, Vereinsnews, Schnellbuchung
- **Platzbuchung in ≤ 3 Klicks**: FAB → freier Slot (vorausgewählt) → „Jetzt reservieren“. Zeitraster mit Ampelfarben (grün/orange/rot), Mitspieler & Gastspieler (inkl. Gebühr), Regeln (max. Dauer, Buchungslimit, Sperrzeiten), **Warteliste** mit Benachrichtigung
- **Kalender**: Tages-Timeline im Apple-Kalender-Stil (alle Plätze, Jetzt-Linie, Farbkodierung nach Buchungstyp) + Wochenansicht
- **Verein**: Newsfeed, Mitgliederliste mit Suche/Favoriten/Spielpartner-Filter, Mannschaften (Tabelle, Ergebnisse, nächste Spiele), Turniere mit An-/Abmeldung
- **Profil**: Mitteilungszentrale, Dark/Light Mode, Push-Berechtigung, DSGVO-Hinweise, Logout
- **Admin**: Auslastung pro Platz, beliebte Spielzeiten, Mitgliederaktivität, Gastgebühren, Audit-Log, Plätze sperren/freigeben
- **PWA**: installierbar (iOS & Android), Offline-Fallback, App-Shortcuts, Service Worker mit Network-first-API-Cache, Push-fähig

## Apple-inspiriertes Design

SF-Pro-Systemschrift, #007AFF als Primärfarbe, Frosted-Glass-Bottom-Bar, Karten mit 20 px Radius und sanften Schatten, Segmented Controls, Bottom Sheets mit Drag-to-dismiss, Skeleton Loader, Haptik (`navigator.vibrate`), Spring-Animationen (Framer Motion), Safe-Area-Unterstützung, nativer Date-Picker, Pull-to-Refresh.

## Technik

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js Route Handlers + In-Memory-Demo-Datenbank (`lib/store.ts`) mit Seed-Daten. Produktionsschema für **Supabase/PostgreSQL** inkl. RLS liegt in [`db/schema.sql`](db/schema.sql)
- **Auth**: HttpOnly-Session-Cookie mit Rollen (Mitglied/Trainer/Admin); produktiv via Supabase Auth austauschbar
- **Sicherheit**: rollenbasierte API-Zugriffe, Datensparsamkeit (Kontaktdaten nur für Admins), Audit-Log, TLS vorausgesetzt

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
