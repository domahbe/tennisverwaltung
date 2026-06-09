# API-Architektur

REST-artige Route Handler unter `app/api/**`. Alle Endpunkte (außer Login/Wetter) erfordern eine Session (HttpOnly-Cookie `tcgw_session`). Antworten sind JSON; Fehler haben die Form `{ "error": "…" }` mit passendem HTTP-Status (401/403/404/409).

## Authentifizierung

| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ memberId }` → setzt Session-Cookie, gibt `user` zurück |
| POST | `/api/auth/logout` | löscht die Session |
| GET | `/api/auth/me` | aktueller Benutzer (`401` ohne Session) |

*Produktion: Supabase Auth (E-Mail/Passwort, Magic Link, Passkeys); die Session-Schicht in `lib/auth.ts` ist die einzige Austauschstelle.*

## Plätze & Buchungen

| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| GET | `/api/courts?date=YYYY-MM-DD` | Plätze inkl. Stunden-Slots mit Status (`free/soon/busy/blocked/past`), Tagesbuchungen, Wetter, Vereinsregeln |
| PATCH | `/api/courts/:id` | `{ blocked, reason }` – sperren/freigeben (nur Trainer/Admin) |
| GET | `/api/bookings?mine=1&date=…` | Buchungen (eigene/alle), angereichert mit Platz & Spielernamen |
| POST | `/api/bookings` | `{ courtId, date, startHour, durationHours, players[], guests[], type }` – validiert alle Regeln; `409` mit `waitlistSuggested` bei Konflikt |
| DELETE | `/api/bookings/:id` | stornieren (Eigentümer/Admin); löst Wartelisten-Benachrichtigung aus |
| POST | `/api/waitlist` | `{ courtId?, date, startHour }` – auf Warteliste setzen |

## Verein

| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| GET | `/api/members?q=…` | Suche; Kontaktdaten nur für Admins (Datensparsamkeit) |
| POST | `/api/members/favorites` | `{ memberId }` – Favorit umschalten |
| GET | `/api/news` | Newsfeed (gepinnte zuerst) |
| GET | `/api/teams` | Mannschaften inkl. Spieler, Tabelle, Ergebnisse, nächstes Spiel |
| GET/POST | `/api/tournaments` | Liste / `{ tournamentId, action: register\|unregister }` |
| GET/POST | `/api/notifications` | eigene Mitteilungen / alle als gelesen markieren |
| GET | `/api/weather?date=…` | Wetter & Bespielbarkeit (Demo deterministisch; Produktion: DWD/OpenWeather) |
| GET | `/api/admin/stats` | Auslastung, beliebte Zeiten, Aktivität, Gastgebühren, Audit-Log (nur Admin) |

## Sicherheits-Schichten

1. **Session**: HttpOnly + SameSite=Lax-Cookie, 30 Tage
2. **Rollenprüfung** in jedem Handler (`currentUser().role`)
3. **Eigentümerprüfung** bei Mutationen (Buchung stornieren etc.)
4. **Audit-Log** für jede schreibende Aktion
5. Produktion zusätzlich: Postgres **Row Level Security** (siehe `db/schema.sql`), TLS, EU-Hosting (DSGVO)

## Echtzeit-Updates

Demo: Aktualisierung über Pull-to-Refresh und Neuladen nach Mutationen. Produktion: Supabase Realtime-Subscription auf `bookings` und `news_posts` ersetzt das Polling – die Lade-Funktionen der Screens (`load()`) sind dafür bereits zentralisiert.
