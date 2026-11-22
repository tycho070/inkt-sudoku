/**
 * Klikbare Sudoku-interface van Inkt.
 *
 * Dit bestand is de "voorkant": klikken, toetsenbord, tekenen van het bord.
 * De regels (mag dit cijfer hier?) staan hieronder, spiegel van sudoku.py.
 *
 * Spelverloop:
 * 1. Klik een vakje (selectie).
 * 2. Klik een cijfer 1-9 (of toetsenbord).
 * 3. Startcijfers (vet) kun je niet wijzigen.
 */

"use strict";

/** @typedef {number[][]} Grid */

/** Startpuzzel, dezelfde als in sudoku.py. */
const STARTER_PUZZLE = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

const STARTER_SOLUTION = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

const GIVENS = { easy: 40, medium: 32, hard: 26 };

/** Draait `start.py` (Python-server)? Online (bijv. GitHub Pages) is er geen API. */
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

/** Sleutel waaronder het spel in de browser wordt bewaard. */
const SAVE_KEY = "inkt-spel-v1";

/** @type {object} */
const state = {
  values: clone(STARTER_PUZZLE),
  givens: givensFrom(STARTER_PUZZLE),
  notes: emptyNotes(),
  solution: clone(STARTER_SOLUTION),
  selected: null,
  notesMode: false,
  difficulty: "easy",
  status: "playing",
  startedAt: Date.now(),
  frozenMs: null,
  history: [],
};

function clone(grid) {
  return grid.map((row) => row.slice());
}

function emptyNotes() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function givensFrom(puzzle) {
  return puzzle.map((row) => row.map((v) => v !== 0));
}

/**
 * Mag `value` op deze lege plek?
 * @param {Grid} grid
 * @param {number} row
 * @param {number} col
 * @param {number} value
 */
function isValidPlacement(grid, row, col, value) {
  for (let i = 0; i < 9; i++) {
    if (grid[row][i] === value) return false;
    if (grid[i][col] === value) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[br + r][bc + c] === value) return false;
    }
  }
  return true;
}

function cellHasConflict(grid, row, col) {
  const value = grid[row][col];
  if (!value) return false;
  grid[row][col] = 0;
  const ok = isValidPlacement(grid, row, col, value);
  grid[row][col] = value;
  return !ok;
}

function findEmpty(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
}

function shuffledDigits() {
  const d = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = 8; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/** Backtracking-oplosser, zelfde idee als `los_op` in sudoku.py. */
function solveGrid(grid, randomize = false) {
  const empty = findEmpty(grid);
  if (!empty) return true;
  const [row, col] = empty;
  const digits = randomize ? shuffledDigits() : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const value of digits) {
    if (isValidPlacement(grid, row, col, value)) {
      grid[row][col] = value;
      if (solveGrid(grid, randomize)) return true;
      grid[row][col] = 0;
    }
  }
  return false;
}

function countSolutions(grid, limit = 2) {
  let count = 0;
  function search() {
    if (count >= limit) return;
    const empty = findEmpty(grid);
    if (!empty) {
      count += 1;
      return;
    }
    const [row, col] = empty;
    for (let n = 1; n <= 9; n++) {
      if (isValidPlacement(grid, row, col, n)) {
        grid[row][col] = n;
        search();
        grid[row][col] = 0;
        if (count >= limit) return;
      }
    }
  }
  search();
  return count;
}

function isCompleteAndValid(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0 || cellHasConflict(grid, r, c)) return false;
    }
  }
  return true;
}

function generatePuzzle(difficulty) {
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveGrid(solution, true);
  const puzzle = clone(solution);
  const cells = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) cells.push([r, c]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const target = GIVENS[difficulty] ?? 40;
  let filled = 81;
  for (const [row, col] of cells) {
    if (filled <= target) break;
    const backup = puzzle[row][col];
    puzzle[row][col] = 0;
    if (countSolutions(clone(puzzle), 2) !== 1) puzzle[row][col] = backup;
    else filled -= 1;
  }
  return { puzzle, solution };
}

function sameUnit(ar, ac, br, bc) {
  return ar === br || ac === bc || (Math.floor(ar / 3) === Math.floor(br / 3) && Math.floor(ac / 3) === Math.floor(bc / 3));
}

function remainingCounts(grid) {
  const counts = [0, 9, 9, 9, 9, 9, 9, 9, 9, 9];
  for (const row of grid) for (const n of row) if (n) counts[n] -= 1;
  return counts;
}

function snapshot() {
  return { values: clone(state.values), notes: state.notes.map((r) => r.slice()) };
}

function pushHistory() {
  state.history.push(snapshot());
  if (state.history.length > 40) state.history.shift();
}

function loadPuzzle(puzzle, solution, difficulty) {
  state.values = clone(puzzle);
  state.givens = givensFrom(puzzle);
  state.notes = emptyNotes();
  state.solution = clone(solution);
  state.selected = null;
  state.notesMode = false;
  state.difficulty = difficulty;
  state.status = "playing";
  state.startedAt = Date.now();
  state.frozenMs = null;
  state.history = [];
}

/**
 * Nieuwe puzzel. Probeert eerst de Python-API (`start.py`),
 * valt terug op JavaScript als je alleen index.html opent.
 */
async function newGame(difficulty = state.difficulty) {
  setMessage("Nieuwe puzzel maken…");
  // Even wachten zodat de tekst zichtbaar is voordat het rekenen begint.
  await new Promise((resolve) => setTimeout(resolve, 20));
  try {
    if (!IS_LOCAL) throw new Error("geen Python-server online");
    const res = await fetch("api/nieuw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ niveau: difficulty }),
    });
    if (res.ok) {
      const data = await res.json();
      loadPuzzle(data.puzzel, data.oplossing, data.niveau);
      render();
      setMessage("");
      return;
    }
  } catch {
    /* file:// of geen server: lokaal genereren */
  }
  const generated = generatePuzzle(difficulty);
  loadPuzzle(generated.puzzle, generated.solution, difficulty);
  render();
  setMessage("");
}

function placeDigit(digit) {
  if (!state.selected || state.status !== "playing") return;
  const { row, col } = state.selected;
  if (state.givens[row][col]) return;

  pushHistory();
  if (state.notesMode) {
    if (state.values[row][col] !== 0) return;
    state.notes[row][col] ^= 1 << (digit - 1);
    render();
    return;
  }

  state.values[row][col] = state.values[row][col] === digit ? 0 : digit;
  state.notes[row][col] = 0;
  if (state.values[row][col]) {
    const bit = 1 << (digit - 1);
    for (let i = 0; i < 9; i++) {
      state.notes[row][i] &= ~bit;
      state.notes[i][col] &= ~bit;
    }
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) state.notes[br + r][bc + c] &= ~bit;
  }
  if (isCompleteAndValid(state.values)) {
    state.status = "won";
    state.frozenMs = Date.now() - state.startedAt;
  }
  render();
}

function erase() {
  if (!state.selected || state.status !== "playing") return;
  const { row, col } = state.selected;
  if (state.givens[row][col]) return;
  pushHistory();
  state.values[row][col] = 0;
  state.notes[row][col] = 0;
  render();
}

function undo() {
  const prev = state.history.pop();
  if (!prev) return;
  state.values = prev.values;
  state.notes = prev.notes;
  state.status = "playing";
  state.frozenMs = null;
  render();
}

function hint() {
  if (state.status !== "playing") return;
  const empties = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!state.values[r][c] && !state.givens[r][c]) empties.push([r, c]);
    }
  }
  if (!empties.length) return;
  let target = empties[Math.floor(Math.random() * empties.length)];
  if (state.selected && !state.values[state.selected.row][state.selected.col]) {
    target = [state.selected.row, state.selected.col];
  }
  const [row, col] = target;
  pushHistory();
  state.values[row][col] = state.solution[row][col];
  state.selected = { row, col };
  if (isCompleteAndValid(state.values)) {
    state.status = "won";
    state.frozenMs = Date.now() - state.startedAt;
  }
  render();
}

function reveal() {
  state.values = clone(state.solution);
  state.notes = emptyNotes();
  state.status = "revealed";
  state.frozenMs = Date.now() - state.startedAt;
  render();
}

function checkBoard() {
  if (isCompleteAndValid(state.values)) {
    state.status = "won";
    state.frozenMs = Date.now() - state.startedAt;
    setMessage("Alles klopt. Puzzel opgelost.");
    render();
    return;
  }
  let conflict = false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (cellHasConflict(state.values, r, c)) conflict = true;
  }
  setMessage(conflict ? "Er staan nog botsende cijfers." : "Nog niet vol, maar geen botsingen.");
}

/** Bewaar het spel in de browser, zodat je later verder kunt. */
function saveGame() {
  try {
    const elapsed = state.frozenMs ?? Date.now() - state.startedAt;
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        values: state.values,
        givens: state.givens,
        notes: state.notes,
        solution: state.solution,
        difficulty: state.difficulty,
        status: state.status,
        elapsed,
      })
    );
  } catch {
    /* privévenster of opslag vol: dan maar niet bewaren */
  }
}

/** Laad een bewaard spel. Geeft true terug als dat lukte. */
function loadSavedGame() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!data || !Array.isArray(data.values) || data.values.length !== 9) return false;
    state.values = data.values;
    state.givens = data.givens;
    state.notes = data.notes;
    state.solution = data.solution;
    state.difficulty = data.difficulty in GIVENS ? data.difficulty : "easy";
    state.status = data.status || "playing";
    state.startedAt = Date.now() - (data.elapsed || 0);
    state.frozenMs = state.status === "playing" ? null : data.elapsed || 0;
    state.selected = null;
    state.notesMode = false;
    state.history = [];
    return true;
  } catch {
    return false;
  }
}

/** Heeft de speler al iets ingevuld in een lopend spel? */
function hasProgress() {
  if (state.status !== "playing") return false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!state.givens[r][c] && (state.values[r][c] || state.notes[r][c])) return true;
    }
  }
  return false;
}

/** Vraag bevestiging voordat lopend werk verloren gaat. */
function confirmLoseProgress(text) {
  return !hasProgress() || window.confirm(text);
}

function setMessage(text) {
  document.getElementById("message").textContent = text;
}

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function render() {
  const board = document.getElementById("board");
  board.innerHTML = "";
  const selected = state.selected;
  const selectedValue = selected ? state.values[selected.row][selected.col] : 0;

  // Plat 9x9-raster (rij voor rij), CSS tekent de 3x3-lijnen
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = state.values[row][col];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sudoku-cell";
      btn.setAttribute("aria-label", `Rij ${row + 1}, kolom ${col + 1}${value ? `, ${value}` : ", leeg"}`);
      if (selected?.row === row && selected?.col === col) btn.classList.add("is-selected");
      else if (selected && sameUnit(selected.row, selected.col, row, col)) btn.classList.add("is-unit");
      if (selectedValue && value === selectedValue && !(selected?.row === row && selected?.col === col)) {
        btn.classList.add("is-same");
      }
      if (state.givens[row][col]) btn.classList.add("is-given");
      if (cellHasConflict(state.values, row, col)) btn.classList.add("is-conflict");
      if (value) {
        const span = document.createElement("span");
        span.className = "sudoku-digit";
        span.textContent = String(value);
        btn.appendChild(span);
      } else if (state.notes[row][col]) {
        const notes = document.createElement("span");
        notes.className = "sudoku-notes";
        for (let d = 1; d <= 9; d++) {
          const n = document.createElement("span");
          if (state.notes[row][col] & (1 << (d - 1))) n.textContent = String(d);
          notes.appendChild(n);
        }
        btn.appendChild(notes);
      }
      btn.addEventListener("click", () => {
        if (state.selected?.row === row && state.selected?.col === col) state.selected = null;
        else state.selected = { row, col };
        render();
      });
      board.appendChild(btn);
    }
  }

  const counts = remainingCounts(state.values);
  const pad = document.getElementById("pad");
  pad.innerHTML = "";
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `${d}<small>${Math.max(counts[d], 0)}</small>`;
    b.disabled = counts[d] <= 0 && !state.notesMode;
    b.addEventListener("click", () => placeDigit(d));
    pad.appendChild(b);
  }

  document.getElementById("btnNotes").classList.toggle("is-on", state.notesMode);
  document.getElementById("btnUndo").disabled = state.history.length === 0;
  const labels = { easy: "Makkelijk", medium: "Gemiddeld", hard: "Moeilijk" };
  document.getElementById("levelLabel").textContent = labels[state.difficulty];
  document.querySelectorAll("#levels button").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.level === state.difficulty);
  });
  const status = { playing: "Bezig", won: "Opgelost", revealed: "Getoond" };
  document.getElementById("statusLabel").textContent = status[state.status];
  const elapsed = state.frozenMs ?? Date.now() - state.startedAt;
  document.getElementById("timer").textContent = formatElapsed(elapsed);

  const win = document.getElementById("win");
  if (state.status === "won") {
    win.classList.remove("hidden");
    win.innerHTML = `<p class="kicker">Klaar</p><h2>Puzzel opgelost</h2><p class="hint">Tijd ${formatElapsed(state.frozenMs || 0)}</p>`;
  } else {
    win.classList.add("hidden");
    win.innerHTML = "";
  }
  saveGame();
}

document.getElementById("btnErase").addEventListener("click", erase);
document.getElementById("btnNotes").addEventListener("click", () => {
  state.notesMode = !state.notesMode;
  render();
});
document.getElementById("btnNew").addEventListener("click", () => {
  if (confirmLoseProgress("Nieuwe puzzel beginnen? Je huidige spel gaat verloren.")) newGame();
});
document.getElementById("btnUndo").addEventListener("click", undo);
document.getElementById("btnCheck").addEventListener("click", checkBoard);
document.getElementById("btnHint").addEventListener("click", hint);
document.getElementById("btnSolve").addEventListener("click", () => {
  if (state.status === "playing" && window.confirm("Weet je het zeker? Dan zie je de hele oplossing.")) reveal();
});
document.querySelectorAll("#levels button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (confirmLoseProgress("Ander niveau kiezen? Je huidige spel gaat verloren.")) newGame(btn.dataset.level);
  });
});

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey) {
    if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    }
    return;
  }
  if (event.key >= "1" && event.key <= "9") {
    if (!state.selected) state.selected = { row: 0, col: 0 };
    placeDigit(Number(event.key));
    return;
  }
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") erase();
  if (event.key === "ArrowUp") {
    event.preventDefault();
    const s = state.selected || { row: 0, col: 0 };
    state.selected = { row: (s.row + 8) % 9, col: s.col };
    render();
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    const s = state.selected || { row: 0, col: 0 };
    state.selected = { row: (s.row + 1) % 9, col: s.col };
    render();
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    const s = state.selected || { row: 0, col: 0 };
    state.selected = { row: s.row, col: (s.col + 8) % 9 };
    render();
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    const s = state.selected || { row: 0, col: 0 };
    state.selected = { row: s.row, col: (s.col + 1) % 9 };
    render();
  }
  if (event.key.toLowerCase() === "n") {
    state.notesMode = !state.notesMode;
    render();
  }
});

setInterval(() => {
  if (state.status === "playing") {
    document.getElementById("timer").textContent = formatElapsed(Date.now() - state.startedAt);
  }
}, 1000);

// Telefoon op slot of andere app geopend: tijd en stand bewaren.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGame();
});

if (loadSavedGame()) {
  render();
} else {
  render();
  newGame("easy");
}

// Offline spelen + "Zet op beginscherm" mogelijk maken.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
