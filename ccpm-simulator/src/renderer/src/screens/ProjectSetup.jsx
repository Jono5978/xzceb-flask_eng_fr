import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'

// ── small reusable primitives ──────────────────────────────────────────────

function Input({ value, onChange, placeholder, className = '' }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white ${className}`}
    />
  )
}

function Select({ value, onChange, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white ${className}`}
    >
      {children}
    </select>
  )
}

function IconBtn({ onClick, title, danger = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded text-sm transition-colors ${
        danger
          ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
      }`}
    >
      {danger ? '✕' : '+'}
    </button>
  )
}

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
      {action}
    </div>
  )
}

function AddBtn({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
    >
      <span className="text-base leading-none">+</span>
      {label}
    </button>
  )
}

// ── Multi-select dependency picker ──────────────────────────────────────────

function DepsCell({ taskId, selectedIds, tasks, onToggle }) {
  const [open, setOpen] = useState(false)
  const options = tasks.filter((t) => t.id !== taskId)
  const selectedNames = options
    .filter((t) => selectedIds.includes(t.id))
    .map((t) => t.name || '(unnamed)')

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-2 py-1.5 text-sm border border-gray-200 rounded bg-white hover:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-400 truncate"
      >
        {selectedNames.length ? selectedNames.join(', ') : (
          <span className="text-gray-400">None</span>
        )}
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 min-w-[180px] bg-white border border-gray-200 rounded shadow-lg py-1 max-h-48 overflow-auto">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">No other tasks yet</p>
            ) : (
              options.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(t.id)}
                    onChange={() => onToggle(t.id)}
                    className="accent-blue-500"
                  />
                  <span className="truncate">{t.name || '(unnamed)'}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Column header helper ────────────────────────────────────────────────────

function Th({ children, width }) {
  return (
    <th
      style={width ? { width } : undefined}
      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
    >
      {children}
    </th>
  )
}

// ── Resources table ──────────────────────────────────────────────────────────

function ResourcesTable() {
  const resources = useProjectStore((s) => s.resources)
  const addResource = useProjectStore((s) => s.addResource)
  const updateResource = useProjectStore((s) => s.updateResource)
  const removeResource = useProjectStore((s) => s.removeResource)

  return (
    <div>
      <SectionHeader
        title="Resources"
        action={<AddBtn onClick={addResource} label="Add Resource" />}
      />
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <Th width="45%">Resource Name</Th>
              <Th>Role / Type</Th>
              <Th width="40px"></Th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-gray-100 last:border-0 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                }`}
              >
                <td className="px-3 py-2">
                  <Input
                    value={r.name}
                    onChange={(v) => updateResource(r.id, 'name', v)}
                    placeholder="e.g. Alice"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={r.role}
                    onChange={(v) => updateResource(r.id, 'role', v)}
                    placeholder="e.g. Developer"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <IconBtn
                    onClick={() => removeResource(r.id)}
                    title="Remove resource"
                    danger
                  />
                </td>
              </tr>
            ))}
            {resources.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-sm text-gray-400">
                  No resources yet — click Add Resource
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tasks table ──────────────────────────────────────────────────────────────

function TasksTable({ timeUnit }) {
  const tasks = useProjectStore((s) => s.tasks)
  const resources = useProjectStore((s) => s.resources)
  const addTask = useProjectStore((s) => s.addTask)
  const updateTask = useProjectStore((s) => s.updateTask)
  const removeTask = useProjectStore((s) => s.removeTask)

  const toggleDep = (taskId, depId) => {
    const task = tasks.find((t) => t.id === taskId)
    const next = task.dependencies.includes(depId)
      ? task.dependencies.filter((d) => d !== depId)
      : [...task.dependencies, depId]
    updateTask(taskId, 'dependencies', next)
  }

  return (
    <div>
      <SectionHeader
        title="Tasks"
        action={<AddBtn onClick={addTask} label="Add Task" />}
      />
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <Th width="20%">Task Name</Th>
              <Th width="16%">Resource</Th>
              <Th width="11%">Duration ({timeUnit})</Th>
              <Th width="22%">Dependencies</Th>
              <Th width="22%">Chain Type</Th>
              <Th width="40px"></Th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, i) => (
              <tr
                key={t.id}
                className={`border-b border-gray-100 last:border-0 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                }`}
              >
                <td className="px-3 py-2">
                  <Input
                    value={t.name}
                    onChange={(v) => updateTask(t.id, 'name', v)}
                    placeholder={`Task ${i + 1}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={t.resourceId}
                    onChange={(v) => updateTask(t.id, 'resourceId', v)}
                  >
                    <option value="">— assign —</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || '(unnamed)'}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={t.duration}
                    onChange={(v) => updateTask(t.id, 'duration', v)}
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-2">
                  <DepsCell
                    taskId={t.id}
                    selectedIds={t.dependencies}
                    tasks={tasks}
                    onToggle={(depId) => toggleDep(t.id, depId)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={t.chainType}
                    onChange={(v) => updateTask(t.id, 'chainType', v)}
                  >
                    <option>Critical Chain</option>
                    <option>Feeding Chain</option>
                  </Select>
                </td>
                <td className="px-2 py-2 text-center">
                  <IconBtn
                    onClick={() => removeTask(t.id)}
                    title="Remove task"
                    danger
                  />
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-400">
                  No tasks yet — click Add Task
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function ProjectSetup({ onNavigate }) {
  const projectName = useProjectStore((s) => s.projectName)
  const timeUnit = useProjectStore((s) => s.timeUnit)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const setTimeUnit = useProjectStore((s) => s.setTimeUnit)
  const tasks = useProjectStore((s) => s.tasks)
  const resources = useProjectStore((s) => s.resources)

  const [error, setError] = useState('')

  const handleProceed = () => {
    const hasEnoughTasks = tasks.length >= 3
    const hasAssignedResource = tasks.some((t) => t.resourceId !== '')

    if (!hasEnoughTasks || !hasAssignedResource) {
      setError(
        !hasEnoughTasks
          ? `At least 3 tasks are required (currently ${tasks.length}).`
          : 'At least one task must have a resource assigned.'
      )
      return
    }
    setError('')
    onNavigate('behaviour-config')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Project Setup</h1>
          <p className="text-xs text-gray-400 mt-0.5">Define resources and tasks for your CCPM project</p>
        </div>
        <button
          onClick={handleProceed}
          className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Proceed to Behaviour Config →
        </button>
      </div>

      {/* Inline error */}
      {error && (
        <div className="mx-8 mt-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <span>⚠</span> {error}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-8 py-6 space-y-8 pb-40">
        {/* Project meta */}
        <div className="flex gap-6 items-end">
          <div className="flex-1 max-w-sm">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Project Name
            </label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My CCPM Project"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Time Unit
            </label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {['Weeks', 'Months'].map((u) => (
                <button
                  key={u}
                  onClick={() => setTimeUnit(u)}
                  className={`px-5 py-2 text-sm font-medium transition-colors ${
                    timeUnit === u
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resources */}
        <ResourcesTable />

        {/* Tasks */}
        <TasksTable timeUnit={timeUnit} />
      </div>
    </div>
  )
}
