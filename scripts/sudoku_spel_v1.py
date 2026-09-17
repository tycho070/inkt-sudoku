# Sudoku-spel voor in de terminal (PowerShell / Command Prompt)
# Run met: python sudoku_spel.py

import copy
import random

def print_bord(bord):
    """Print het Sudoku-bord netjes met lijnen"""
    print("\n    1 2 3   4 5 6   7 8 9")
    print("  +-------+-------+-------+")
    for i, rij in enumerate(bord):
        if i % 3 == 0 and i != 0:
            print("  +-------+-------+-------+")
        regel = f"{i+1} | "
        for j, getal in enumerate(rij):
            if j % 3 == 0 and j != 0:
                regel += "| "
            regel += (str(getal) if getal != 0 else ".") + " "
        print(regel + "|")
    print("  +-------+-------+-------+\n")

def is_geldig(bord, rij, kolom, getal):
    """Controleer of een getal op die plek mag"""
    # Rij controleren
    if getal in bord[rij]:
        return False
    # Kolom controleren
    for i in range(9):
        if bord[i][kolom] == getal:
            return False
    # 3x3 vak controleren
    start_rij = 3 * (rij // 3)
    start_kolom = 3 * (kolom // 3)
    for i in range(start_rij, start_rij + 3):
        for j in range(start_kolom, start_kolom + 3):
            if bord[i][j] == getal:
                return False
    return True

def los_op(bord):
    """Lost de Sudoku op met backtracking"""
    for rij in range(9):
        for kolom in range(9):
            if bord[rij][kolom] == 0:
                for getal in range(1, 10):
                    if is_geldig(bord, rij, kolom, getal):
                        bord[rij][kolom] = getal
                        if los_op(bord):
                            return True
                        bord[rij][kolom] = 0
                return False
    return True

def is_opgelost(bord):
    """Controleer of het bord helemaal vol en geldig is"""
    for rij in range(9):
        for kolom in range(9):
            if bord[rij][kolom] == 0:
                return False
            getal = bord[rij][kolom]
            bord[rij][kolom] = 0
            if not is_geldig(bord, rij, kolom, getal):
                bord[rij][kolom] = getal
                return False
            bord[rij][kolom] = getal
    return True

# Een paar vaste puzzels (0 = leeg)
puzzels = [
    # Makkelijk
    [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9]
    ],
    # Medium
    [
        [0, 0, 0, 2, 6, 0, 7, 0, 1],
        [6, 8, 0, 0, 7, 0, 0, 9, 0],
        [1, 9, 0, 0, 0, 4, 5, 0, 0],
        [8, 2, 0, 1, 0, 0, 0, 4, 0],
        [0, 0, 4, 6, 0, 2, 9, 0, 0],
        [0, 5, 0, 0, 0, 3, 0, 2, 8],
        [0, 0, 9, 3, 0, 0, 0, 7, 4],
        [0, 4, 0, 0, 5, 0, 0, 3, 6],
        [7, 0, 3, 0, 1, 8, 0, 0, 0]
    ],
    # Moeilijk
    [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 3, 0, 8, 5],
        [0, 0, 1, 0, 2, 0, 0, 0, 0],
        [0, 0, 0, 5, 0, 7, 0, 0, 0],
        [0, 0, 4, 0, 0, 0, 1, 0, 0],
        [0, 9, 0, 0, 0, 0, 0, 0, 0],
        [5, 0, 0, 0, 0, 0, 0, 7, 3],
        [0, 0, 2, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 4, 0, 0, 0, 9]
    ]
]

def kies_puzzel():
    """Kies een willekeurige puzzel en maak een kopie"""
    return copy.deepcopy(random.choice(puzzels))

def speel():
    print("=" * 45)
    print("      SUDOKU SPEL - Terminal versie")
    print("=" * 45)
    print("\nCommando's die je kunt typen:")
    print("  rij kolom getal   →  bijv. 3 5 7   (zet 7 op rij 3, kolom 5)")
    print("  0                 →  wis een cel (bijv. 3 5 0)")
    print("  check             →  controleer of alles klopt")
    print("  oplos             →  laat de computer de puzzel oplossen")
    print("  nieuw             →  nieuwe puzzel")
    print("  stop              →  stop het spel")
    print("-" * 45)

    bord = kies_puzzel()
    origineel = copy.deepcopy(bord)   # bewaar de originele puzzel

    while True:
        print_bord(bord)
        invoer = input("Jouw zet of commando: ").strip().lower()

        if invoer == "stop":
            print("Bedankt voor het spelen! Tot ziens.")
            break

        elif invoer == "nieuw":
            bord = kies_puzzel()
            origineel = copy.deepcopy(bord)
            print("Nieuwe puzzel geladen!")
            continue

        elif invoer == "oplos":
            tijdelijk = copy.deepcopy(bord)
            if los_op(tijdelijk):
                bord = tijdelijk
                print("Puzzel opgelost!")
            else:
                print("Kon de puzzel niet oplossen.")
            continue

        elif invoer == "check":
            if is_opgelost(bord):
                print("Gefeliciteerd! Je hebt de Sudoku correct opgelost!")
            else:
                print("Nog niet klaar, of er zitten fouten in.")
            continue

        # Probeer een zet te lezen: rij kolom getal
        delen = invoer.split()
        if len(delen) == 3:
            try:
                rij = int(delen[0]) - 1
                kolom = int(delen[1]) - 1
                getal = int(delen[2])

                if not (0 <= rij <= 8 and 0 <= kolom <= 8 and 0 <= getal <= 9):
                    print("Ongeldige invoer. Gebruik getallen 1-9 voor rij/kolom en 0-9 voor getal.")
                    continue

                # Mag je deze cel wel veranderen? (originele getallen blijven staan)
                if origineel[rij][kolom] != 0:
                    print("Deze cel hoort bij de originele puzzel en mag je niet veranderen.")
                    continue

                if getal == 0:
                    bord[rij][kolom] = 0
                    print("Cel gewist.")
                elif is_geldig(bord, rij, kolom, getal):
                    bord[rij][kolom] = getal
                    print(f"Gezet: {getal} op rij {rij+1}, kolom {kolom+1}")
                else:
                    print("Die zet mag niet! Het getal komt al voor in de rij, kolom of het 3x3-vak.")
            except ValueError:
                print("Ongeldige invoer. Voorbeeld: 4 2 8")
        else:
            print("Onbekend commando. Probeer opnieuw.")

if __name__ == "__main__":
    speel()