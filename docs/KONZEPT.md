# UX/UI-Konzept & Design-System

## 1. Leitidee

„**Tennis buchen so einfach wie eine iPhone-App bedienen.**" Die App fühlt sich an wie eine native iOS-App: ruhige Flächen, große Typografie, klare Hierarchie, sofortiges Feedback. Der Kern-Flow – einen Platz buchen – ist in **maximal 3 Klicks** abgeschlossen.

## 2. Informationsarchitektur

```
Bottom Navigation (5 Tabs)
├── Heute        Dashboard: Begrüßung, Wetter, Reservierungen, nächstes Spiel, News
├── Buchen       Platzübersicht + Zeitraster + Buchungs-Sheet
├── Kalender     Tages-Timeline (Apple-Kalender-Stil) / Wochenansicht
├── Verein       Segmented: News | Mitglieder | Teams | Turniere
└── Profil       Mitteilungen, Dark Mode, Push, Trainer-/Adminbereich, Logout

Floating Action Button (global, außer auf „Buchen")
└── öffnet Buchungs-Sheet mit dem nächsten freien Slot vorausgewählt
```

### Der 3-Klick-Buchungsflow

1. **Klick 1** – FAB „+" (oder „Platz buchen" auf dem Dashboard): App schlägt automatisch den nächsten freien Slot vor, Sheet öffnet sich.
2. **Klick 2** – optional Slot/Dauer/Mitspieler anpassen (entfällt, wenn der Vorschlag passt).
3. **Klick 3** – „Jetzt reservieren" → haptisches Feedback, Toast-Bestätigung, Push-Mitteilung.

Alternativ: Tab „Buchen" → freien Slot im Zeitraster antippen → bestätigen (ebenfalls 3 Klicks).

## 3. Design-System

### Farben

| Token | Light | Dark | Verwendung |
| --- | --- | --- | --- |
| `--primary` | #007AFF | #0A84FF | Aktionen, aktive Tabs, FAB |
| `--bg` | #F5F5F7 | #000000 | App-Hintergrund |
| `--card` | #FFFFFF | #1C1C1E | Karten |
| `--text` | #1D1D1F | #F5F5F7 | Primärtext |
| `--text-secondary` | #6E6E73 | #98989D | Sekundärtext |
| Frei | #34C759 | – | freie Slots |
| Bald belegt | #FF9500 | – | Slots < 2 h / wenige frei |
| Belegt | #FF3B30 | – | belegte Slots, destruktive Aktionen |

### Typografie

Systemschrift-Stack (`-apple-system, SF Pro Display/Text, Inter, Roboto`). Skala:

- Seitentitel 32 px bold, tracking-tight (Large Title)
- Sektionstitel 20 px bold
- Karten-Titel 16–17 px semibold
- Body 15 px, Sekundär 13 px, Caption 11–12 px

### Komponenten

- **Karten**: 20 px Radius, weicher Doppel-Schatten, in Dark Mode 0.5 px-Hairline
- **Frosted Glass**: Bottom-Bar & Toasts mit `backdrop-filter: saturate(180%) blur(20px)`
- **Segmented Control**: animierter Thumb (Framer Motion `layoutId`)
- **Bottom Sheet**: Spring-Animation, Grabber, Drag-to-dismiss
- **FAB**: 56 px, Primärfarbe, farbiger Schatten, Scale-Feedback
- **Skeleton Loader**: Shimmer statt Spinner
- **Toasts**: Glass-Pille von oben, mit Haptik
- **Status**: farbiger Punkt + Label (Frei / Bald belegt / Belegt / Gesperrt)

### Motion

- Easing `cubic-bezier(0.25, 0.1, 0.25, 1)`, Springs (stiffness 380–500, damping 28–38)
- Seitenübergänge: Fade + 8 px Y-Versatz (200 ms)
- Listen: gestaffeltes Einblenden (50–60 ms Versatz)
- Pressed-State: `scale(0.96)` wie UIKit
- Haptik über `navigator.vibrate` bei Auswahl, Buchung, Fehlern

### Mobile/Native-Gefühl

- Safe-Area-Insets (`env(safe-area-inset-*)`), `viewport-fit=cover`
- Touchflächen ≥ 44 px, `-webkit-tap-highlight-color: transparent`
- Pull-to-Refresh mit rotierendem Tennisball
- Nativer `<input type="date">` als Date-Picker
- Kein Text-Select, kein Zoom (standalone App-Gefühl)
- Dark Mode ohne Flash (Inline-Script vor Hydration)

## 4. Responsive Verhalten

- **Mobil (Priorität)**: einspaltig, max-w-lg zentriert, Bottom-Nav + FAB
- **Tablet/Desktop**: gleiche zentrierte Spalte (App-Charakter bleibt erhalten), Kalender-Timeline nutzt die Breite für alle 6 Plätze
