/**
 * UI-controller: projecten, formulieren, koppeling met de neural graph.
 */

const { uid, loadState, saveState, exportJson, importJson } = window.SynapseStore;

const state = loadState();
const els = {
  projectList: document.getElementById("projectList"),
  projectForm: document.getElementById("projectForm"),
  formTitle: document.getElementById("formTitle"),
  projectFormPanel: document.getElementById("projectFormPanel"),
  canvasHint: document.getElementById("canvasHint"),
  btnNewProject: document.getElementById("btnNewProject"),
  btnCancelForm: document.getElementById("btnCancelForm"),
  btnDeleteProject: document.getElementById("btnDeleteProject"),
  activeProjectLabel: document.getElementById("activeProjectLabel"),
  activeProjectName: document.getElementById("activeProjectName"),
  stageMeta: document.getElementById("stageMeta"),
  stage: document.querySelector(".stage"),
  viewButtons: document.querySelectorAll(".view-toggle [data-view]"),
  canvasWrap: document.getElementById("canvasWrap"),
  listView: document.getElementById("listView"),
  listGroups: document.getElementById("listGroups"),
  listPriority: document.getElementById("listPriority"),
  btnExport: document.getElementById("btnExport"),
  btnImport: document.getElementById("btnImport"),
  importFile: document.getElementById("importFile"),
  backupStatus: document.getElementById("backupStatus"),
  linkList: document.getElementById("linkList"),
  btnAddTask: document.getElementById("btnAddTask"),
  btnAutoLayout: document.getElementById("btnAutoLayout"),
  btnClearLinks: document.getElementById("btnClearLinks"),
  taskForm: document.getElementById("taskForm"),
  btnDeleteTask: document.getElementById("btnDeleteTask"),
  btnCloseInspector: document.getElementById("btnCloseInspector"),
  inspector: document.getElementById("inspector"),
  progressFill: document.getElementById("progressFill"),
  progressLabel: document.getElementById("progressLabel"),
};

let editingProjectId = null;
let selectedTaskId = null;
let taskSaveTimer = null;
let taskSaveFor = null; // id van de taak waarvoor een autosave klaarstaat

const graph = new window.NeuralGraph(document.getElementById("net"), {
  onSelect: (id) => selectTask(id),
  onMoveEnd: () => saveState(state),
  onCreate: (x, y) => addTaskAt(x, y),
  onLink: (from, to) => addLink(from, to),
  onLayout: () => persist(),
});

/** Zelfde breekpunt als in styles.css (één kolom + bottom-sheet). */
function isNarrow() {
  return window.matchMedia("(max-width: 1100px)").matches;
}

function persist() {
  saveState(state);
  refreshGraph();
  renderProgress();
}

function activeProject() {
  return state.projects.find((p) => p.id === state.activeProjectId) || null;
}

function statusLabel(status) {
  return (
    {
      idea: "Idee",
      active: "Actief",
      paused: "Gepauzeerd",
      done: "Afgerond",
      todo: "Te doen",
      doing: "Bezig",
    }[status] || status
  );
}

/**
 * Zet een deadline ("JJJJ-MM-DD") om naar tekst en een toestand.
 * @returns {{text: string, short: string, state: "overdue"|"soon"|"ok"} | null}
 */
function deadlineInfo(deadline, projectStatus) {
  if (!deadline) return null;
  const [y, m, d] = deadline.split("-").map(Number);
  if (!y || !m || !d) return null;
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  const short = due.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

  let text;
  if (days < 0) text = `${-days} ${-days === 1 ? "dag" : "dagen"} over de deadline`;
  else if (days === 0) text = "deadline vandaag";
  else if (days === 1) text = "nog 1 dag";
  else text = `nog ${days} dagen`;

  // Een afgerond project is nooit "te laat".
  let state = "ok";
  if (projectStatus !== "done") {
    if (days < 0) state = "overdue";
    else if (days <= 3) state = "soon";
  }
  return { text, short, state };
}

/** Alleen http(s)-links tonen (voorkomt bijv. javascript:-links). */
function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function renderProjects() {
  els.projectList.innerHTML = "";
  if (!state.projects.length) {
    els.projectList.innerHTML = `<li style="color:var(--muted);font-size:0.85rem">Nog geen projecten.</li>`;
    return;
  }
  for (const project of state.projects) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "project-item" + (project.id === state.activeProjectId ? " is-active" : "");
    const done = project.tasks.filter((t) => t.status === "done").length;
    const dl = deadlineInfo(project.deadline, project.status);
    const dlHtml = dl ? ` · <em class="deadline-tag is-${dl.state}" title="${dl.text}">${dl.short}</em>` : "";
    btn.innerHTML = `<strong>${escapeHtml(project.name)}</strong><span>${statusLabel(project.status)} · ${done}/${project.tasks.length} klaar${dlHtml}</span>`;
    btn.addEventListener("click", () => {
      // Tik op het project dat al actief is = bewerken (dubbelklik bestaat niet echt op touch).
      if (project.id === state.activeProjectId) {
        fillProjectForm(project, true);
        return;
      }
      state.activeProjectId = project.id;
      selectedTaskId = null;
      persist();
      renderAll();
    });
    btn.addEventListener("dblclick", () => fillProjectForm(project, true));
    li.appendChild(btn);
    els.projectList.appendChild(li);
  }
}

/**
 * Vul het projectformulier. `open` klapt het uit op kleine schermen
 * (op desktop staat het formulier altijd open).
 */
function fillProjectForm(project = null, open = false) {
  els.projectFormPanel.classList.toggle("is-open", open);
  if (open && isNarrow()) {
    els.projectFormPanel.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  editingProjectId = project?.id || null;
  els.formTitle.textContent = project ? "Project bewerken" : "Nieuw project";
  const form = els.projectForm;
  form.name.value = project?.name || "";
  form.repo.value = project?.repo || "";
  form.status.value = project?.status || "active";
  form.deadline.value = project?.deadline || "";
  form.description.value = project?.description || "";
  els.btnDeleteProject.hidden = !project;
}

function deleteProject(id) {
  const project = state.projects.find((p) => p.id === id);
  if (!project) return;
  const n = project.tasks.length;
  const ok = confirm(`Project "${project.name}" verwijderen, met ${n} ${n === 1 ? "taak" : "taken"}? Dit kan niet ongedaan worden.`);
  if (!ok) return;
  state.projects = state.projects.filter((p) => p.id !== id);
  if (state.activeProjectId === id) {
    state.activeProjectId = state.projects[0]?.id || null;
    selectedTaskId = null;
  }
  fillProjectForm(null);
  persist();
  renderAll();
}

function renderStageHeader() {
  const project = activeProject();
  const has = Boolean(project);
  els.btnAddTask.disabled = !has;
  els.btnAutoLayout.disabled = !has;
  els.btnClearLinks.disabled = !has;
  if (!project) {
    els.activeProjectLabel.textContent = "Geen project geselecteerd";
    els.activeProjectName.textContent = "Kies of maak een project";
    els.stageMeta.hidden = true;
    return;
  }
  els.activeProjectLabel.textContent = statusLabel(project.status);
  els.activeProjectName.textContent = project.name;

  // Deadline + repo-link (met DOM-elementen, zodat gebruikersinvoer nooit als HTML telt).
  els.stageMeta.replaceChildren();
  const dl = deadlineInfo(project.deadline, project.status);
  if (dl) {
    const span = document.createElement("span");
    span.className = `deadline-tag is-${dl.state}`;
    span.textContent = `${dl.short} · ${dl.text}`;
    els.stageMeta.appendChild(span);
  }
  const url = safeUrl(project.repo || "");
  if (url) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    els.stageMeta.appendChild(a);
  }
  els.stageMeta.hidden = !els.stageMeta.childElementCount;
}

/** Ververs de takenweergave: het netwerk én de lijst (de verborgen kost bijna niets). */
function refreshGraph() {
  const project = activeProject();
  if (!project) {
    graph.setData([], [], null);
  } else {
    graph.setData(project.tasks, project.links, selectedTaskId);
  }
  renderList();
}

/* ---------- Weergave: netwerk of lijst ---------- */

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL = { high: "Hoog", medium: "Normaal", low: "Laag" };
const STATUS_GROUPS = [
  { status: "todo", label: "Te doen" },
  { status: "doing", label: "Bezig" },
  { status: "done", label: "Klaar" },
];

function setView(view) {
  state.view = view === "list" ? "list" : "graph";
  const isList = state.view === "list";
  els.listView.hidden = !isList;
  els.canvasWrap.hidden = isList;
  els.stage.classList.toggle("is-list", isList);
  for (const btn of els.viewButtons) {
    const on = btn.dataset.view === state.view;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", String(on));
  }
  // Een verborgen canvas heeft maat 0; bij terugkomen opnieuw opmeten.
  if (!isList) graph.resize();
  renderList();
}

function renderList() {
  if (state.view !== "list") return;
  const project = activeProject();
  els.listGroups.replaceChildren();
  if (!project) {
    els.listGroups.innerHTML = `<p class="list-empty">Kies of maak een project.</p>`;
    return;
  }

  const filter = state.listPriority || "all";
  const byId = new Map(project.tasks.map((t) => [t.id, t]));
  const tasks = project.tasks
    .filter((t) => filter === "all" || t.priority === filter)
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1) ||
        a.title.localeCompare(b.title, "nl"),
    );

  for (const group of STATUS_GROUPS) {
    const items = tasks.filter((t) => t.status === group.status);
    const section = document.createElement("section");
    section.className = "list-group";

    const head = document.createElement("h3");
    head.innerHTML = `<i class="dot ${group.status}"></i> ${group.label} <span>${items.length}</span>`;
    section.appendChild(head);

    const ul = document.createElement("ul");
    if (!items.length) {
      ul.innerHTML = `<li class="list-empty">Geen taken.</li>`;
    }
    for (const task of items) {
      ul.appendChild(renderListRow(task, project, byId));
    }
    section.appendChild(ul);
    els.listGroups.appendChild(section);
  }
}

function renderListRow(task, project, byId) {
  const li = document.createElement("li");
  li.className = "list-row" + (task.id === selectedTaskId ? " is-selected" : "");

  const prio = document.createElement("span");
  prio.className = `prio-tag is-${task.priority}`;
  prio.textContent = PRIORITY_LABEL[task.priority] || task.priority;

  const title = document.createElement("button");
  title.type = "button";
  title.className = "list-title";
  title.textContent = task.title;
  title.addEventListener("click", () => selectTask(task.id));

  li.append(prio, title);

  // Taken waar deze taak op wacht en die nog niet klaar zijn.
  if (task.status !== "done") {
    const blockers = project.links
      .filter((l) => l.to === task.id && byId.get(l.from) && byId.get(l.from).status !== "done")
      .map((l) => byId.get(l.from).title);
    if (blockers.length) {
      const wait = document.createElement("span");
      wait.className = "wait-tag";
      wait.textContent = `wacht op ${blockers.length}`;
      wait.title = `Eerst: ${blockers.join(", ")}`;
      li.appendChild(wait);
    }
  }

  const status = document.createElement("select");
  status.className = "list-status";
  status.setAttribute("aria-label", `Status van ${task.title}`);
  for (const g of STATUS_GROUPS) {
    status.add(new Option(g.label, g.status, false, g.status === task.status));
  }
  status.addEventListener("change", () => {
    flushTaskSave();
    task.status = status.value;
    persist();
    renderProjects();
    // Staat deze taak open in de inspector, dan het formulier bijwerken.
    if (task.id === selectedTaskId) els.taskForm.status.value = task.status;
  });
  li.appendChild(status);

  return li;
}

function renderProgress() {
  const project = activeProject();
  if (!project || !project.tasks.length) {
    els.progressFill.style.width = "0%";
    els.progressLabel.textContent = "0 / 0 taken klaar";
    return;
  }
  const done = project.tasks.filter((t) => t.status === "done").length;
  const pct = Math.round((done / project.tasks.length) * 100);
  els.progressFill.style.width = `${pct}%`;
  els.progressLabel.textContent = `${done} / ${project.tasks.length} taken klaar (${pct}%)`;
}

function selectTask(id) {
  // Nog niet opgeslagen wijzigingen van de vorige taak eerst bewaren.
  flushTaskSave();
  selectedTaskId = id;
  const project = activeProject();
  const task = project?.tasks.find((t) => t.id === id);
  els.inspector.classList.toggle("is-empty", !task);
  if (!task) {
    els.taskForm.reset();
    renderLinks();
    refreshGraph();
    return;
  }
  els.taskForm.title.value = task.title;
  els.taskForm.status.value = task.status;
  els.taskForm.priority.value = task.priority;
  els.taskForm.notes.value = task.notes || "";
  renderLinks();
  refreshGraph();
}

/** Lees het taakformulier uit en sla de geselecteerde taak op. */
function saveTaskFromForm() {
  clearTimeout(taskSaveTimer);
  taskSaveTimer = null;
  // Opslaan voor de taak waarvoor het formulier gevuld is, ook als de selectie
  // intussen al is veranderd (het formulier bevat dan nog die oude taak).
  const id = taskSaveFor || selectedTaskId;
  taskSaveFor = null;
  const task = state.projects.flatMap((p) => p.tasks).find((t) => t.id === id);
  if (!task) return;
  task.title = els.taskForm.title.value.trim() || "Naamloze taak";
  task.status = els.taskForm.status.value;
  task.priority = els.taskForm.priority.value;
  task.notes = els.taskForm.notes.value;
  persist();
  // Geen renderAll(): die zet de formuliervelden opnieuw en verspringt dan de cursor.
  renderProjects();
  renderLinks();
}

function scheduleTaskSave() {
  if (!taskSaveTimer) taskSaveFor = selectedTaskId;
  clearTimeout(taskSaveTimer);
  taskSaveTimer = setTimeout(saveTaskFromForm, 300);
}

function flushTaskSave() {
  if (taskSaveTimer) saveTaskFromForm();
}

/** Lijst met verbindingen van de geselecteerde taak, met een ×-knop per verbinding. */
function renderLinks() {
  const project = activeProject();
  const task = project?.tasks.find((t) => t.id === selectedTaskId);
  els.linkList.replaceChildren();
  if (!task) {
    els.linkList.innerHTML = `<li class="link-empty">Selecteer een taak.</li>`;
    return;
  }
  const byId = new Map(project.tasks.map((t) => [t.id, t]));
  const rows = [];
  for (const link of project.links) {
    if (link.to === task.id && byId.has(link.from)) rows.push({ link, dir: "Hangt af van", other: byId.get(link.from) });
    if (link.from === task.id && byId.has(link.to)) rows.push({ link, dir: "Nodig voor", other: byId.get(link.to) });
  }
  if (!rows.length) {
    els.linkList.innerHTML = `<li class="link-empty">Nog geen verbindingen. Shift + sleep van deze taak naar een andere.</li>`;
    return;
  }
  for (const { link, dir, other } of rows) {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.className = "link-dir";
    label.textContent = dir;

    const target = document.createElement("button");
    target.type = "button";
    target.className = "link-target";
    target.textContent = other.title;
    target.title = "Ga naar deze taak";
    target.addEventListener("click", () => selectTask(other.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn-icon small";
    remove.textContent = "×";
    remove.title = "Verbinding verwijderen";
    remove.addEventListener("click", () => removeLink(link));

    li.append(label, target, remove);
    els.linkList.appendChild(li);
  }
}

function removeLink(link) {
  const project = activeProject();
  if (!project) return;
  project.links = project.links.filter((l) => l !== link);
  persist();
  renderLinks();
}

function addTaskAt(x, y) {
  const project = activeProject();
  if (!project) return;
  const task = {
    id: uid("task"),
    title: "Nieuwe taak",
    status: "todo",
    priority: "medium",
    notes: "",
    x,
    y,
  };
  project.tasks.push(task);
  selectedTaskId = task.id;
  persist();
  renderAll();
  selectTask(task.id);
}

function addLink(from, to) {
  const project = activeProject();
  if (!project) return;
  const exists = project.links.some(
    (l) => (l.from === from && l.to === to) || (l.from === to && l.to === from),
  );
  if (exists) return;
  project.links.push({ from, to });
  persist();
  renderLinks();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderAll() {
  renderProjects();
  renderStageHeader();
  refreshGraph();
  renderProgress();
  selectTask(selectedTaskId);
}

els.btnNewProject.addEventListener("click", () => fillProjectForm(null, true));
els.btnCancelForm.addEventListener("click", () => fillProjectForm(null));
els.btnDeleteProject.addEventListener("click", () => {
  if (editingProjectId) deleteProject(editingProjectId);
});

els.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(els.projectForm);
  const payload = {
    name: String(data.get("name") || "").trim(),
    repo: String(data.get("repo") || "").trim(),
    status: String(data.get("status") || "active"),
    deadline: String(data.get("deadline") || ""),
    description: String(data.get("description") || "").trim(),
  };
  if (!payload.name) return;

  if (editingProjectId) {
    const project = state.projects.find((p) => p.id === editingProjectId);
    if (project) Object.assign(project, payload);
  } else {
    const project = {
      id: uid("proj"),
      ...payload,
      tasks: [],
      links: [],
    };
    state.projects.unshift(project);
    state.activeProjectId = project.id;
  }
  editingProjectId = null;
  fillProjectForm(null);
  persist();
  renderAll();
});

els.btnAddTask.addEventListener("click", () => {
  const project = activeProject();
  if (!project) return;
  addTaskAt(280 + Math.random() * 200, 180 + Math.random() * 160);
});

els.btnAutoLayout.addEventListener("click", () => {
  graph.autoLayout();
  persist();
});

els.btnClearLinks.addEventListener("click", () => {
  const project = activeProject();
  if (!project) return;
  if (project.links.length && !confirm(`Alle ${project.links.length} verbindingen in dit project wissen?`)) return;
  project.links = [];
  persist();
  renderLinks();
});

// Autosave: elke wijziging in het taakformulier wordt na 300 ms opgeslagen.
els.taskForm.addEventListener("input", scheduleTaskSave);
els.taskForm.addEventListener("change", scheduleTaskSave);
els.taskForm.addEventListener("submit", (event) => {
  event.preventDefault(); // Enter in het titelveld: meteen opslaan
  saveTaskFromForm();
});
// Pagina sluiten of wegklikken: niets kwijtraken.
window.addEventListener("pagehide", flushTaskSave);

els.btnDeleteTask.addEventListener("click", () => {
  const project = activeProject();
  if (!project || !selectedTaskId) return;
  clearTimeout(taskSaveTimer);
  taskSaveTimer = null;
  taskSaveFor = null;
  project.tasks = project.tasks.filter((t) => t.id !== selectedTaskId);
  project.links = project.links.filter((l) => l.from !== selectedTaskId && l.to !== selectedTaskId);
  selectedTaskId = null;
  persist();
  renderAll();
});

els.btnCloseInspector.addEventListener("click", () => {
  selectedTaskId = null;
  selectTask(null);
});

for (const btn of els.viewButtons) {
  btn.addEventListener("click", () => {
    setView(btn.dataset.view);
    saveState(state);
  });
}

els.listPriority.addEventListener("change", () => {
  state.listPriority = els.listPriority.value;
  saveState(state);
  renderList();
});

/* ---------- Back-up: export / import ---------- */

function setBackupStatus(text, isError = false) {
  els.backupStatus.textContent = text;
  els.backupStatus.classList.toggle("is-error", isError);
}

function countTasks(s) {
  return s.projects.reduce((n, p) => n + p.tasks.length, 0);
}

els.btnExport.addEventListener("click", () => {
  flushTaskSave();
  const blob = new Blob([exportJson(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `synapse-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setBackupStatus(`Back-up gemaakt: ${state.projects.length} projecten, ${countTasks(state)} taken.`);
});

els.btnImport.addEventListener("click", () => els.importFile.click());

els.importFile.addEventListener("change", async () => {
  const file = els.importFile.files[0];
  els.importFile.value = ""; // zodat hetzelfde bestand nog eens gekozen kan worden
  if (!file) return;
  try {
    const incoming = importJson(await file.text());
    const ok = confirm(
      `Je huidige data (${state.projects.length} projecten, ${countTasks(state)} taken) wordt vervangen door ` +
        `${incoming.projects.length} projecten en ${countTasks(incoming)} taken uit "${file.name}".\n\n` +
        "Tip: exporteer eerst als je je huidige data wilt bewaren. Doorgaan?",
    );
    if (!ok) return;
    flushTaskSave();
    // Weergave-voorkeuren van dit apparaat houden; de rest vervangen.
    incoming.view = state.view;
    incoming.listPriority = state.listPriority;
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, incoming);
    selectedTaskId = null;
    editingProjectId = null;
    fillProjectForm(null);
    persist();
    setView(state.view);
    renderAll();
    setBackupStatus(`Geïmporteerd: ${state.projects.length} projecten, ${countTasks(state)} taken.`);
  } catch (err) {
    setBackupStatus(err.message || "Importeren mislukt.", true);
  }
});

// Touchscherm: andere uitleg onder het canvas.
if (window.matchMedia("(pointer: coarse)").matches) {
  els.canvasHint.textContent =
    "Dubbeltik: nieuwe taak · vasthouden + slepen: verbinden · knijpen: zoomen";
}

// Offline + installeerbaar (PWA). Werkt niet via file://, alleen via een (lokale) server.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Start
fillProjectForm(null);
els.listPriority.value = state.listPriority || "all";
setView(state.view);
renderAll();
