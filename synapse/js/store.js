/**
 * Lokale data-laag voor Synapse.
 * Alles blijft in localStorage onder één sleutel.
 *
 * Alles staat in een eigen functie-scope (IIFE): gewone <script>-bestanden delen
 * één globale scope, en anders botst `uid` hier met `const { uid } = ...` in app.js.
 */
(() => {

const STORAGE_KEY = "synapse-v1";

/** @typedef {"idea"|"active"|"paused"|"done"} ProjectStatus */
/** @typedef {"todo"|"doing"|"done"} TaskStatus */
/** @typedef {"low"|"medium"|"high"} Priority */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} title
 * @property {TaskStatus} status
 * @property {Priority} priority
 * @property {string} notes
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} Link
 * @property {string} from
 * @property {string} to
 */

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} name
 * @property {string} repo
 * @property {ProjectStatus} status
 * @property {string} deadline
 * @property {string} description
 * @property {Task[]} tasks
 * @property {Link[]} links
 */

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function defaultData() {
  const projectId = uid("proj");
  const t1 = uid("task");
  const t2 = uid("task");
  const t3 = uid("task");
  return {
    activeProjectId: projectId,
    projects: [
      {
        id: projectId,
        name: "Voorbeeld: portfolio site",
        repo: "https://github.com/",
        status: "active",
        deadline: "",
        description: "Demo-project om het netwerk te laten zien. Pas gerust aan of verwijder.",
        tasks: [
          {
            id: t1,
            title: "Repo opzetten",
            status: "done",
            priority: "high",
            notes: "README + basisstructuur",
            x: 220,
            y: 180,
          },
          {
            id: t2,
            title: "Homepagina ontwerpen",
            status: "doing",
            priority: "medium",
            notes: "Layout en typografie",
            x: 420,
            y: 280,
          },
          {
            id: t3,
            title: "Deployen",
            status: "todo",
            priority: "medium",
            notes: "GitHub Pages of Vercel",
            x: 620,
            y: 200,
          },
        ],
        links: [
          { from: t1, to: t2 },
          { from: t2, to: t3 },
        ],
      },
    ],
  };
}

/** Versie van het dataformaat. Ophogen als de structuur verandert. */
const DATA_VERSION = 1;

const PROJECT_STATUSES = ["idea", "active", "paused", "done"];
const TASK_STATUSES = ["todo", "doing", "done"];
const PRIORITIES = ["low", "medium", "high"];

function str(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Maak van willekeurige (oude, geïmporteerde of half kapotte) data een geldige state.
 * Ontbrekende velden worden aangevuld; ongeldige links worden weggelaten.
 * Gooit een Error als het helemaal geen Synapse-data is.
 */
function normalizeState(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.projects)) {
    throw new Error("Dit is geen geldig Synapse-bestand (er staat geen lijst met projecten in).");
  }

  const usedIds = new Set();
  const freshId = (id, prefix) => {
    const ok = typeof id === "string" && id && !usedIds.has(id);
    const result = ok ? id : uid(prefix);
    usedIds.add(result);
    return result;
  };

  const projects = data.projects
    .filter((p) => p && typeof p === "object")
    .map((p) => {
      const tasks = (Array.isArray(p.tasks) ? p.tasks : [])
        .filter((t) => t && typeof t === "object")
        .map((t, i) => ({
          id: freshId(t.id, "task"),
          title: str(t.title).trim() || "Naamloze taak",
          status: oneOf(t.status, TASK_STATUSES, "todo"),
          priority: oneOf(t.priority, PRIORITIES, "medium"),
          notes: str(t.notes),
          // Zonder positie: netjes naast elkaar zetten.
          x: Number.isFinite(t.x) ? t.x : 200 + (i % 5) * 140,
          y: Number.isFinite(t.y) ? t.y : 180 + Math.floor(i / 5) * 140,
        }));

      const taskIds = new Set(tasks.map((t) => t.id));
      const seen = new Set();
      const links = (Array.isArray(p.links) ? p.links : []).filter((l) => {
        if (!l || !taskIds.has(l.from) || !taskIds.has(l.to) || l.from === l.to) return false;
        const key = [l.from, l.to].sort().join("|"); // A→B en B→A tellen als dubbel
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map((l) => ({ from: l.from, to: l.to }));

      return {
        id: freshId(p.id, "proj"),
        name: str(p.name).trim() || "Naamloos project",
        repo: str(p.repo),
        status: oneOf(p.status, PROJECT_STATUSES, "active"),
        deadline: /^\d{4}-\d{2}-\d{2}$/.test(str(p.deadline)) ? p.deadline : "",
        description: str(p.description),
        tasks,
        links,
      };
    });

  const activeOk = projects.some((p) => p.id === data.activeProjectId);
  return {
    version: DATA_VERSION,
    activeProjectId: activeOk ? data.activeProjectId : projects[0]?.id || null,
    view: data.view === "list" ? "list" : "graph",
    listPriority: oneOf(data.listPriority, ["all", ...PRIORITIES], "all"),
    projects,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeState(defaultData());
    return normalizeState(JSON.parse(raw));
  } catch {
    return normalizeState(defaultData());
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // Bijv. opslag vol of geblokkeerd (privévenster): de app blijft werken, maar waarschuw.
    console.warn("Synapse: opslaan mislukt", err);
  }
}

/** Back-up als JSON-tekst, met een kopje zodat je het bestand later herkent. */
function exportJson(state) {
  const { view, listPriority, ...data } = state; // weergave-voorkeuren horen niet in een back-up
  return JSON.stringify(
    { app: "synapse", exportedAt: new Date().toISOString(), ...data, version: DATA_VERSION },
    null,
    2,
  );
}

/** Lees een back-up (tekst) in. Gooit een Error met een leesbare melding als het niet lukt. */
function importJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Dit bestand is geen geldige JSON.");
  }
  if (Number(data?.version) > DATA_VERSION) {
    throw new Error("Dit bestand komt uit een nieuwere versie van Synapse. Werk de app eerst bij.");
  }
  return normalizeState(data);
}

window.SynapseStore = {
  uid,
  loadState,
  saveState,
  defaultData,
  normalizeState,
  exportJson,
  importJson,
};
})();
