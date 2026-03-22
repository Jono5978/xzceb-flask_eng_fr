import { useState } from 'react'
import ProjectSetup from './screens/ProjectSetup'
import BehaviourConfig from './screens/BehaviourConfig'
import RunSimulation from './screens/RunSimulation'
import Report from './screens/Report'

const NAV_ITEMS = [
  { id: 'project-setup', label: 'Project Setup' },
  { id: 'behaviour-config', label: 'Behaviour Config' },
  { id: 'run-simulation', label: 'Run Simulation' },
  { id: 'report', label: 'Report' }
]

const SCREENS = {
  'project-setup': <ProjectSetup />,
  'behaviour-config': <BehaviourConfig />,
  'run-simulation': <RunSimulation />,
  report: <Report />
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('project-setup')

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

        {/* File actions */}
        <div className="px-4 py-3 border-b border-slate-700 flex gap-2">
          <button
            onClick={async () => {
              const result = await window.api.saveProject({ screen: currentScreen })
              if (result?.success) console.log('Project saved to', result.filePath)
            }}
            className="flex-1 text-xs py-1.5 px-3 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            Save
          </button>
          <button
            onClick={async () => {
              const data = await window.api.loadProject()
              if (data) console.log('Project loaded:', data)
            }}
            className="flex-1 text-xs py-1.5 px-3 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            Load
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentScreen(item.id)}
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
      <main className="flex-1 bg-white overflow-auto">
        {SCREENS[currentScreen]}
      </main>
    </div>
  )
}
