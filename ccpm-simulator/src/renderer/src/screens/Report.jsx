import {
  AreaChart, Area,
  BarChart, Bar, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { useProjectStore } from '../store/projectStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const C_ASIS  = '#f87171'   // red-400
const C_CCPM  = '#34d399'   // emerald-400
const HISTOGRAM_BINS = 30

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmt = (n, dp = 1) => (typeof n === 'number' ? n.toFixed(dp) : '—')

function buildHistogram(asIsArr, ccpmArr) {
  const all = [...asIsArr, ...ccpmArr]
  if (!all.length) return []
  const lo  = Math.min(...all)
  const hi  = Math.max(...all)
  if (lo === hi) return [{ time: lo, asIs: asIsArr.length, ccpm: ccpmArr.length }]
  const step = (hi - lo) / HISTOGRAM_BINS
  return Array.from({ length: HISTOGRAM_BINS }, (_, i) => {
    const bLo = lo + i * step
    const bHi = bLo + step
    return {
      time: parseFloat(((bLo + bHi) / 2).toFixed(2)),
      asIs: asIsArr.filter((t) => t >= bLo && t < bHi).length,
      ccpm: ccpmArr.filter((t) => t >= bLo && t < bHi).length,
    }
  })
}

// ─── Shared chart tooltip style ───────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: 'none',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 12,
}

// ─── Small primitives ─────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
      {children}
    </h2>
  )
}

function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
      <p className="text-sm font-semibold text-gray-500 mb-4">{title}</p>
      {children}
    </div>
  )
}

// ─── Section 1 components ─────────────────────────────────────────────────────

function StatCard({ label, value, unit, highlight = false }) {
  return (
    <div
      className={`rounded-2xl border px-6 py-5 flex flex-col gap-1 ${
        highlight
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-white border-gray-100 shadow-sm'
      }`}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-tight">
        {label}
      </p>
      <p className={`text-3xl font-extrabold tabular-nums ${highlight ? 'text-emerald-700' : 'text-gray-800'}`}>
        {fmt(value)}
        <span className="text-base font-semibold ml-1 text-gray-400">{unit}</span>
      </p>
    </div>
  )
}

function Narrative({ asIs, ccpm, timeUnit }) {
  const unit = timeUnit?.toLowerCase() ?? 'weeks'
  const delta = fmt(asIs.p50 - ccpm.p50)
  return (
    <p className="text-base text-gray-600 leading-relaxed max-w-4xl">
      Under current working patterns, this project has a{' '}
      <strong className="text-gray-800">50% chance of finishing within {fmt(asIs.p50)} {unit}</strong>,
      and carries a real risk of taking up to{' '}
      <strong className="text-gray-800">{fmt(asIs.p95)} {unit}</strong>.{' '}
      By applying CCPM — limiting work in progress, scheduling around the constraint,
      and protecting the critical chain with buffers — the same project has a{' '}
      <strong className="text-emerald-700">50% chance of finishing within {fmt(ccpm.p50)} {unit}</strong>.{' '}
      That is a potential saving of{' '}
      <strong className="text-emerald-700">{delta} {unit}</strong>.
    </p>
  )
}

function DistributionChart({ asIs, ccpm, timeUnit }) {
  const data = buildHistogram(asIs.finishTimes, ccpm.finishTimes)
  const unit = timeUnit ?? 'Weeks'
  return (
    <ChartCard title={`Projected finish date distribution across 500 simulations`}>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="gradAsIs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C_ASIS} stopOpacity={0.4} />
              <stop offset="95%" stopColor={C_ASIS} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradCcpm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C_CCPM} stopOpacity={0.4} />
              <stop offset="95%" stopColor={C_CCPM} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="time"
            tickFormatter={(v) => `${v} ${unit.charAt(0).toLowerCase()}`}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'simulations', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#cbd5e1', dy: 40 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [v, name]}
            labelFormatter={(l) => `~${l} ${unit.toLowerCase()}`}
          />
          <Legend
            formatter={(v) => (
              <span style={{ color: '#64748b', fontSize: 12 }}>
                {v === 'asIs' ? 'Current approach' : 'With CCPM'}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="asIs"
            name="asIs"
            stroke={C_ASIS}
            strokeWidth={2}
            fill="url(#gradAsIs)"
          />
          <Area
            type="monotone"
            dataKey="ccpm"
            name="ccpm"
            stroke={C_CCPM}
            strokeWidth={2}
            fill="url(#gradCcpm)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ─── Section 2 components ─────────────────────────────────────────────────────

// Build a 10-bin histogram (0–10%, 10–20%, …, 90–100%) from final buffer pct values.
function buildBufferHistogram(finalPcts) {
  const bins = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${(i + 1) * 10}%`,
    lo: i * 10,
    count: 0,
  }))
  finalPcts.forEach((pct) => {
    const idx = Math.min(Math.floor(pct / 10), 9)
    bins[idx].count++
  })
  return bins
}

function binColor(lo) {
  if (lo < 33) return '#34d399'  // green — on track
  if (lo < 66) return '#f59e0b'  // amber — at risk
  return '#f87171'               // red   — critical
}

function BufferDistributionChart({ ccpm }) {
  const finalPcts = ccpm.bufferFinalPcts ?? []
  const total = finalPcts.length
  const data = buildBufferHistogram(finalPcts)

  const onTrackPct  = total > 0 ? Math.round(finalPcts.filter((p) => p <  33).length / total * 100) : 0
  const atRiskPct   = total > 0 ? Math.round(finalPcts.filter((p) => p >= 33 && p < 66).length / total * 100) : 0
  const criticalPct = total > 0 ? Math.round(finalPcts.filter((p) => p >= 66).length / total * 100) : 0

  return (
    <ChartCard title="CCPM project buffer consumption — distribution across simulations">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'simulations', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#cbd5e1', dy: 40 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [v, 'simulations']}
            labelFormatter={(l) => `Buffer consumed: ${l}`}
          />
          <ReferenceLine x="30–40%" stroke="#86efac" strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine x="60–70%" stroke="#fcd34d" strokeDasharray="4 4" strokeWidth={1} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={binColor(entry.lo)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-5 mt-3 flex-wrap">
        {[
          { color: '#34d399', label: 'On track (<33%)',   pct: onTrackPct  },
          { color: '#f59e0b', label: 'At risk (33–66%)',  pct: atRiskPct   },
          { color: '#f87171', label: 'Critical (>66%)',   pct: criticalPct },
        ].map(({ color, label, pct }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <span>{label}</span>
            <span className="font-semibold text-gray-700">{pct}% of runs</span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

function WIPChart({ asIs }) {
  const data = (asIs.wipOverTime ?? []).map((p) => ({
    time: parseFloat(p.time.toFixed(2)),
    wip: parseFloat(p.wip.toFixed(2)),
  }))

  return (
    <ChartCard title="Concurrent work in progress — current approach">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'time', position: 'insideBottomRight', fontSize: 10, fill: '#cbd5e1', dx: -4 }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [
              typeof v === 'number' ? v.toFixed(1) : v,
              name === 'wip' ? 'AS-IS concurrent tasks' : name,
            ]}
          />
          <Legend
            formatter={(v) => (
              <span style={{ color: '#64748b', fontSize: 12 }}>
                {v === 'wip' ? 'AS-IS concurrent tasks' : v}
              </span>
            )}
          />
          <ReferenceLine
            y={1}
            stroke={C_CCPM}
            strokeDasharray="5 3"
            strokeWidth={2}
            label={{ value: 'CCPM target (WIP = 1 per resource)', position: 'insideTopRight', fontSize: 10, fill: '#34d399' }}
          />
          <Line
            type="monotone"
            dataKey="wip"
            name="wip"
            stroke={C_ASIS}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function TaskTable({ tasks, resources }) {
  const resourceMap = Object.fromEntries(resources.map((r) => [r.id, r.name]))

  const rows = tasks.map((t) => {
    const asIsDur  = Math.max(Number(t.duration) || 0, 0)
    const ccpmDur  = parseFloat((asIsDur * 0.6).toFixed(2))
    const saving   = parseFloat((asIsDur * 0.4).toFixed(2))
    return { ...t, asIsDur, ccpmDur, saving }
  })

  const totAsIs  = rows.reduce((s, r) => s + r.asIsDur, 0)
  const totCcpm  = rows.reduce((s, r) => s + r.ccpmDur, 0)
  const totSave  = rows.reduce((s, r) => s + r.saving, 0)
  const pctImprv = totAsIs > 0 ? ((totSave / totAsIs) * 100).toFixed(0) : 0

  const Th = ({ children, right }) => (
    <th className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
  const Td = ({ children, right, bold, green, muted }) => (
    <td className={`px-4 py-3 text-sm whitespace-nowrap ${right ? 'text-right' : ''} ${bold ? 'font-semibold' : ''} ${green ? 'text-emerald-600 font-semibold' : ''} ${muted ? 'text-gray-400' : 'text-gray-700'}`}>
      {children}
    </td>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-3">
        <p className="text-sm font-semibold text-gray-500">
          Task-level duration comparison — padded estimate vs CCPM aggressive estimate
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <Th>Task</Th>
              <Th>Resource</Th>
              <Th>Chain</Th>
              <Th right>AS-IS duration</Th>
              <Th right>CCPM duration</Th>
              <Th right>Saving</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
              >
                <Td bold>{r.name || `Task ${i + 1}`}</Td>
                <Td muted>{resourceMap[r.resourceId] || '—'}</Td>
                <Td>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    r.chainType === 'Critical Chain'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-orange-50 text-orange-600'
                  }`}>
                    {r.chainType}
                  </span>
                </Td>
                <Td right>{fmt(r.asIsDur)}</Td>
                <Td right>{fmt(r.ccpmDur)}</Td>
                <Td right green>−{fmt(r.saving)}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 text-white">
              <td colSpan={3} className="px-4 py-3 text-sm font-bold">
                Total — {pctImprv}% improvement
              </td>
              <td className="px-4 py-3 text-sm font-bold text-right">{fmt(totAsIs)}</td>
              <td className="px-4 py-3 text-sm font-bold text-right">{fmt(totCcpm)}</td>
              <td className="px-4 py-3 text-sm font-bold text-right text-emerald-400">−{fmt(totSave)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNavigate }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="text-5xl mb-4">📊</div>
      <h2 className="text-xl font-bold text-gray-700">No simulation results yet</h2>
      <p className="text-gray-400 mt-2 max-w-sm">
        Complete the Project Setup and Behaviour Config, then run the simulation to generate this report.
      </p>
      <button
        onClick={() => onNavigate('run-simulation')}
        className="mt-6 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go to Run Simulation →
      </button>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Report({ onNavigate }) {
  const projectName     = useProjectStore((s) => s.projectName)
  const tasks           = useProjectStore((s) => s.tasks)
  const resources       = useProjectStore((s) => s.resources)
  const simulationResults = useProjectStore((s) => s.simulationResults)
  const getSnapshot     = useProjectStore((s) => s.getSnapshot)

  const timeUnit = simulationResults?.timeUnit ?? 'Weeks'
  const unit     = timeUnit.toLowerCase()

  const handleExport = async () => {
    if (window.api?.saveProject) await window.api.saveProject(getSnapshot())
  }

  if (!simulationResults) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-8 py-4 border-b border-gray-100 shrink-0">
          <h1 className="text-xl font-bold text-gray-800">Report</h1>
        </div>
        <EmptyState onNavigate={onNavigate} />
      </div>
    )
  }

  const { asIs, ccpm } = simulationResults
  const delta = asIs.p50 - ccpm.p50
  const deltaFmt = fmt(Math.abs(delta))
  const headline =
    delta > 0
      ? `With CCPM, this project finishes ${deltaFmt} ${unit} earlier`
      : `CCPM and the current approach produce similar finish times`

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Report</h1>
          {projectName && (
            <p className="text-xs text-gray-400 mt-0.5">{projectName}</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Home
          </button>
          <button
            onClick={() => onNavigate('run-simulation')}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Re-run
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-semibold text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Export Report ↓
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto bg-gray-50 px-8 py-8 space-y-10">

        {/* ── Section 1: Executive Summary ──────────────────────────────── */}
        <section>
          <SectionTitle>Executive Summary</SectionTitle>

          {/* Headline */}
          <h2 className="text-3xl font-extrabold text-gray-900 leading-tight mb-6">
            {headline}
          </h2>

          {/* 4 stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label={`Current — 50% likely finish`}
              value={asIs.p50}
              unit={timeUnit}
            />
            <StatCard
              label={`Current — 80% likely finish`}
              value={asIs.p80}
              unit={timeUnit}
            />
            <StatCard
              label={`With CCPM — 50% likely finish`}
              value={ccpm.p50}
              unit={timeUnit}
              highlight
            />
            <StatCard
              label={`With CCPM — 80% likely finish`}
              value={ccpm.p80}
              unit={timeUnit}
              highlight
            />
          </div>

          {/* Narrative */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 mb-6">
            <Narrative asIs={asIs} ccpm={ccpm} timeUnit={timeUnit} />
          </div>

          {/* Distribution chart */}
          <DistributionChart asIs={asIs} ccpm={ccpm} timeUnit={timeUnit} />
        </section>

        {/* ── Section 2: PM Detail ───────────────────────────────────────── */}
        <section>
          <SectionTitle>Project Manager Detail</SectionTitle>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <BufferDistributionChart ccpm={ccpm} />
            <WIPChart asIs={asIs} />
          </div>

          <TaskTable tasks={tasks} resources={resources} />
        </section>

      </div>
    </div>
  )
}
