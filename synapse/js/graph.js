/**
 * Neural-graph renderer: taken als knopen, afhankelijkheden als synapsen.
 * Gebruikt de 2D canvas-API.
 */

const STATUS_COLOR = {
  todo: "#6ea8ff",
  doing: "#fbbf24",
  done: "#34d399",
};

class NeuralGraph {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} handlers
   */
  constructor(canvas, handlers = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.handlers = handlers;
    this.tasks = [];
    this.links = [];
    this.selectedId = null;
    this.hoverId = null;
    this.drag = null;
    this.linkDrag = null;
    this.offset = { x: 0, y: 0 };
    this.scale = 1;
    this.pulse = 0;
    this._raf = 0;

    // Touch: alle actieve vingers/pointers (id -> {x, y} in schermcoördinaten).
    this.pointers = new Map();
    this.pinch = null; // twee-vinger-zoom
    this.press = null; // info over de huidige druk: start, lang-indrukken-timer, of er bewogen is
    this.lastTap = null; // voor dubbeltik op touch
    this.ignoreUntilAllUp = false; // na een pinch de laatste vinger negeren

    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
    canvas.addEventListener("pointercancel", (e) => this.onPointerUp(e, true));
    canvas.addEventListener("dblclick", (e) => this.onDblClick(e));
    canvas.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.loop();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  }

  setData(tasks, links, selectedId = null) {
    this.tasks = tasks;
    this.links = links;
    this.selectedId = selectedId;
  }

  loop() {
    this.pulse += 0.03;
    this.draw();
    this._raf = requestAnimationFrame(() => this.loop());
  }

  worldFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.offset.x) / this.scale;
    const y = (event.clientY - rect.top - this.offset.y) / this.scale;
    return { x, y };
  }

  hitTest(x, y) {
    // Een vinger is minder precies dan een muis: ruimer raakvlak bij touch.
    const r = this.lastPointerType && this.lastPointerType !== "mouse" ? 38 : 28;
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      const t = this.tasks[i];
      const dx = x - t.x;
      const dy = y - t.y;
      if (dx * dx + dy * dy <= r * r) return t;
    }
    return null;
  }

  /* ---------- Invoer: muis, pen en touch (pointer-events) ---------- */

  /** Zo ver (px) mag je bewegen voordat een tik/druk als slepen telt. */
  static MOVE_THRESHOLD = 6;
  /** Zo lang (ms) ingedrukt houden op een knoop = gaan verbinden (touch/pen). */
  static LONG_PRESS_MS = 450;

  onPointerDown(event) {
    this.lastPointerType = event.pointerType;
    if (event.button > 0) return; // alleen linkermuisknop / vinger / pen
    this.canvas.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // Tweede vinger: stop wat er bezig was en begin met knijp-zoomen.
    if (this.pointers.size === 2) {
      this.cancelPress();
      this.startPinch();
      return;
    }
    if (this.pointers.size > 2 || this.ignoreUntilAllUp) return;

    const world = this.worldFromEvent(event);
    const hit = this.hitTest(world.x, world.y);
    const touchLike = event.pointerType !== "mouse";
    this.press = { sx: event.clientX, sy: event.clientY, moved: false, touchLike, timer: 0, hitId: hit?.id || null };

    if (hit) {
      if (event.shiftKey) {
        this.linkDrag = { from: hit.id, x: world.x, y: world.y };
      } else {
        this.drag = {
          id: hit.id,
          dx: world.x - hit.x,
          dy: world.y - hit.y,
          moved: false,
        };
        this.selectedId = hit.id;
        this.handlers.onSelect?.(hit.id);
        // Touch heeft geen Shift: lang indrukken zonder te bewegen start het verbinden.
        if (touchLike) {
          this.press.timer = setTimeout(() => this.startLinkFromPress(hit), NeuralGraph.LONG_PRESS_MS);
        }
      }
    } else {
      this.drag = {
        pan: true,
        sx: event.clientX,
        sy: event.clientY,
        ox: this.offset.x,
        oy: this.offset.y,
      };
    }
    this.canvas.classList.add("is-dragging");
  }

  startLinkFromPress(task) {
    if (!this.press || this.press.moved || !this.drag || this.drag.id !== task.id) return;
    this.drag = null;
    this.linkDrag = { from: task.id, x: task.x, y: task.y };
    navigator.vibrate?.(15); // korte trilling als bevestiging (waar ondersteund)
  }

  onPointerMove(event) {
    if (this.pointers.has(event.pointerId)) {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (this.pinch) {
      this.updatePinch();
      return;
    }

    const world = this.worldFromEvent(event);
    if (event.pointerType === "mouse") {
      const hit = this.hitTest(world.x, world.y);
      this.hoverId = hit?.id || null;
      this.canvas.style.cursor = hit ? "pointer" : "grab";
    }
    if (this.ignoreUntilAllUp || !this.press) return;

    // Pas na een paar pixels telt het als bewegen (anders is het een tik).
    if (!this.press.moved) {
      const dist = Math.hypot(event.clientX - this.press.sx, event.clientY - this.press.sy);
      if (dist < NeuralGraph.MOVE_THRESHOLD) return;
      this.press.moved = true;
      clearTimeout(this.press.timer);
    }

    if (this.linkDrag) {
      this.linkDrag.x = world.x;
      this.linkDrag.y = world.y;
      return;
    }

    if (!this.drag) return;
    if (this.drag.pan) {
      this.offset.x = this.drag.ox + (event.clientX - this.drag.sx);
      this.offset.y = this.drag.oy + (event.clientY - this.drag.sy);
      return;
    }

    const task = this.tasks.find((t) => t.id === this.drag.id);
    if (!task) return;
    task.x = world.x - this.drag.dx;
    task.y = world.y - this.drag.dy;
    this.drag.moved = true;
    // Tijdens het slepen alleen tekenen; opslaan gebeurt pas bij loslaten (onMoveEnd).
    this.handlers.onMove?.(task);
  }

  onPointerUp(event, cancelled = false) {
    this.pointers.delete(event.pointerId);

    if (this.pinch) {
      // Eén vinger los na het knijpen: de andere niet ineens laten pannen.
      if (this.pointers.size < 2) {
        this.pinch = null;
        this.ignoreUntilAllUp = this.pointers.size > 0;
      }
      return;
    }
    if (this.ignoreUntilAllUp) {
      if (this.pointers.size === 0) this.ignoreUntilAllUp = false;
      return;
    }

    const press = this.press;
    if (press) clearTimeout(press.timer);

    if (this.linkDrag && !cancelled) {
      const world = this.worldFromEvent(event);
      const hit = this.hitTest(world.x, world.y);
      if (hit && hit.id !== this.linkDrag.from) {
        this.handlers.onLink?.(this.linkDrag.from, hit.id);
      }
    }
    if (this.drag && !this.drag.pan && this.drag.moved) {
      const task = this.tasks.find((t) => t.id === this.drag.id);
      if (task) this.handlers.onMoveEnd?.(task);
    }

    // Een tik (zonder bewegen) op lege ruimte.
    if (press && !press.moved && !press.hitId && !cancelled && !this.linkDrag) {
      if (press.touchLike) {
        this.handleTap(event);
      } else {
        this.handlers.onSelect?.(null); // klik naast een knoop = selectie opheffen
      }
    }

    this.linkDrag = null;
    this.drag = null;
    this.press = null;
    this.canvas.classList.remove("is-dragging");
  }

  /** Touch: één tik op lege ruimte heft de selectie op, dubbeltik maakt een nieuwe taak. */
  handleTap(event) {
    const now = performance.now();
    const last = this.lastTap;
    const isDouble =
      last && now - last.t < 320 && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 30;
    if (isDouble) {
      this.lastTap = null;
      const world = this.worldFromEvent(event);
      this.handlers.onCreate?.(world.x, world.y);
    } else {
      this.lastTap = { t: now, x: event.clientX, y: event.clientY };
      this.handlers.onSelect?.(null);
    }
  }

  cancelPress() {
    if (this.press) clearTimeout(this.press.timer);
    // Een half versleepte knoop wel bewaren.
    if (this.drag && !this.drag.pan && this.drag.moved) {
      const task = this.tasks.find((t) => t.id === this.drag.id);
      if (task) this.handlers.onMoveEnd?.(task);
    }
    this.press = null;
    this.drag = null;
    this.linkDrag = null;
  }

  startPinch() {
    const [a, b] = [...this.pointers.values()];
    const rect = this.canvas.getBoundingClientRect();
    const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
    this.pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      scale: this.scale,
      // Het wereldpunt onder het midden van de vingers blijft onder het midden.
      world: { x: (mid.x - this.offset.x) / this.scale, y: (mid.y - this.offset.y) / this.scale },
    };
  }

  updatePinch() {
    if (this.pointers.size < 2) return;
    const [a, b] = [...this.pointers.values()];
    const rect = this.canvas.getBoundingClientRect();
    const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    this.scale = this.clampScale(this.pinch.scale * (dist / this.pinch.dist));
    this.offset.x = mid.x - this.pinch.world.x * this.scale;
    this.offset.y = mid.y - this.pinch.world.y * this.scale;
  }

  onDblClick(event) {
    // Op touch/pen regelt handleTap de dubbeltik; hier alleen de muis.
    if (this.lastPointerType !== "mouse") return;
    const world = this.worldFromEvent(event);
    const hit = this.hitTest(world.x, world.y);
    if (hit) {
      this.handlers.onSelect?.(hit.id);
      return;
    }
    this.handlers.onCreate?.(world.x, world.y);
  }

  clampScale(scale) {
    return Math.min(2.2, Math.max(0.45, scale));
  }

  /** Zoom rond het punt (mx, my) op het canvas, zodat dat punt op zijn plek blijft. */
  zoomAt(mx, my, factor) {
    const before = {
      x: (mx - this.offset.x) / this.scale,
      y: (my - this.offset.y) / this.scale,
    };
    this.scale = this.clampScale(this.scale * factor);
    this.offset.x = mx - before.x * this.scale;
    this.offset.y = my - before.y * this.scale;
  }

  onWheel(event) {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY > 0 ? 0.92 : 1.08);
  }

  autoLayout() {
    const n = this.tasks.length;
    if (!n) return;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = Math.min(this.width, this.height) * 0.28;
    this.tasks.forEach((task, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      task.x = (cx - this.offset.x) / this.scale + Math.cos(a) * radius;
      task.y = (cy - this.offset.y) / this.scale + Math.sin(a) * radius;
    });
    this.handlers.onLayout?.(this.tasks);
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(this.offset.x, this.offset.y);
    ctx.scale(this.scale, this.scale);

    // Achtergrond-punten (neuron field)
    ctx.fillStyle = "rgba(110,168,255,0.08)";
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % 900;
      const y = (i * 53) % 700;
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Links / synapsen
    for (const link of this.links) {
      const a = this.tasks.find((t) => t.id === link.from);
      const b = this.tasks.find((t) => t.id === link.to);
      if (!a || !b) continue;
      // Pijlpunt net buiten de rand van de doel-knoop (geselecteerde knoop is groter).
      const edge = b.id === this.selectedId ? 34 : 30;
      this.drawSynapse(a.x, a.y, b.x, b.y, false, edge);
    }

    if (this.linkDrag) {
      const from = this.tasks.find((t) => t.id === this.linkDrag.from);
      if (from) this.drawSynapse(from.x, from.y, this.linkDrag.x, this.linkDrag.y, true, 0);
    }

    // Knopen
    for (const task of this.tasks) {
      this.drawNode(task);
    }

    ctx.restore();
  }

  /**
   * Teken een gebogen verbinding van (x1,y1) naar (x2,y2) met een pijlpunt bij het doel.
   * @param {number} endOffset afstand van de pijlpunt tot het eindpunt (straal van de knoop)
   */
  drawSynapse(x1, y1, x2, y2, temp = false, endOffset = 0) {
    const ctx = this.ctx;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - 30;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, "rgba(110,168,255,0.15)");
    grad.addColorStop(0.5, "rgba(155,123,255,0.75)");
    grad.addColorStop(1, "rgba(94,234,212,0.55)");

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.strokeStyle = grad;
    ctx.lineWidth = temp ? 1.5 : 2.2;
    ctx.stroke();

    // Pijlpunt: de richting aan het eind van een quadratic curve is (eindpunt - controlepunt).
    const dx = x2 - mx;
    const dy = y2 - my;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tipX = x2 - ux * endOffset;
    const tipY = y2 - uy * endOffset;
    const size = 9;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - ux * size - uy * size * 0.6, tipY - uy * size + ux * size * 0.6);
    ctx.lineTo(tipX - ux * size + uy * size * 0.6, tipY - uy * size - ux * size * 0.6);
    ctx.closePath();
    ctx.fillStyle = temp ? "rgba(94,234,212,0.5)" : "rgba(94,234,212,0.9)";
    ctx.fill();

    // Pulserende “signaal”-stip
    if (!temp) {
      const t = (Math.sin(this.pulse + x1 * 0.01) + 1) / 2;
      const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
      const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(232,238,252,0.9)";
      ctx.shadowColor = "#9b7bff";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  drawNode(task) {
    const ctx = this.ctx;
    const color = STATUS_COLOR[task.status] || STATUS_COLOR.todo;
    const selected = task.id === this.selectedId;
    const hover = task.id === this.hoverId;
    const r = selected ? 30 : 26;

    // Outer glow
    ctx.beginPath();
    ctx.arc(task.x, task.y, r + 10 + Math.sin(this.pulse) * 2, 0, Math.PI * 2);
    ctx.fillStyle = color + "22";
    ctx.fill();

    // Ring
    ctx.beginPath();
    ctx.arc(task.x, task.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#0b1020";
    ctx.fill();
    ctx.lineWidth = selected || hover ? 3 : 2;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = selected ? 18 : 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Core
    ctx.beginPath();
    ctx.arc(task.x, task.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    const label = task.title.length > 22 ? task.title.slice(0, 21) + "…" : task.title;
    ctx.font = "500 12px IBM Plex Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(232,238,252,0.92)";
    ctx.fillText(label, task.x, task.y + r + 8);
  }
}

window.NeuralGraph = NeuralGraph;
