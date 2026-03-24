/**
 * Simple node test for simulate.js
 * Run: node --input-type=module < src/engine/simulate.test.js
 * or:  node src/engine/simulate.test.js  (if package.json has "type":"module")
 */

import { runSimulation } from './simulate.js'

// ─── Test project ─────────────────────────────────────────────────────────────
//
//  A(R1,4) ──┐
//  B(R2,3) ──┼── D(R1,5) ── E(R2,2)   ← critical chain
//  C(R2,2) ──┘
//
// C is a feeding chain task feeding into D
// Estimated durations are padded safe estimates

const tasks = [
  { id: 'A', name: 'Design',    resourceId: 'R1', estimatedDuration: 4, dependencies: [],          chain: 'critical' },
  { id: 'B', name: 'Planning',  resourceId: 'R2', estimatedDuration: 3, dependencies: [],          chain: 'critical' },
  { id: 'C', name: 'Research',  resourceId: 'R2', estimatedDuration: 2, dependencies: [],          chain: 'feeding'  },
  { id: 'D', name: 'Build',     resourceId: 'R1', estimatedDuration: 5, dependencies: ['A','B','C'], chain: 'critical' },
  { id: 'E', name: 'Deploy',    resourceId: 'R2', estimatedDuration: 2, dependencies: ['D'],        chain: 'critical' },
]

const resources = [
  { id: 'R1', name: 'Alice' },
  { id: 'R2', name: 'Bob'   },
]

const behaviourConfig = {
  studentSyndrome:           true,  studentDelayPct:           60,
  parkinsonsLaw:             true,  earlyFinishPassThroughPct: 10,
  multitasking:              true,  maxConcurrent:              3,
  switchingCosts:            true,  switchingCostPct:          20,
}

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log('Running simulation (500 iterations)…\n')

let result
try {
  result = runSimulation({ tasks, resources, behaviourConfig, iterations: 500 })
} catch (err) {
  console.error('SIMULATION ERROR:', err.message)
  process.exit(1)
}

const { asIs, ccpm } = result

// ─── Print summary ────────────────────────────────────────────────────────────

const row = (label, val) =>
  console.log(`  ${label.padEnd(40)} ${String(val).padStart(12)}`)

console.log('══════════════════════════════════════════════════════════')
console.log('  AS-IS (dysfunctional behaviours ON)')
console.log('──────────────────────────────────────────────────────────')
row('P50 finish time',    asIs.p50.toFixed(2))
row('P80 finish time',    asIs.p80.toFixed(2))
row('P95 finish time',    asIs.p95.toFixed(2))
row('Avg slippage vs baseline', asIs.avgSlippage.toFixed(1) + '%')
row('Finish times count', asIs.finishTimes.length)
row('WIP series points',  asIs.wipOverTime.length)

console.log()
console.log('══════════════════════════════════════════════════════════')
console.log('  CCPM (future state)')
console.log('──────────────────────────────────────────────────────────')
row('P50 finish time',        ccpm.p50.toFixed(2))
row('P80 finish time',        ccpm.p80.toFixed(2))
row('P95 finish time',        ccpm.p95.toFixed(2))
row('Critical chain duration', ccpm.criticalChainDuration.toFixed(2))
row('Project buffer size',     ccpm.projectBufferSize.toFixed(2))
row('Buffer final pcts count',   ccpm.bufferFinalPcts.length)
row('Finish times count',      ccpm.finishTimes.length)

// ─── Assertions ───────────────────────────────────────────────────────────────

console.log()
console.log('══════════════════════════════════════════════════════════')
console.log('  Assertions')
console.log('──────────────────────────────────────────────────────────')

let passed = 0
let failed = 0

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓  ${label}`)
    passed++
  } else {
    console.log(`  ✗  FAIL: ${label}`)
    failed++
  }
}

assert('AS-IS produces 500 finish times',     asIs.finishTimes.length === 500)
assert('CCPM produces 500 finish times',      ccpm.finishTimes.length === 500)
assert('CCPM p50 < AS-IS p50 (CCPM faster)', ccpm.p50 < asIs.p50)
assert('CCPM p80 < AS-IS p80',               ccpm.p80 < asIs.p80)
assert('Project buffer > 0',                  ccpm.projectBufferSize > 0)
assert('Critical chain duration > 0',         ccpm.criticalChainDuration > 0)
assert('AS-IS p50 < p80 < p95 (ordered)',    asIs.p50 <= asIs.p80 && asIs.p80 <= asIs.p95)
assert('CCPM p50 < p80 < p95 (ordered)',     ccpm.p50 <= ccpm.p80 && ccpm.p80 <= ccpm.p95)
assert('No NaN in AS-IS finish times',        asIs.finishTimes.every((v) => !isNaN(v)))
assert('No NaN in CCPM finish times',         ccpm.finishTimes.every((v) => !isNaN(v)))
assert('AS-IS avg slippage > 0%',             asIs.avgSlippage > 0)
assert('Buffer final pcts non-empty',         ccpm.bufferFinalPcts.length > 0)
assert('Buffer final pcts all in 0–100',     ccpm.bufferFinalPcts.every((p) => p >= 0 && p <= 100))
assert('WIP series non-empty',                asIs.wipOverTime.length > 0)
assert('AS-IS p50 is finite',                 isFinite(asIs.p50))
assert('CCPM p50 is finite',                  isFinite(ccpm.p50))

console.log()
console.log(`  ${passed} passed, ${failed} failed`)
console.log('══════════════════════════════════════════════════════════')

if (failed > 0) process.exit(1)
