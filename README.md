# Inkt

Klikbare Sudoku in de browser, plus een Python-engine die je kunt lezen en aanpassen.

Dit is een schoolvriendelijk project (geen extra packages). Alles draait met gewone Python 3.

## Mapstructuur

```
inkt-sudoku/
  sudoku.py      ← puzzel-logica (docstrings, backtracking)
  start.py       ← opent het klikbare spel in je browser
  web/           ← HTML / CSS / JavaScript (de interface)
  README.md
```

## Starten

In PowerShell of de VS Code-terminal, in deze map:

```powershell
python start.py
```

De browser opent vanzelf. Stoppen: `Ctrl+C` in de terminal.

Alleen de engine / terminal-versie:

```powershell
python sudoku.py
python sudoku.py --oplos
```

## Op je telefoon (web-app)

De map `web/` is een complete web-app (PWA): alles draait in JavaScript, er is geen
Python-server nodig. Zet de map `web/` op een gratis host (GitHub Pages, Netlify,
Cloudflare Pages) en deel de link.

Op de telefoon: open de link en kies **Zet op beginscherm** (iPhone: deelknop in
Safari; Android: menu ⋮ in Chrome). Dan opent Inkt als een eigen app, werkt het
offline en wordt je spel automatisch bewaard.

Nieuwe versie online gezet? Verhoog `CACHE` in `web/sw.js` (bijv. `inkt-v2`),
dan halen telefoons de nieuwe bestanden op.

## Op GitHub zetten

1. Maak een nieuwe repository op GitHub (leeg, zonder README).
2. In deze map:

```powershell
git init
git add .
git commit -m "Eerste versie van Inkt sudoku"
git branch -M main
git remote add origin https://github.com/JOUWNAAM/inkt-sudoku.git
git push -u origin main
```

Vervang `JOUWNAAM` door je GitHub-gebruikersnaam.

## Waar pas je wat aan?

| Wat wil je veranderen? | Bestand |
| --- | --- |
| Regels, generator, oplosser | `sudoku.py` |
| Kleuren, lettertypes | `web/style.css` |
| Klikken, toetsenbord, knoppen | `web/game.js` |
| Teksten op het scherm | `web/index.html` |
| App-naam, icoon, offline | `web/manifest.webmanifest`, `web/sw.js` |

De Python-engine is expres uitgebreid van commentaar voorzien, zodat je later kunt teruglezen hoe backtracking werkt.
