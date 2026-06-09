# Datenmodell

Vollständiges SQL-Schema: [`db/schema.sql`](../db/schema.sql). TypeScript-Typen: [`lib/types.ts`](../lib/types.ts).

## Entitäten & Beziehungen

```
members ───< bookings >─── courts
   │            │
   │            ├──< booking_players (n:m Mitspieler)
   │            └──< booking_guests  (Gastspieler + Gebühr)
   │
   ├──< waitlist >─── courts (optional)
   ├──< favorites (n:m auf members)
   ├──< notifications
   ├──< team_players >─── teams ──< team_results
   ├──< tournament_participants >─── tournaments
   └──< audit_log

news_posts (eigenständig)
club_settings (Singleton: Regeln)
```

## Kernentitäten

| Entität | Wichtige Felder | Anmerkungen |
| --- | --- | --- |
| **members** | name, email, phone, skill_level (LK), role, status, looking_for_partner | Rollen: member, trainer, admin, guest. DSGVO: Kontaktdaten nur für Admins sichtbar |
| **courts** | name, surface, indoor, floodlight, blocked, blocked_reason, maintenance_until | Outdoor-Plätze werden bei Regen/Gewitter automatisch unbespielbar |
| **bookings** | court_id, date, start_hour, duration_hours, member_id, type, title | Typen: einzel, doppel, training, punktspiel, wartung, sperrung. Überlappungs-Constraint |
| **booking_guests** | name, fee, paid | Gebühr = Stundensatz × Dauer, digitale Zahlung |
| **waitlist** | member_id, court_id (nullable = beliebig), date, start_hour | Bei Stornierung: Push an Wartende, Eintrag wird aufgelöst |
| **teams** | name, league, captain_id, position, matches_won/lost | + team_results (Spieltage/Ergebnisse), next_match |
| **tournaments** | type, start/end, registration_deadline, max_participants, status, fee | Status: anmeldung → auslosung → laufend → beendet |
| **notifications** | member_id, title, body, type, read | Typen: booking, waitlist, tournament, news, weather |
| **club_settings** | max_booking_hours, max_active_bookings, opening/closing_hour, guest_fee | konfigurierbare Buchungsregeln |
| **audit_log** | actor, action, at | jede schreibende Aktion (DSGVO-Nachweis) |

## Geschäftsregeln (lib/booking.ts)

1. Buchung nur innerhalb der Öffnungszeiten (Standard 7–22 Uhr)
2. Maximale Dauer pro Buchung: `max_booking_hours` (Standard 2 h; Trainer/Admin ausgenommen)
3. Maximal `max_active_bookings_per_member` offene Buchungen (Standard 3)
4. Keine Überlappung mit bestehenden Buchungen → Wartelisten-Angebot
5. Gesperrte Plätze und Wetter-Sperrungen (Outdoor bei Regen/Gewitter) sind nicht buchbar
6. Slot-Status: `free` → `soon` (Beginn < 2 h) → `busy` → `blocked`/`past`
