# Neural Planner

Een to-do / project-tracker die je taken laat zien als een **netwerk**: elke taak is een knoop, en pijlen tonen wat eerst moet. Werkt op laptop én telefoon, ook offline, en je kunt hem installeren als app.

Geen build-stap, geen packages: gewone HTML, CSS en JavaScript.

## Wat kun je ermee?

- **Projecten** met naam, GitHub-repo, status, deadline en beschrijving
- **Taken** als knopen, met status (te doen / bezig / klaar), prioriteit en notities
- **Verbindingen** tussen taken: een pijl van A naar B betekent "eerst A, dan B"
- **Netwerk- of lijstweergave**. De lijst groepeert per status en toont "wacht op N" als een eerdere taak nog niet klaar is
- **Deadline-waarschuwing**: geel als de deadline binnen 3 dagen is, rood als hij verlopen is
- **Back-up**: exporteren en importeren als JSON-bestand
- Alles blijft lokaal in je browser (`localStorage`). Er gaat niets naar een server.

## Starten

In deze map:

```powershell
python -m http.server 8080
```

Ga daarna naar `http://127.0.0.1:8080`. Je kunt `index.html` ook direct openen, maar dan werkt de offline-modus niet.

## Bediening

| Actie | Muis | Touch |
| --- | --- | --- |
| Taak openen | Klik op een knoop | Tik op een knoop |
| Nieuwe taak | Dubbelklik op lege ruimte, of `+ Taak` | Dubbeltik op lege ruimte, of `+ Taak` |
| Taak verplaatsen | Sleep een knoop | Sleep een knoop |
| Verbinden (eerst → daarna) | **Shift + sleep** van knoop naar knoop | **Houd een knoop vast** en sleep naar een andere |
| Verbinding verwijderen | × bij "Verbindingen" in het taakpaneel | idem |
| Zoomen | Muiswiel | Knijpen met twee vingers |
| Pannen | Sleep op lege ruimte | Sleep op lege ruimte |
| Project bewerken | Dubbelklik op het project | Tik op het project dat al actief is |
| Ordenen | Knop **Orden netwerk** | idem |
| Projectenpaneel in-/uitklappen | Pijlknop naast de naam linksboven | idem (klapt de projectenlijst omhoog weg) |

Wijzigingen aan een taak worden automatisch opgeslagen.

## Op je telefoon (web-app)

Open de online versie en kies **Zet op beginscherm**: op iPhone via de deelknop in Safari, op Android via het menu ⋮ in Chrome. Neural Planner opent dan als een eigen app en werkt ook offline.

Let op: je data staat per browser of apparaat. Wil je overstappen naar een ander apparaat, gebruik dan **Exporteer** en daar **Importeer**.

## Mapstructuur

```text
index.html
css/styles.css
js/store.js      ← datamodel, opslag, export/import (normalizeState)
js/graph.js      ← canvas: tekenen, muis/touch, zoomen
js/app.js        ← schermen, formulieren, lijstweergave
sw.js            ← service worker (offline)
manifest.webmanifest, icon.svg, icon-*.png   ← installeerbare app
```

Nieuw bestand toegevoegd? Zet het ook in `FILES` in `sw.js`, anders werkt het offline niet.

## Design

Donkere "neural workspace"-stijl: gloeiende knopen, pulserende verbindingen, en de lettertypes Syne en IBM Plex.

## Vroeger: Synapse

De app heette eerst **Synapse** en stond online op `/inkt-sudoku/synapse/`. Dat adres stuurt je nu door naar `/inkt-sudoku/neural-planner/`. Je data blijft gewoon staan (de opslagsleutel `synapse-v1` is bewust niet veranderd). Had je de oude app op je beginscherm gezet? Verwijder die en installeer Neural Planner opnieuw. Oude back-ups van Synapse kun je gewoon importeren.
