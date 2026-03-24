// ── In-app project persistence (localStorage) ─────────────────────────────
//
// Index key: 'ccpm_projects'  →  array of { id, name, dueDate, taskCount, lastModified }
// Data key:  'ccpm_project_<id>'  →  full project snapshot

const INDEX_KEY = 'ccpm_projects'

function getIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]')
  } catch {
    return []
  }
}

function setIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

/** Return metadata for all saved projects, newest first. */
export function listProjects() {
  return [...getIndex()].sort((a, b) =>
    new Date(b.lastModified ?? 0) - new Date(a.lastModified ?? 0)
  )
}

/** Persist a full snapshot and update the index metadata. */
export function saveProject(id, snapshot) {
  const index = getIndex()
  const now = new Date().toISOString()
  const meta = {
    id,
    name: snapshot.projectName || 'Untitled',
    dueDate: snapshot.projectDueDate || '',
    taskCount: (snapshot.tasks ?? []).length,
    lastModified: now,
  }
  const i = index.findIndex((p) => p.id === id)
  if (i >= 0) {
    index[i] = meta
  } else {
    index.push(meta)
  }
  setIndex(index)
  localStorage.setItem(`ccpm_project_${id}`, JSON.stringify(snapshot))
}

/** Load a full snapshot by id, or null if not found. */
export function loadProject(id) {
  try {
    return JSON.parse(localStorage.getItem(`ccpm_project_${id}`) ?? 'null')
  } catch {
    return null
  }
}

/** Delete a project from the index and storage. */
export function deleteProject(id) {
  setIndex(getIndex().filter((p) => p.id !== id))
  localStorage.removeItem(`ccpm_project_${id}`)
}

/** Rename a project in both the index and the stored snapshot. */
export function renameProject(id, name) {
  const index = getIndex()
  const meta = index.find((p) => p.id === id)
  if (meta) {
    meta.name = name
    setIndex(index)
  }
  try {
    const snap = JSON.parse(localStorage.getItem(`ccpm_project_${id}`) ?? 'null')
    if (snap) {
      snap.projectName = name
      localStorage.setItem(`ccpm_project_${id}`, JSON.stringify(snap))
    }
  } catch {
    // ignore
  }
}
