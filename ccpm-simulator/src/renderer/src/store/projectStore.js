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

export const useProjectStore = create((set, get) => ({
  // Project metadata
  projectName: '',
  timeUnit: 'Weeks',

  // Resources
  resources: [newResource()],

  // Tasks
  tasks: [newTask()],

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

  // ── Persistence ────────────────────────────────────────────────────────────
  getSnapshot: () => {
    const { projectName, timeUnit, resources, tasks } = get()
    return { projectName, timeUnit, resources, tasks }
  },

  loadSnapshot: (data) => {
    if (!data) return
    set({
      projectName: data.projectName ?? '',
      timeUnit: data.timeUnit ?? 'Weeks',
      resources: data.resources ?? [newResource()],
      tasks: data.tasks ?? [newTask()]
    })
  }
}))
