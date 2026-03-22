import { create } from 'zustand'

const newResource = () => ({ id: crypto.randomUUID(), name: '', role: '' })

const newTask = () => ({
  id: crypto.randomUUID(),
  name: '',
  resourceId: '',
  duration: '',
  dependencies: [],
  chainType: 'Critical Chain'
})

const DEFAULT_BEHAVIOUR = {
  studentSyndrome:       { enabled: true, floatConsumed: 60 },
  parkinsonsLaw:         { enabled: true, passThrough: 10 },
  multitasking:          { enabled: true, maxConcurrent: 3 },
  switchingCosts:        { enabled: true, productivityLoss: 20 },
}

export const useProjectStore = create((set, get) => ({
  // Project metadata
  projectName: '',
  timeUnit: 'Weeks',

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

  // ── Resources ─────────────────────────────────────────────────────────────
  addResource: () =>
    set((s) => ({ resources: [...s.resources, newResource()] })),

  updateResource: (id, field, value) =>
    set((s) => ({
      resources: s.resources.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    })),

  removeResource: (id) =>
    set((s) => ({
      resources: s.resources.filter((r) => r.id !== id),
      // Clear any tasks that referenced this resource
      tasks: s.tasks.map((t) => (t.resourceId === id ? { ...t, resourceId: '' } : t))
    })),

  // ── Tasks ──────────────────────────────────────────────────────────────────
  addTask: () =>
    set((s) => ({ tasks: [...s.tasks, newTask()] })),

  updateTask: (id, field, value) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    })),

  removeTask: (id) =>
    set((s) => ({
      tasks: s.tasks
        .filter((t) => t.id !== id)
        // Remove deleted task from other tasks' dependencies
        .map((t) => ({ ...t, dependencies: t.dependencies.filter((d) => d !== id) }))
    })),

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
      projectName: '',
      timeUnit: 'Weeks',
      resources: [newResource()],
      tasks: [newTask()],
      behaviour: { ...DEFAULT_BEHAVIOUR },
      simulationResults: null,
    }),

  // ── Persistence ────────────────────────────────────────────────────────────
  getSnapshot: () => {
    const { projectName, timeUnit, resources, tasks, behaviour, simulationResults } = get()
    return { projectName, timeUnit, resources, tasks, behaviour, simulationResults }
  },

  loadSnapshot: (data) => {
    if (!data) return
    set({
      projectName: data.projectName ?? '',
      timeUnit: data.timeUnit ?? 'Weeks',
      resources: data.resources ?? [newResource()],
      tasks: data.tasks ?? [newTask()],
      behaviour: data.behaviour ?? { ...DEFAULT_BEHAVIOUR },
      simulationResults: data.simulationResults ?? null,
    })
  }
}))
