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

De Python-engine is expres uitgebreid van commentaar voorzien, zodat je later kunt teruglezen hoe backtracking werkt.
