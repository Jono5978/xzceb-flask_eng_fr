import { useState, useEffect, useCallback, useMemo } from 'react'
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
        <FieldLabel>Finish Date</FieldLabel>
        <PanelInput
          value={task.finishDate ?? ''}
          onChange={(v) => onUpdate('finishDate', v)}
          type="date"
        />
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
              placeholder="Name"
              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            />
            <input
              value={r.role}
              onChange={(e) => updateResource(r.id, 'role', e.target.value)}
              placeholder="Role"
              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
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

// ── Main screen ────────────────────────────────────────────────────────────

export default function ProjectSetup({ onNavigate }) {
  const projectName = useProjectStore((s) => s.projectName)
  const timeUnit = useProjectStore((s) => s.timeUnit)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const setTimeUnit = useProjectStore((s) => s.setTimeUnit)
  const tasks = useProjectStore((s) => s.tasks)
  const resources = useProjectStore((s) => s.resources)
  const addTask = useProjectStore((s) => s.addTask)
  const updateTask = useProjectStore((s) => s.updateTask)
  const removeTask = useProjectStore((s) => s.removeTask)
  const updateTaskPosition = useProjectStore((s) => s.updateTaskPosition)
  const setTaskPositions = useProjectStore((s) => s.setTaskPositions)

  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')

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
    setSelectedId(sel.length === 1 ? sel[0].id : null)
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
