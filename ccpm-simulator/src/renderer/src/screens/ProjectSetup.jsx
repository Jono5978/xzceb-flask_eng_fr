import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useProjectStore } from '../store/projectStore'
import TaskNode from '../components/TaskNode'

// ── React Flow node type registry (stable reference) ──────────────────────

const nodeTypes = { taskNode: TaskNode }

// ── Helpers ────────────────────────────────────────────────────────────────

function tasksToEdges(tasks) {
  const edges = []
  tasks.forEach((t) => {
    t.dependencies.forEach((depId) => {
      edges.push({
        id: `${depId}->${t.id}`,
        source: depId,
        target: t.id,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      })
    })
  })
  return edges
}

// ── Backward-pass finish date calculator ───────────────────────────────────
// Works backwards from the project due date through the dependency network.
// Terminal tasks (no successors) finish on the project due date.
// Each predecessor finishes when the earliest of its successors starts.

function computeFinishDates(tasks, projectDueDate, timeUnit) {
  if (!projectDueDate || tasks.length === 0) return {}

  const daysPerUnit = timeUnit === 'Months' ? 30 : 7
  const msPerDay = 86400000
  const projectMs = new Date(projectDueDate).getTime()

  // Build successor map
  const successors = {}
  tasks.forEach((t) => {
    successors[t.id] = successors[t.id] || []
    t.dependencies.forEach((depId) => {
      successors[depId] = successors[depId] || []
      successors[depId].push(t.id)
    })
  })

  // Topological order (Kahn's)
  const tempInDeg = Object.fromEntries(tasks.map((t) => [t.id, t.dependencies.length]))
  const tempQueue = tasks.filter((t) => tempInDeg[t.id] === 0).map((t) => t.id)
  const topoOrder = []
  while (tempQueue.length > 0) {
    const id = tempQueue.shift()
    topoOrder.push(id)
    ;(successors[id] || []).forEach((succId) => {
      tempInDeg[succId]--
      if (tempInDeg[succId] === 0) tempQueue.push(succId)
    })
  }
  // Catch any tasks not reached (shouldn't happen after cycle guard, but be safe)
  tasks.forEach((t) => { if (!topoOrder.includes(t.id)) topoOrder.push(t.id) })

  // Backward pass: process in reverse topological order
  const finishMs = {}
  ;[...topoOrder].reverse().forEach((id) => {
    const succIds = successors[id] || []
    if (succIds.length === 0) {
      finishMs[id] = projectMs
    } else {
      let minSuccStart = Infinity
      succIds.forEach((succId) => {
        const succTask = tasks.find((t) => t.id === succId)
        if (!succTask) return
        const succDur = Number(succTask.duration) || 0
        const succFinish = finishMs[succId] ?? projectMs
        minSuccStart = Math.min(minSuccStart, succFinish - succDur * daysPerUnit * msPerDay)
      })
      finishMs[id] = minSuccStart === Infinity ? projectMs : minSuccStart
    }
  })

  const result = {}
  tasks.forEach((t) => {
    if (finishMs[t.id] !== undefined) {
      result[t.id] = new Date(finishMs[t.id]).toISOString().split('T')[0]
    }
  })
  return result
}

function wouldCreateCycle(tasks, sourceId, targetId) {
  // Check if there's already a path from targetId → sourceId in the existing graph.
  // If so, adding sourceId → targetId would create a cycle.
  const successors = {}
  tasks.forEach((t) => {
    if (!successors[t.id]) successors[t.id] = []
    t.dependencies.forEach((depId) => {
      if (!successors[depId]) successors[depId] = []
      successors[depId].push(t.id)
    })
  })
  const visited = new Set()
  const dfs = (id) => {
    if (id === sourceId) return true
    if (visited.has(id)) return false
    visited.add(id)
    return (successors[id] || []).some(dfs)
  }
  return dfs(targetId)
}

function computeAutoLayout(tasks) {
  if (tasks.length === 0) return {}

  const NODE_W = 176, NODE_H = 70, H_GAP = 80, V_GAP = 50

  const successors = {}
  const inDeg = {}
  tasks.forEach((t) => {
    successors[t.id] = []
    inDeg[t.id] = 0
  })
  tasks.forEach((t) =>
    t.dependencies.forEach((depId) => {
      if (successors[depId]) successors[depId].push(t.id)
      inDeg[t.id]++
    })
  )

  // Kahn's topological sort with layer assignment
  const layer = {}
  const queue = tasks.filter((t) => inDeg[t.id] === 0).map((t) => t.id)
  queue.forEach((id) => (layer[id] = 0))

  const visited = [...queue]
  while (visited.length > 0) {
    const id = visited.shift()
    ;(successors[id] || []).forEach((succId) => {
      layer[succId] = Math.max(layer[succId] ?? 0, (layer[id] ?? 0) + 1)
      inDeg[succId]--
      if (inDeg[succId] === 0) visited.push(succId)
    })
  }
  tasks.forEach((t) => { if (layer[t.id] === undefined) layer[t.id] = 0 })

  // Group by layer, assign vertical position (centred)
  const byLayer = {}
  tasks.forEach((t) => {
    const l = layer[t.id]
    if (!byLayer[l]) byLayer[l] = []
    byLayer[l].push(t.id)
  })

  const positions = {}
  Object.entries(byLayer).forEach(([l, ids]) => {
    const totalH = ids.length * NODE_H + (ids.length - 1) * V_GAP
    const startY = -totalH / 2 + 300
    ids.forEach((id, i) => {
      positions[id] = {
        x: 60 + Number(l) * (NODE_W + H_GAP),
        y: startY + i * (NODE_H + V_GAP),
      }
    })
  })

  return positions
}

// ── Side panel primitives ──────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{children}</p>
  )
}

function PanelInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
    />
  )
}

function PanelSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
    >
      {children}
    </select>
  )
}

// ── Task detail panel ──────────────────────────────────────────────────────

function TaskDetailPanel({ task, resources, timeUnit, onUpdate, onDelete }) {
  return (
    <div className="p-4 border-b border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Task Details</p>
        <button
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          Delete task
        </button>
      </div>

      <div>
        <FieldLabel>Name</FieldLabel>
        <PanelInput
          value={task.name}
          onChange={(v) => onUpdate('name', v)}
          placeholder="Task name"
        />
      </div>

      <div>
        <FieldLabel>Duration ({timeUnit})</FieldLabel>
        <PanelInput
          value={task.duration}
          onChange={(v) => onUpdate('duration', v)}
          placeholder="0"
          type="number"
        />
      </div>

      <div>
        <FieldLabel>Assigned Resource</FieldLabel>
        <PanelSelect value={task.resourceId} onChange={(v) => onUpdate('resourceId', v)}>
          <option value="">— unassigned —</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name || '(unnamed)'}
            </option>
          ))}
        </PanelSelect>
      </div>

      <div>
        <FieldLabel>Finish Date (auto-calculated)</FieldLabel>
        <p className="w-full px-2.5 py-1.5 text-sm border border-gray-100 rounded bg-gray-50 text-gray-600">
          {task.finishDate
            ? new Date(task.finishDate + 'T00:00:00').toLocaleDateString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric',
              })
            : <span className="text-gray-300 italic">set project due date first</span>}
        </p>
      </div>
    </div>
  )
}

function NoTaskSelectedPanel() {
  return (
    <div className="p-4 border-b border-gray-200">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Task Details
      </p>
      <p className="text-sm text-gray-400 text-center py-6">
        Click a task to edit its details
      </p>
      <p className="text-xs text-gray-300 text-center leading-relaxed">
        Drag from the right edge of a task to create a dependency arrow
      </p>
      <p className="text-xs text-gray-300 text-center leading-relaxed">
        Click an arrow then press Delete or Backspace to remove it
      </p>
    </div>
  )
}

// ── Resources panel ────────────────────────────────────────────────────────

function ResourcesPanel() {
  const resources = useProjectStore((s) => s.resources)
  const addResource = useProjectStore((s) => s.addResource)
  const updateResource = useProjectStore((s) => s.updateResource)
  const removeResource = useProjectStore((s) => s.removeResource)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resources</p>
        <button
          onClick={addResource}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
        >
          + Add
        </button>
      </div>

      {resources.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No resources yet</p>
      )}

      <div className="space-y-2">
        {resources.map((r) => (
          <div key={r.id} className="flex gap-1.5 items-center">
            <input
              value={r.name}
              onChange={(e) => updateResource(r.id, 'name', e.target.value)}
              placeholder="Skill type"
              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            />
            <input
              value={r.fte}
              onChange={(e) => updateResource(r.id, 'fte', e.target.value)}
              placeholder="FTE"
              type="number"
              min="0.1"
              step="0.1"
              className="w-16 shrink-0 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            />
            <button
              onClick={() => removeResource(r.id)}
              className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 flex-shrink-0 text-sm"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Project due date gate modal ────────────────────────────────────────────

function DueDateModal({ onConfirm }) {
  const [value, setValue] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">Set Project Due Date</h2>
          <p className="text-sm text-gray-500">
            Enter the target completion date. Task finish dates will be calculated backwards through the network from this date.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Due Date
          </label>
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            autoFocus
          />
        </div>
        <button
          disabled={!value}
          onClick={() => onConfirm(value)}
          className="w-full py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start Building
        </button>
      </div>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function ProjectSetup({ onNavigate }) {
  const projectName = useProjectStore((s) => s.projectName)
  const timeUnit = useProjectStore((s) => s.timeUnit)
  const projectDueDate = useProjectStore((s) => s.projectDueDate)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const setTimeUnit = useProjectStore((s) => s.setTimeUnit)
  const setProjectDueDate = useProjectStore((s) => s.setProjectDueDate)
  const tasks = useProjectStore((s) => s.tasks)
  const resources = useProjectStore((s) => s.resources)
  const addTask = useProjectStore((s) => s.addTask)
  const updateTask = useProjectStore((s) => s.updateTask)
  const removeTask = useProjectStore((s) => s.removeTask)
  const updateTaskPosition = useProjectStore((s) => s.updateTaskPosition)
  const setTaskPositions = useProjectStore((s) => s.setTaskPositions)
  const setTaskFinishDates = useProjectStore((s) => s.setTaskFinishDates)

  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')

  // ── Live finish-date recalculation ──────────────────────────────────────
  // Track only structure-relevant fields so updating finishDates doesn't re-trigger.
  const lastComputeKey = useRef(null)
  useEffect(() => {
    const key = JSON.stringify({
      structure: tasks.map((t) => ({ id: t.id, duration: t.duration, dependencies: t.dependencies })),
      projectDueDate,
      timeUnit,
    })
    if (key === lastComputeKey.current) return
    lastComputeKey.current = key
    const dates = computeFinishDates(tasks, projectDueDate, timeUnit)
    if (Object.keys(dates).length > 0) setTaskFinishDates(dates)
  }, [tasks, projectDueDate, timeUnit, setTaskFinishDates])

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? null,
    [tasks, selectedId]
  )

  // ── React Flow state ────────────────────────────────────────────────────

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Sync store → RF state when tasks/resources change.
  // We preserve current RF positions to avoid snapping during drag.
  useEffect(() => {
    setNodes((prev) => {
      const prevPos = Object.fromEntries(prev.map((n) => [n.id, n.position]))
      return tasks.map((t) => ({
        id: t.id,
        type: 'taskNode',
        position: prevPos[t.id] ?? t.position ?? { x: 80, y: 80 },
        data: {
          name: t.name,
          duration: t.duration,
          resourceName: resources.find((r) => r.id === t.resourceId)?.name ?? '',
          timeUnit,
        },
      }))
    })
    setEdges(tasksToEdges(tasks))
  }, [tasks, resources, timeUnit, setNodes, setEdges])

  // ── Canvas event handlers ───────────────────────────────────────────────

  const onConnect = useCallback(
    ({ source, target }) => {
      if (source === target) return
      if (wouldCreateCycle(tasks, source, target)) return
      const task = tasks.find((t) => t.id === target)
      if (!task || task.dependencies.includes(source)) return
      updateTask(target, 'dependencies', [...task.dependencies, source])
    },
    [tasks, updateTask]
  )

  const onEdgesDelete = useCallback(
    (deleted) => {
      deleted.forEach((e) => {
        const task = tasks.find((t) => t.id === e.target)
        if (task) {
          updateTask(e.target, 'dependencies', task.dependencies.filter((d) => d !== e.source))
        }
      })
    },
    [tasks, updateTask]
  )

  const onNodesDelete = useCallback(
    (deleted) => {
      deleted.forEach((n) => {
        removeTask(n.id)
        if (n.id === selectedId) setSelectedId(null)
      })
    },
    [removeTask, selectedId]
  )

  const onNodeDragStop = useCallback(
    (_, node) => {
      updateTaskPosition(node.id, node.position)
    },
    [updateTaskPosition]
  )

  const onSelectionChange = useCallback(({ nodes: sel }) => {
    if (sel.length === 1) setSelectedId(sel[0].id)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedId(null)
  }, [])

  // ── Toolbar handlers ────────────────────────────────────────────────────

  const handleAutoLayout = useCallback(() => {
    const positions = computeAutoLayout(tasks)
    setTaskPositions(positions)
  }, [tasks, setTaskPositions])

  const handleProceed = () => {
    if (tasks.length < 3) {
      setError(`At least 3 tasks are required (currently ${tasks.length}).`)
      return
    }
    if (!tasks.some((t) => t.resourceId)) {
      setError('At least one task must have a resource assigned.')
      return
    }
    setError('')
    onNavigate('behaviour-config')
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Due date gate modal ── */}
      {!projectDueDate && <DueDateModal onConfirm={(d) => setProjectDueDate(d)} />}

      {/* ── Top bar ── */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-48 shrink-0"
          />
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
            {['Weeks', 'Months'].map((u) => (
              <button
                key={u}
                onClick={() => setTimeUnit(u)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  timeUnit === u
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
          {projectDueDate && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-gray-400">Due:</span>
              <span className="text-xs font-medium text-gray-700">
                {new Date(projectDueDate + 'T00:00:00').toLocaleDateString(undefined, {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
              <button
                onClick={() => setProjectDueDate('')}
                className="text-xs text-blue-500 hover:text-blue-700 ml-1"
              >
                change
              </button>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1 truncate">
              <span>⚠</span> {error}
            </p>
          )}
        </div>
        <button
          onClick={handleProceed}
          className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
        >
          Proceed →
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
            onNodeDragStop={onNodeDragStop}
            onSelectionChange={onSelectionChange}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode={['Backspace', 'Delete']}
            connectionLineType="smoothstep"
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
              style: { stroke: '#94a3b8', strokeWidth: 2 },
            }}
          >
            <Background color="#e5e7eb" gap={20} />
            <Controls />

            {/* Canvas toolbar */}
            <Panel position="top-left">
              <div className="flex gap-2">
                <button
                  onClick={addTask}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow transition-colors"
                >
                  <span className="text-sm leading-none">+</span> Add Task
                </button>
                <button
                  onClick={handleAutoLayout}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow transition-colors"
                >
                  Auto Layout
                </button>
              </div>
            </Panel>
          </ReactFlow>

          {/* Empty state overlay */}
          {tasks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-1">
                <p className="text-gray-400 text-sm font-medium">No tasks yet</p>
                <p className="text-gray-300 text-xs">
                  Click "+ Add Task" to start building your project network
                </p>
                <p className="text-gray-300 text-xs">
                  Drag from the right edge of a task node to link it to another
                </p>
                <p className="text-gray-300 text-xs">
                  Click an arrow then press Delete or Backspace to remove it
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Side panel ── */}
        <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto shrink-0 flex flex-col">
          {selectedTask ? (
            <TaskDetailPanel
              task={selectedTask}
              resources={resources}
              timeUnit={timeUnit}
              onUpdate={(field, value) => updateTask(selectedId, field, value)}
              onDelete={() => {
                removeTask(selectedId)
                setSelectedId(null)
              }}
            />
          ) : (
            <NoTaskSelectedPanel />
          )}
          <ResourcesPanel />
        </div>
      </div>
    </div>
  )
}
