import { create } from 'zustand'

const newResource = () => ({ id: crypto.randomUUID(), name: '', fte: '' })

const newTask = (position = { x: 80, y: 80 }) => ({
  id: crypto.randomUUID(),
  name: '',
  resourceId: '',
  duration: '',
  dependencies: [],
  finishDate: '',
  chainType: 'Critical Chain', // auto-calculated before simulation
  position,
})

const DEFAULT_BEHAVIOUR = {
  studentSyndrome:       { enabled: true, floatConsumed: 60 },
  parkinsonsLaw:         { enabled: true, passThrough: 10 },
  multitasking:          { enabled: true, maxConcurrent: 3 },
  switchingCosts:        { enabled: true, productivityLoss: 20 },
}

// ── Auto-calculate critical chain (longest-duration path) ──────────────────

function computeChainTypes(tasks) {
  if (tasks.length === 0) return tasks

  const dur = Object.fromEntries(tasks.map((t) => [t.id, Number(t.duration) || 0]))
  const successors = {}
  tasks.forEach((t) => {
    if (!successors[t.id]) successors[t.id] = []
    t.dependencies.forEach((depId) => {
      if (!successors[depId]) successors[depId] = []
      successors[depId].push(t.id)
    })
  })

  // Longest path length ending at each node (forward pass)
  const earliest = {}
  const topoOrder = []
  const inDeg = Object.fromEntries(tasks.map((t) => [t.id, t.dependencies.length]))
  const queue = tasks.filter((t) => inDeg[t.id] === 0).map((t) => t.id)
  queue.forEach((id) => (earliest[id] = dur[id]))
  while (queue.length > 0) {
    const id = queue.shift()
    topoOrder.push(id)
    ;(successors[id] || []).forEach((succId) => {
      earliest[succId] = Math.max(earliest[succId] ?? 0, (earliest[id] ?? 0) + dur[succId])
      inDeg[succId]--
      if (inDeg[succId] === 0) queue.push(succId)
    })
  }
  // Nodes not reached (cycles) default to their duration
  tasks.forEach((t) => { if (earliest[t.id] === undefined) earliest[t.id] = dur[t.id] })

  // Project end = max earliest finish
  const maxFinish = Math.max(...Object.values(earliest))

  // Backward pass: find tasks on the critical path
  const onCritical = new Set()
  const predecessors = Object.fromEntries(tasks.map((t) => [t.id, t.dependencies]))

  const backtrack = (id) => {
    if (onCritical.has(id)) return
    onCritical.add(id)
    const myEarliest = earliest[id]
    predecessors[id].forEach((depId) => {
      if (earliest[depId] === myEarliest - dur[id]) backtrack(depId)
    })
  }

  // Start backtrack from tasks whose earliest finish equals maxFinish
  tasks.forEach((t) => { if (earliest[t.id] === maxFinish) backtrack(t.id) })

  return tasks.map((t) => ({
    ...t,
    chainType: onCritical.has(t.id) ? 'Critical Chain' : 'Feeding Chain',
  }))
}

export const useProjectStore = create((set, get) => ({
  // Project metadata
  projectId: null,
  projectName: '',
  timeUnit: 'Weeks',
  projectDueDate: '',

  // Resources
  resources: [newResource()],

  // Tasks
  tasks: [newTask()],

  // Behaviour config
  behaviour: { ...DEFAULT_BEHAVIOUR },

  // Simulation results (set after a run completes)
  simulationResults: null,

  // ── Project metadata ──────────────────────────────────────────────────────
  setProjectName: (name) => set({ projectName: name }),
  setTimeUnit: (unit) => set({ timeUnit: unit }),
  setProjectDueDate: (date) => set({ projectDueDate: date }),
  setProjectId: (id) => set({ projectId: id }),

  // Initialise a brand-new project (resets all state, sets id/name/dueDate)
  initProject: (id, name, dueDate) =>
    set({
      projectId: id,
      projectName: name,
      timeUnit: 'Weeks',
      projectDueDate: dueDate,
      resources: [newResource()],
      tasks: [newTask()],
      behaviour: { ...DEFAULT_BEHAVIOUR },
      simulationResults: null,
    }),

  // ── Resources ─────────────────────────────────────────────────────────────
  addResource: () =>
    set((s) => ({ resources: [...s.resources, newResource()] })),

  updateResource: (id, field, value) =>
    set((s) => ({
      resources: s.resources.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    })),

  removeResource: (id) =>
    set((s) => ({
      resources: s.resources.filter((r) => r.id !== id),
      tasks: s.tasks.map((t) => (t.resourceId === id ? { ...t, resourceId: '' } : t)),
    })),

  // ── Tasks ──────────────────────────────────────────────────────────────────
  addTask: () =>
    set((s) => {
      const count = s.tasks.length
      const position = { x: 80 + (count % 4) * 240, y: 80 + Math.floor(count / 4) * 150 }
      return { tasks: [...s.tasks, newTask(position)] }
    }),

  updateTask: (id, field, value) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    })),

  updateTaskPosition: (id, position) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, position } : t)),
    })),

  setTaskPositions: (positions) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (positions[t.id] ? { ...t, position: positions[t.id] } : t)),
    })),

  removeTask: (id) =>
    set((s) => ({
      tasks: s.tasks
        .filter((t) => t.id !== id)
        .map((t) => ({ ...t, dependencies: t.dependencies.filter((d) => d !== id) })),
    })),

  setTaskFinishDates: (dateMap) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        dateMap[t.id] !== undefined ? { ...t, finishDate: dateMap[t.id] } : t
      ),
    })),

  // Call before running simulation to auto-assign chainType
  computeChainTypes: () =>
    set((s) => ({ tasks: computeChainTypes(s.tasks) })),

  // ── Simulation results ─────────────────────────────────────────────────────
  setSimulationResults: (results) => set({ simulationResults: results }),

  // ── Behaviour config ───────────────────────────────────────────────────────
  setBehaviourToggle: (key, enabled) =>
    set((s) => ({ behaviour: { ...s.behaviour, [key]: { ...s.behaviour[key], enabled } } })),

  setBehaviourParam: (key, param, value) =>
    set((s) => ({ behaviour: { ...s.behaviour, [key]: { ...s.behaviour[key], [param]: value } } })),

  // ── Reset ──────────────────────────────────────────────────────────────────
  resetStore: () =>
    set({
      projectId: null,
      projectName: '',
      timeUnit: 'Weeks',
      projectDueDate: '',
      resources: [newResource()],
      tasks: [newTask()],
      behaviour: { ...DEFAULT_BEHAVIOUR },
      simulationResults: null,
    }),

  // ── Persistence ────────────────────────────────────────────────────────────
  getSnapshot: () => {
    const { projectId, projectName, timeUnit, projectDueDate, resources, tasks, behaviour, simulationResults } = get()
    return { projectId, projectName, timeUnit, projectDueDate, resources, tasks, behaviour, simulationResults }
  },

  loadSnapshot: (data) => {
    if (!data) return
    set({
      projectId: data.projectId ?? null,
      projectName: data.projectName ?? '',
      timeUnit: data.timeUnit ?? 'Weeks',
      projectDueDate: data.projectDueDate ?? '',
      resources: (data.resources ?? [newResource()]).map((r) => ({
        ...r,
        fte: r.fte ?? '',
      })),
      tasks: (data.tasks ?? [newTask()]).map((t) => ({
        ...t,
        finishDate: t.finishDate ?? '',
        position: t.position ?? { x: 80, y: 80 },
        chainType: t.chainType ?? 'Critical Chain',
      })),
      behaviour: data.behaviour ?? { ...DEFAULT_BEHAVIOUR },
      simulationResults: data.simulationResults ?? null,
    })
  },
}))
