import { useState, useEffect, useRef } from 'react'
import { listProjects, deleteProject, renameProject } from '../utils/projectStorage'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtRelative(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// ── New Project Modal ──────────────────────────────────────────────────────

function NewProjectModal({ onConfirm, onCancel }) {
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim() && dueDate) onConfirm(name.trim(), dueDate)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-96 flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">New Project</h2>
          <p className="text-sm text-gray-500">
            Give your project a name and set the target completion date. Task finish
            dates will be calculated backwards from the due date.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Project Name
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Redesign Q3"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Project Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !dueDate}
              className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create Project →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Project Card ───────────────────────────────────────────────────────────

function ProjectCard({ project, onOpen, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(project.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (renaming) inputRef.current?.select()
  }, [renaming])

  const commitRename = () => {
    const trimmed = renameVal.trim()
    if (trimmed && trimmed !== project.name) onRename(project.id, trimmed)
    setRenaming(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      {/* Clickable body */}
      <div
        className={`flex-1 px-5 pt-5 pb-4 ${!renaming && !confirmDelete ? 'cursor-pointer' : ''}`}
        onClick={() => !renaming && !confirmDelete && onOpen(project.id)}
      >
        {/* Name row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          {renaming ? (
            <input
              ref={inputRef}
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setRenameVal(project.name); setRenaming(false) }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-base font-semibold border-b-2 border-blue-400 focus:outline-none pb-0.5 bg-transparent"
            />
          ) : (
            <h3 className="flex-1 text-base font-semibold text-gray-800 leading-snug">
              {project.name || 'Untitled'}
            </h3>
          )}

          {/* Actions — stop propagation so card click doesn't fire */}
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setRenameVal(project.name); setRenaming(true) }}
              title="Rename"
              className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xs"
            >
              ✏
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete"
              className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-400">Due</span>
            <span className="font-medium text-gray-700">{fmtDate(project.dueDate)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{project.taskCount} task{project.taskCount !== 1 ? 's' : ''}</span>
            <span>{fmtRelative(project.lastModified)}</span>
          </div>
        </div>
      </div>

      {/* Delete confirmation strip */}
      {confirmDelete && (
        <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between gap-3">
          <p className="text-xs text-red-600 font-medium">Delete this project?</p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(project.id)}
              className="px-3 py-1 text-xs font-semibold text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5 text-3xl">
        📋
      </div>
      <h3 className="text-lg font-bold text-gray-700 mb-1">No projects yet</h3>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Create your first project to start modelling your critical chain.
      </p>
      <button
        onClick={onNew}
        className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        + New Project
      </button>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function HomeScreen({ onNew, onOpen }) {
  const [projects, setProjects] = useState([])
  const [showModal, setShowModal] = useState(false)

  // Refresh list every time this screen mounts (picks up auto-saves)
  useEffect(() => {
    setProjects(listProjects())
  }, [])

  const handleCreate = (name, dueDate) => {
    setShowModal(false)
    onNew(name, dueDate)
  }

  const handleRename = (id, name) => {
    renameProject(id, name)
    setProjects(listProjects())
  }

  const handleDelete = (id) => {
    deleteProject(id)
    setProjects(listProjects())
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-8 py-4 shrink-0"
        style={{ backgroundColor: '#0f172a' }}
      >
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide">CCPM Simulator</h1>
          <p className="text-xs text-slate-400 mt-0.5">Theory of Constraints</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
        >
          + New Project
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 px-8 py-8 max-w-6xl w-full mx-auto">
        {projects.length > 0 && (
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
            Your Projects
          </h2>
        )}

        {projects.length === 0 ? (
          <EmptyState onNew={() => setShowModal(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={onOpen}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <NewProjectModal
          onConfirm={handleCreate}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
