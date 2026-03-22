import { useProjectStore } from '../store/projectStore'

// ── Primitives ────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-amber-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function Slider({ label, value, min, max, step = 1, format, onChange, disabled = false }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={`mt-3 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs font-semibold text-amber-700 tabular-nums min-w-[3.5rem] text-right">
          {format ? format(value) : value}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-gray-200">
        <div
          className="absolute left-0 top-0 h-2 rounded-full bg-amber-400"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-gray-400">{format ? format(min) : min}</span>
        <span className="text-[10px] text-gray-400">{format ? format(max) : max}</span>
      </div>
    </div>
  )
}

// ── AS-IS behaviour card ──────────────────────────────────────────────────────

function BehaviourCard({ title, label, enabled, onToggle, children }) {
  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        enabled
          ? 'border-amber-200 bg-amber-50/60'
          : 'border-gray-200 bg-gray-50 opacity-70'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{label}</p>
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>

      {/* Slider zone */}
      {enabled && children && (
        <div className="px-4 pb-4">{children}</div>
      )}
    </div>
  )
}

// ── CCPM rule card ────────────────────────────────────────────────────────────

function CcpmCard({ icon, title, description }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex gap-3">
      <span className="text-lg shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-emerald-800">{title}</p>
        <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BehaviourConfig({ onNavigate }) {
  const behaviour = useProjectStore((s) => s.behaviour)
  const setToggle = useProjectStore((s) => s.setBehaviourToggle)
  const setParam  = useProjectStore((s) => s.setBehaviourParam)

  const { studentSyndrome, parkinsonsLaw, multitasking, switchingCosts } = behaviour

  const pct = (v) => `${v}%`

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Behaviour Config</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure how the AS-IS project behaves versus the CCPM future state
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('project-setup')}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Project Setup
          </button>
          <button
            onClick={() => onNavigate('run-simulation')}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Run Simulation →
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid grid-cols-2 gap-6 max-w-5xl mx-auto">

          {/* ── LEFT: AS-IS ─────────────────────────────────────────────── */}
          <div>
            {/* Column header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wider">
                Current State — AS-IS
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Toggle each dysfunctional behaviour on or off, and tune its severity.
              These drive the simulation baseline.
            </p>

            <div className="space-y-3">
              {/* 1 — Student Syndrome */}
              <BehaviourCard
                title="Student Syndrome"
                label="Tasks start late — available float is consumed before work begins"
                enabled={studentSyndrome.enabled}
                onToggle={(v) => setToggle('studentSyndrome', v)}
              >
                <Slider
                  label="Average float consumed before starting"
                  value={studentSyndrome.floatConsumed}
                  min={0} max={100}
                  format={pct}
                  onChange={(v) => setParam('studentSyndrome', 'floatConsumed', v)}
                />
              </BehaviourCard>

              {/* 2 — Parkinson's Law */}
              <BehaviourCard
                title="Parkinson's Law"
                label="Work expands to fill the estimate — early finishes are never passed forward"
                enabled={parkinsonsLaw.enabled}
                onToggle={(v) => setToggle('parkinsonsLaw', v)}
              >
                <Slider
                  label="Early finish pass-through rate"
                  value={parkinsonsLaw.passThrough}
                  min={0} max={100}
                  format={pct}
                  onChange={(v) => setParam('parkinsonsLaw', 'passThrough', v)}
                />
                <div className="mt-1.5 flex justify-between text-[10px] text-gray-400">
                  <span>0% = safety always consumed</span>
                  <span>100% = finish always passed forward</span>
                </div>
              </BehaviourCard>

              {/* 3 — Multitasking */}
              <BehaviourCard
                title="Multitasking / WIP Overload"
                label="Resources juggle multiple tasks simultaneously"
                enabled={multitasking.enabled}
                onToggle={(v) => setToggle('multitasking', v)}
              >
                <Slider
                  label="Max concurrent tasks per resource"
                  value={multitasking.maxConcurrent}
                  min={1} max={6}
                  onChange={(v) => setParam('multitasking', 'maxConcurrent', v)}
                />
              </BehaviourCard>

              {/* 4 — Switching costs */}
              <BehaviourCard
                title="Switching Costs"
                label="Context switching reduces productivity on each additional task"
                enabled={switchingCosts.enabled}
                onToggle={(v) => setToggle('switchingCosts', v)}
              >
                <Slider
                  label="Productivity loss per extra concurrent task"
                  value={switchingCosts.productivityLoss}
                  min={0} max={50}
                  format={pct}
                  onChange={(v) => setParam('switchingCosts', 'productivityLoss', v)}
                  disabled={!multitasking.enabled}
                />
                {!multitasking.enabled && (
                  <p className="mt-2 text-[11px] text-amber-600 italic">
                    Enable Multitasking above to activate switching costs
                  </p>
                )}
              </BehaviourCard>
            </div>
          </div>

          {/* ── RIGHT: CCPM ─────────────────────────────────────────────── */}
          <div>
            {/* Column header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold text-emerald-700 uppercase tracking-wider">
                Future State — CCPM
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              These rules are always applied in the CCPM simulation run.
              They are fixed by the Theory of Constraints methodology.
            </p>

            <div className="space-y-3">
              <CcpmCard
                icon="✂️"
                title="50% Aggressive Task Estimates"
                description="Safety time is stripped from individual task estimates. Each task duration is set to the 50th-percentile (median) estimate, removing hidden padding."
              />
              <CcpmCard
                icon="🛡️"
                title="Project Buffer"
                description="A project buffer equal to 50% of the critical chain duration is added at the end of the project to absorb statistical variation across the chain."
              />
              <CcpmCard
                icon="🔀"
                title="Feeding Buffers"
                description="A feeding buffer equal to 50% of each feeding chain duration is inserted where feeding chains merge into the critical chain, protecting the critical path."
              />
              <CcpmCard
                icon="🚦"
                title="WIP Limit: 1 Critical Chain Task"
                description="Each resource works on at most one critical chain task at a time. No multitasking is permitted on critical chain resources."
              />
              <CcpmCard
                icon="🏃"
                title="Relay Runner Rule"
                description="When a task finishes early, the early completion is passed forward immediately to the next task — the full time saving is preserved."
              />
              <CcpmCard
                icon="🔒"
                title="No Multitasking on Critical Chain"
                description="Critical chain resources are protected from task switching. Context switching costs are eliminated for the tasks that matter most."
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
