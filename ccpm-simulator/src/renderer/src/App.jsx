import { useCallback, useState } from 'react'
import { useProjectStore } from './store/projectStore'
import { saveProject, loadProject } from './utils/projectStorage'
import HomeScreen from './screens/HomeScreen'
import ProjectSetup from './screens/ProjectSetup'
import BehaviourConfig from './screens/BehaviourConfig'
import RunSimulation from './screens/RunSimulation'
import Report from './screens/Report'

const NAV_ITEMS = [
  { id: 'project-setup',    label: 'Project Setup' },
  { id: 'behaviour-config', label: 'Behaviour Config' },
  { id: 'run-simulation',   label: 'Run Simulation' },
  { id: 'report',           label: 'Report' },
]

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home')

  const getSnapshot  = useProjectStore((s) => s.getSnapshot)
  const loadSnapshot = useProjectStore((s) => s.loadSnapshot)
  const initProject  = useProjectStore((s) => s.initProject)
  const projectId    = useProjectStore((s) => s.projectId)

  // ── Navigation ─────────────────────────────────────────────────────────
  // Auto-save to localStorage whenever navigating back to the home screen.

  const handleNavigate = useCallback((screen) => {
    if (screen === 'home') {
      const snap = getSnapshot()
      if (snap.projectId) saveProject(snap.projectId, snap)
    }
    setCurrentScreen(screen)
  }, [getSnapshot])

  // ── Home screen callbacks ───────────────────────────────────────────────

  const handleNewProject = useCallback((name, dueDate) => {
    const id = crypto.randomUUID()
    initProject(id, name, dueDate)
    // Save immediately so the project appears if the user returns home early
    saveProject(id, { projectId: id, projectName: name, projectDueDate: dueDate,
      timeUnit: 'Weeks', resources: [], tasks: [], behaviour: {}, simulationResults: null })
    setCurrentScreen('project-setup')
  }, [initProject])

  const handleOpenProject = useCallback((id) => {
    const snap = loadProject(id)
    if (snap) {
      loadSnapshot(snap)
      setCurrentScreen('project-setup')
    }
  }, [loadSnapshot])

  // ── Render ─────────────────────────────────────────────────────────────

  if (currentScreen === 'home') {
    return (
      <HomeScreen
        onNew={handleNewProject}
        onOpen={handleOpenProject}
      />
    )
  }

  const screenProps = { onNavigate: handleNavigate }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'project-setup':    return <ProjectSetup    {...screenProps} />
      case 'behaviour-config': return <BehaviourConfig {...screenProps} />
      case 'run-simulation':   return <RunSimulation   {...screenProps} />
      case 'report':           return <Report          {...screenProps} />
      default:                 return null
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className="flex flex-col w-64 shrink-0 text-white"
        style={{ backgroundColor: '#0f172a' }}
      >
        {/* Logo / Title */}
        <div className="px-6 py-5 border-b border-slate-700">
          <h1 className="text-lg font-bold tracking-wide">CCPM Simulator</h1>
          <p className="text-xs text-slate-400 mt-0.5">Theory of Constraints</p>
        </div>

        {/* Home button */}
        <div className="px-4 py-3 border-b border-slate-700">
          <button
            onClick={() => handleNavigate('home')}
            className="w-full text-left flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            ← Home
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    currentScreen === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700">
          <p className="text-xs text-slate-500">v1.0.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-white overflow-hidden flex flex-col">
        {renderScreen()}
      </main>
    </div>
  )
}
