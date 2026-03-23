import { useState, useRef } from 'react'
import { useProjectStore } from '../store/projectStore'
import { runSimulation } from '../../../engine/simulate.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_ITERATIONS = 500
const BATCH_SIZE = 50

// ─── Percentile helper (for merging batched results) ─────────────────────────

function percentile(arr, p) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// ─── Store-to-engine input normaliser ─────────────────────────────────────────

function buildEngineInputs(tasks, resources, behaviour) {
  return {
    tasks: tasks.map((t) => ({
      ...t,
      estimatedDuration: Math.max(Number(t.duration) || 0, 0.001),
      chain: t.chainType === 'Critical Chain' ? 'critical' : 'feeding',
    })),
    resources,
    behaviourConfig: {
      studentSyndrome:           behaviour.studentSyndrome.enabled,
      studentDelayPct:           behaviour.studentSyndrome.floatConsumed,
      parkinsonsLaw:             behaviour.parkinsonsLaw.enabled,
      earlyFinishPassThroughPct: behaviour.parkinsonsLaw.passThrough,
      multitasking:              behaviour.multitasking.enabled,
      maxConcurrent:             behaviour.multitasking.maxConcurrent,
      switchingCosts:            behaviour.switchingCosts.enabled,
      switchingCostPct:          behaviour.switchingCosts.productivityLoss,
    },
    iterations: BATCH_SIZE,
  }
}

// ─── Summary helpers ──────────────────────────────────────────────────────────

const BEHAVIOUR_LABELS = {
  studentSyndrome: 'Student Syndrome',
  parkinsonsLaw:   "Parkinson's Law",
  multitasking:    'Multitasking / WIP Overload',
  switchingCosts:  'Switching Costs',
}

function SummaryCard({ label, value, sub }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function BehaviourPill({ label, enabled }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
        enabled
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-gray-100 border-gray-200 text-gray-400 line-through'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-amber-500' : 'bg-gray-300'}`} />
      {label}
    </span>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-gray-600">
          {current < total
            ? `Running… ${current.toLocaleString()} / ${total.toLocaleString()}`
            : `Complete — ${total.toLocaleString()} iterations`}
        </span>
        <span className="font-bold text-blue-600">{pct}%</span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RunSimulation({ onNavigate }) {
  const projectName      = useProjectStore((s) => s.projectName)
  const timeUnit         = useProjectStore((s) => s.timeUnit)
  const tasks            = useProjectStore((s) => s.tasks)
  const resources        = useProjectStore((s) => s.resources)
  const behaviour        = useProjectStore((s) => s.behaviour)
  const setResults       = useProjectStore((s) => s.setSimulationResults)
  const computeChainTypes = useProjectStore((s) => s.computeChainTypes)

  const [status, setStatus]   = useState('idle')   // 'idle' | 'running' | 'done' | 'error'
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  // Accumulator refs — hold raw finish-time arrays across batches
  const asIsRaw   = useRef([])
  const ccpmRaw   = useRef([])
  const lastAsIs  = useRef(null)
  const lastCcpm  = useRef(null)

  // Derived summary counts
  const criticalCount = tasks.filter((t) => t.chainType === 'Critical Chain').length
  const feedingCount  = tasks.filter((t) => t.chainType === 'Feeding Chain').length

  // ── batch runner ────────────────────────────────────────────────────────────

  function runBatch(batchIndex) {
    let batchResult
    try {
      batchResult = runSimulation(buildEngineInputs(tasks, resources, behaviour))
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
      return
    }

    asIsRaw.current = [...asIsRaw.current, ...batchResult.asIs.finishTimes]
    ccpmRaw.current = [...ccpmRaw.current, ...batchResult.ccpm.finishTimes]
    lastAsIs.current = batchResult.asIs
    lastCcpm.current = batchResult.ccpm

    const done = (batchIndex + 1) * BATCH_SIZE
    setProgress(done)

    if (done < TOTAL_ITERATIONS) {
      setTimeout(() => runBatch(batchIndex + 1), 0)
    } else {
      finalise()
    }
  }

  function finalise() {
    const asIs = lastAsIs.current
    const ccpm = lastCcpm.current
    const allAsIs = asIsRaw.current
    const allCcpm = ccpmRaw.current

    const results = {
      asIs: {
        finishTimes: allAsIs,
        p50: percentile(allAsIs, 50),
        p80: percentile(allAsIs, 80),
        p95: percentile(allAsIs, 95),
        avgSlippage: asIs.avgSlippage,
        wipOverTime: asIs.wipOverTime,
      },
      ccpm: {
        finishTimes: allCcpm,
        p50: percentile(allCcpm, 50),
        p80: percentile(allCcpm, 80),
        p95: percentile(allCcpm, 95),
        criticalChainDuration: ccpm.criticalChainDuration,
        projectBufferSize:     ccpm.projectBufferSize,
        bufferConsumption:     ccpm.bufferConsumption,
      },
      timeUnit,
    }

    setResults(results)
    setStatus('done')

    // Brief pause so the user sees "100% complete" before auto-navigating
    setTimeout(() => onNavigate('report'), 600)
  }

  function handleRun() {
    if (status === 'running') return
    computeChainTypes()
    // Reset accumulators
    asIsRaw.current  = []
    ccpmRaw.current  = []
    lastAsIs.current = null
    lastCcpm.current = null
    setProgress(0)
    setErrorMsg('')
    setStatus('running')
    setTimeout(() => runBatch(0), 0)
  }

  // ── render ──────────────────────────────────────────────────────────────────

  const isRunning = status === 'running'
  const isDone    = status === 'done'

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Run Simulation</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Review your configuration, then run the Monte Carlo simulation
          </p>
        </div>
        <button
          onClick={() => onNavigate('behaviour-config')}
          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Behaviour Config
        </button>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6 max-w-3xl w-full mx-auto">

        {/* ── Project summary ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Project Configuration
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            <SummaryCard
              label="Project"
              value={projectName || '(unnamed)'}
            />
            <SummaryCard
              label="Time Unit"
              value={timeUnit}
            />
            <SummaryCard
              label="Tasks"
              value={tasks.length}
              sub={`${criticalCount} critical · ${feedingCount} feeding`}
            />
            <SummaryCard
              label="Resources"
              value={resources.length}
            />
          </div>

          {/* AS-IS behaviours */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              AS-IS Behaviours
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(BEHAVIOUR_LABELS).map(([key, label]) => (
                <BehaviourPill
                  key={key}
                  label={label}
                  enabled={behaviour[key]?.enabled ?? false}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {status === 'error' && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
            <span className="mt-0.5">⚠</span>
            <div>
              <p className="font-semibold">Simulation error</p>
              <p className="mt-0.5 font-mono text-xs">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* ── Run button + progress ────────────────────────────────────────── */}
        <section className="bg-slate-900 rounded-2xl px-8 py-8 text-white space-y-6">
          <div>
            <h3 className="text-lg font-bold">Monte Carlo Simulation</h3>
            <p className="text-sm text-slate-400 mt-1">
              Runs {TOTAL_ITERATIONS} iterations — each with randomised behaviour to model
              real-world variance. Produces AS-IS and CCPM finish-time distributions.
            </p>
          </div>

          {(isRunning || isDone) && (
            <div className="bg-slate-800 rounded-xl px-5 py-4">
              <ProgressBar current={progress} total={TOTAL_ITERATIONS} />
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={isRunning}
            className={`w-full py-4 rounded-xl text-base font-bold tracking-wide transition-all ${
              isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : isDone
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-blue-500 hover:bg-blue-400 text-white active:scale-[0.98]'
            }`}
          >
            {isRunning
              ? '⏳  Simulating…'
              : isDone
              ? '✓  Done — navigating to Report…'
              : `▶  Run Simulation (${TOTAL_ITERATIONS.toLocaleString()} iterations)`}
          </button>
        </section>

      </div>
    </div>
  )
}
