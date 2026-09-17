"""Sudoku-engine voor Inkt.

Dit bestand bevat alleen de puzzel-logica: controleren, oplossen en
genereren. De klikbare interface staat in de map `web/`.

Een Sudoku-bord is een 9x9 raster. We gebruiken:
    0  = leeg vakje
    1-9 = een cijfer

Voorbeelden:
    python sudoku.py              # speel in de terminal
    python sudoku.py --oplos      # los een voorbeeldpuzzel op
    python start.py               # open het klikbare spel in de browser
"""

from __future__ import annotations

import argparse
import copy
import random
from typing import Literal

# Type-alias: een bord is een lijst van 9 rijen, elke rij 9 getallen.
Grid = list[list[int]]
Difficulty = Literal["easy", "medium", "hard"]

# Hoeveel ingevulde startcijfers we nastreven per niveau.
# Minder cijfers = moeilijker.
GIVENS: dict[Difficulty, int] = {
    "easy": 40,
    "medium": 32,
    "hard": 26,
}

# Bekende unieke oefenpuzzel (het klassieke "easy" voorbeeld).
STARTER_PUZZLE: Grid = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
]

STARTER_SOLUTION: Grid = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9],
]


def leeg_bord() -> Grid:
    """Maak een leeg 9x9 bord (alleen nullen).

    Returns:
        Een nieuw bord. Elke cel is 0.
    """
    return [[0 for _ in range(9)] for _ in range(9)]


def kopieer_bord(bord: Grid) -> Grid:
    """Kopieer een bord zodat de originele lijst niet wijzigt.

    Args:
        bord: Het bord dat je wilt kopiëren.

    Returns:
        Een diepe kopie (nieuwe rijen, nieuwe cellen).
    """
    return copy.deepcopy(bord)


def zet_is_geldig(bord: Grid, rij: int, kolom: int, cijfer: int) -> bool:
    """Controleer of `cijfer` op (rij, kolom) mag volgens Sudoku-regels.

    Een zet is geldig als het cijfer nog niet voorkomt in:
    - dezelfde rij
    - dezelfde kolom
    - hetzelfde 3x3-blok

    Belangrijk: deze functie kijkt NIET naar de huidige waarde van de cel
    zelf. Roep hem alleen aan op een lege cel, of zet de cel eerst tijdelijk
    op 0 (zie `cel_heeft_conflict`).

    Args:
        bord: Huidige puzzel.
        rij: Rij-index 0..8 (bovenste rij = 0).
        kolom: Kolom-index 0..8 (linker kolom = 0).
        cijfer: Getal 1..9.

    Returns:
        True als de zet mag, anders False.
    """
    # Rij
    if cijfer in bord[rij]:
        return False

    # Kolom
    for r in range(9):
        if bord[r][kolom] == cijfer:
            return False

    # 3x3-blok. // 3 * 3 springt naar de linkerbovenhoek van het blok.
    start_rij = (rij // 3) * 3
    start_kolom = (kolom // 3) * 3
    for r in range(start_rij, start_rij + 3):
        for c in range(start_kolom, start_kolom + 3):
            if bord[r][c] == cijfer:
                return False

    return True


def cel_heeft_conflict(bord: Grid, rij: int, kolom: int) -> bool:
    """Kijk of het cijfer dat nu in de cel staat botst met de regels.

    Args:
        bord: Huidige puzzel.
        rij: Rij-index 0..8.
        kolom: Kolom-index 0..8.

    Returns:
        True als de cel gevuld is én ongeldig is.
    """
    cijfer = bord[rij][kolom]
    if cijfer == 0:
        return False

    # Haal het cijfer even weg, anders "ziet" de check zichzelf als duplicaat.
    bord[rij][kolom] = 0
    geldig = zet_is_geldig(bord, rij, kolom, cijfer)
    bord[rij][kolom] = cijfer
    return not geldig


def conflict_kaart(bord: Grid) -> list[list[bool]]:
    """Geef per cel aan of die botst.

    Returns:
        9x9 grid met True op plekken waar een fout staat.
    """
    return [[cel_heeft_conflict(bord, r, c) for c in range(9)] for r in range(9)]


def _eerste_lege_cel(bord: Grid) -> tuple[int, int] | None:
    """Zoek de volgende lege cel, van links naar rechts, boven naar beneden.

    Returns:
        (rij, kolom) of None als het bord vol is.
    """
    for rij in range(9):
        for kolom in range(9):
            if bord[rij][kolom] == 0:
                return rij, kolom
    return None


def _geschudde_cijfers() -> list[int]:
    """Geef de cijfers 1..9 in willekeurige volgorde (Fisher-Yates)."""
    cijfers = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    random.shuffle(cijfers)
    return cijfers


def los_op(bord: Grid, willekeurig: bool = False) -> bool:
    """Los het bord op met backtracking. Wijzigt `bord` ter plaatse.

    Backtracking werkt zo:
    1. Zoek een leeg vakje.
    2. Probeer cijfers 1 t/m 9.
    3. Als een cijfer mag, zet het en ga recursief verder.
    4. Lukt het daarna niet? Zet het vakje weer op 0 en probeer het volgende.

    Args:
        bord: Puzzel die ingevuld mag worden.
        willekeurig: True = cijfers in random volgorde (nodig bij genereren).

    Returns:
        True als er een oplossing is gevonden.
    """
    leeg = _eerste_lege_cel(bord)
    if leeg is None:
        return True

    rij, kolom = leeg
    cijfers = _geschudde_cijfers() if willekeurig else list(range(1, 10))

    for cijfer in cijfers:
        if zet_is_geldig(bord, rij, kolom, cijfer):
            bord[rij][kolom] = cijfer
            if los_op(bord, willekeurig=willekeurig):
                return True
            bord[rij][kolom] = 0  # terugdraaien (backtrack)

    return False


def tel_oplossingen(bord: Grid, limiet: int = 2) -> int:
    """Tel hoeveel oplossingen een puzzel heeft, tot `limiet`.

    Voor een "echte" Sudoku willen we precies 1 oplossing. We stoppen
    daarom vaak bij 2: 0 = onoplosbaar, 1 = uniek, 2+ = meerdere.

    Args:
        bord: Puzzel (wordt tijdens het zoeken tijdelijk beschreven,
            maar altijd teruggezet).
        limiet: Stop met tellen als dit aantal is bereikt.

    Returns:
        Aantal gevonden oplossingen (maximaal `limiet`).
    """
    aantal = 0

    def zoek() -> None:
        nonlocal aantal
        if aantal >= limiet:
            return
        leeg = _eerste_lege_cel(bord)
        if leeg is None:
            aantal += 1
            return
        rij, kolom = leeg
        for cijfer in range(1, 10):
            if zet_is_geldig(bord, rij, kolom, cijfer):
                bord[rij][kolom] = cijfer
                zoek()
                bord[rij][kolom] = 0
                if aantal >= limiet:
                    return

    zoek()
    return aantal


def is_af_en_geldig(bord: Grid) -> bool:
    """True als elk vakje vol is en nergens een conflict staat."""
    for rij in range(9):
        for kolom in range(9):
            if bord[rij][kolom] == 0 or cel_heeft_conflict(bord, rij, kolom):
                return False
    return True


def resterende_cijfers(bord: Grid) -> list[int]:
    """Hoe vaak elk cijfer 1..9 nog mag voorkomen (start = 9).

    Index 0 wordt niet gebruikt. Index 1 = hoeveel 1-en nog kwijt kunnen.

    Returns:
        Lijst van lengte 10.
    """
    counts = [0, 9, 9, 9, 9, 9, 9, 9, 9, 9]
    for rij in bord:
        for waarde in rij:
            if waarde:
                counts[waarde] -= 1
    return counts


def genereer_puzzel(niveau: Difficulty = "easy") -> tuple[Grid, Grid]:
    """Maak een nieuwe puzzel met (bijna altijd) één unieke oplossing.

    Stappen:
    1. Vul een leeg bord volledig (random backtracking).
    2. Verwijder willekeurige cellen.
    3. Zet een cel alleen leeg als de puzzel uniek blijft.

    Args:
        niveau: "easy", "medium" of "hard".

    Returns:
        (puzzel, oplossing) — beide 9x9 rasters.
    """
    oplossing = leeg_bord()
    los_op(oplossing, willekeurig=True)

    puzzel = kopieer_bord(oplossing)
    cellen = [(r, c) for r in range(9) for c in range(9)]
    random.shuffle(cellen)

    doel = GIVENS[niveau]
    gevuld = 81
    for rij, kolom in cellen:
        if gevuld <= doel:
            break
        backup = puzzel[rij][kolom]
        puzzel[rij][kolom] = 0
        # Uniek? Zo niet, het cijfer terugzetten.
        if tel_oplossingen(kopieer_bord(puzzel), limiet=2) != 1:
            puzzel[rij][kolom] = backup
        else:
            gevuld -= 1

    return puzzel, oplossing


def print_bord(bord: Grid) -> None:
    """Print het bord met 3x3-lijnen. Lege cellen worden een punt."""
    print("    1 2 3   4 5 6   7 8 9")
    print("  +-------+-------+-------+")
    for i, rij in enumerate(bord):
        if i % 3 == 0 and i != 0:
            print("  +-------+-------+-------+")
        stukken = []
        for j, waarde in enumerate(rij):
            if j % 3 == 0 and j != 0:
                stukken.append("|")
            stukken.append(str(waarde) if waarde else ".")
        print(f"{i + 1} | {' '.join(stukken)} |")
    print("  +-------+-------+-------+")


def _terminal_spel() -> None:
    """Klein terminal-spel: typ `rij kolom cijfer`, of een commando."""
    puzzel, _oplossing = genereer_puzzel("easy")
    origineel = kopieer_bord(puzzel)
    bord = kopieer_bord(puzzel)

    print("Inkt — terminal-Sudoku")
    print("Zet:    3 5 7     (rij 3, kolom 5, cijfer 7)")
    print("Wissen: 3 5 0")
    print("Verder: check | oplos | nieuw | stop")

    while True:
        print_bord(bord)
        tekst = input("Jouw zet: ").strip().lower()
        if tekst == "stop":
            print("Tot ziens.")
            return
        if tekst == "nieuw":
            puzzel, _oplossing = genereer_puzzel("easy")
            origineel = kopieer_bord(puzzel)
            bord = kopieer_bord(puzzel)
            continue
        if tekst == "oplos":
            kopie = kopieer_bord(bord)
            if los_op(kopie):
                bord = kopie
                print("Opgelost.")
            else:
                print("Geen oplossing.")
            continue
        if tekst == "check":
            if is_af_en_geldig(bord):
                print("Gefeliciteerd, de puzzel klopt.")
            else:
                print("Nog niet klaar, of er staan fouten in.")
            continue

        delen = tekst.split()
        if len(delen) != 3:
            print("Gebruik: rij kolom cijfer")
            continue
        try:
            rij = int(delen[0]) - 1
            kolom = int(delen[1]) - 1
            cijfer = int(delen[2])
        except ValueError:
            print("Alleen hele getallen, bijvoorbeeld: 4 2 8")
            continue

        if not (0 <= rij <= 8 and 0 <= kolom <= 8 and 0 <= cijfer <= 9):
            print("Rij/kolom 1-9, cijfer 0-9.")
            continue
        if origineel[rij][kolom] != 0:
            print("Dit is een startcijfer, dat mag je niet wijzigen.")
            continue
        if cijfer == 0:
            bord[rij][kolom] = 0
            continue

        # Tijdelijk leeg maken om de check zuiver te houden
        oud = bord[rij][kolom]
        bord[rij][kolom] = 0
        mag = zet_is_geldig(bord, rij, kolom, cijfer)
        bord[rij][kolom] = oud
        if not mag:
            print("Die zet botst in de rij, kolom of het blok.")
            continue
        bord[rij][kolom] = cijfer


def main() -> None:
    """Startpunt als je `python sudoku.py` draait."""
    parser = argparse.ArgumentParser(description="Sudoku-engine van Inkt")
    parser.add_argument(
        "--oplos",
        action="store_true",
        help="Los de voorbeeldpuzzel op en toon het resultaat.",
    )
    parser.add_argument(
        "--niveau",
        choices=["easy", "medium", "hard"],
        default="easy",
        help="Niveau voor een nieuwe puzzel.",
    )
    args = parser.parse_args()

    if args.oplos:
        bord = kopieer_bord(STARTER_PUZZLE)
        print("Voorbeeldpuzzel:")
        print_bord(bord)
        if los_op(bord):
            print("Oplossing:")
            print_bord(bord)
        else:
            print("Geen oplossing.")
        return

    _terminal_spel()


if __name__ == "__main__":
    main()
