/**
 * CCPM Simulation Engine
 * Pure JS — no UI dependencies.
 * Export: runSimulation(inputs) => { asIs, ccpm }
 */

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Uniform random in [a, b] */
function rand(a, b) {
  return a + Math.random() * (b - a)
}

/** Clamp x into [lo, hi] */
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x))
}

/**
 * Kahn's topological sort.
 * Returns ordered task id array or throws on cycle.
 */
function topoSort(tasks) {
  const inDeg = {}
  const adj = {}
  for (const t of tasks) {
    inDeg[t.id] = inDeg[t.id] ?? 0
    adj[t.id] = adj[t.id] ?? []
    for (const dep of (t.dependencies ?? [])) {
      adj[dep] = adj[dep] ?? []
      adj[dep].push(t.id)
      inDeg[t.id] = (inDeg[t.id] ?? 0) + 1
    }
  }
  const queue = tasks.filter((t) => inDeg[t.id] === 0).map((t) => t.id)
  const order = []
  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    for (const nxt of (adj[id] ?? [])) {
      inDeg[nxt]--
      if (inDeg[nxt] === 0) queue.push(nxt)
    }
  }
  if (order.length !== tasks.length) {
    throw new Error('Circular dependency detected in task graph')
  }
  return order
}

/**
 * p-th percentile (0–100) of a numeric array.
 * Uses linear interpolation.
 */
function percentile(arr, p) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/**
 * Averages an array-of-arrays of {time, value} samples into evenly-spaced
 * buckets for charting. Buckets are integer time steps from 0 to maxTime.
 */
function averageTimeSeries(seriesArr, valueKey) {
  if (!seriesArr.length) return []
  const maxTime = Math.ceil(Math.max(...seriesArr.flat().map((p) => p.time)))
  if (!isFinite(maxTime) || maxTime <= 0) return []
  // Build per-bucket sums
  const sums = new Float64Array(maxTime + 1)
  const counts = new Uint32Array(maxTime + 1)
  for (const series of seriesArr) {
    // Forward-fill the value across time buckets
    let lastVal = 0
    let si = 0
    const sorted = [...series].sort((a, b) => a.time - b.time)
    for (let t = 0; t <= maxTime; t++) {
      while (si < sorted.length && sorted[si].time <= t) {
        lastVal = sorted[si][valueKey]
        si++
      }
      sums[t] += lastVal
      counts[t]++
    }
  }
  const result = []
  for (let t = 0; t <= maxTime; t++) {
    result.push({ time: t, value: counts[t] ? sums[t] / counts[t] : 0 })
  }
  return result
}

// ─── Dependency / float helpers ───────────────────────────────────────────────

/**
 * Forward pass: compute earliest-start and earliest-finish for each task
 * given only dependency constraints (no resource contention).
 * Returns Map<taskId, { es, ef }>
 */
function dependencyForwardPass(taskMap, order, getDuration) {
  const ef = new Map() // task id → earliest finish
  const es = new Map() // task id → earliest start
  for (const id of order) {
    const t = taskMap.get(id)
    const depFinish = (t.dependencies ?? []).reduce(
      (mx, d) => Math.max(mx, ef.get(d) ?? 0),
      0
    )
    es.set(id, depFinish)
    ef.set(id, depFinish + getDuration(id))
  }
  return { es, ef }
}

// ─── AS-IS scheduler ──────────────────────────────────────────────────────────

/**
 * Run one AS-IS iteration.
 * Returns { finishTime, wipSamples: [{time, wip}] }
 */
function runAsIsIteration(tasks, taskMap, order, cfg) {
  const {
    studentSyndrome, studentDelayPct,
    parkinsonsLaw, earlyFinishPassThroughPct,
    multitasking, maxConcurrent,
    switchingCosts, switchingCostPct,
  } = cfg

  // Base durations = estimatedDuration (padded safe estimates)
  const baseDur = new Map(tasks.map((t) => [t.id, t.estimatedDuration]))

  // Dependency-only earliest finish (used to compute available float)
  const { es: depES, ef: depEF } = dependencyForwardPass(taskMap, order, (id) => baseDur.get(id))

  // Simulation state
  const actualStart = new Map()   // id → actual start time
  const actualFinish = new Map()  // id → actual finish time
  const resourceActive = new Map() // resourceId → sorted list of {start, finish, taskId}

  const wipSamples = []

  /** Count tasks active at time t for a resource */
  function concurrentAt(resourceId, t) {
    return (resourceActive.get(resourceId) ?? []).filter(
      (e) => e.start <= t && e.finish > t
    ).length
  }

  for (const id of order) {
    const t = taskMap.get(id)
    const resourceId = t.resourceId ?? null

    // 1. Earliest start from dependencies
    const depReady = (t.dependencies ?? []).reduce(
      (mx, d) => Math.max(mx, actualFinish.get(d) ?? 0),
      0
    )

    // 2. Resource availability: when does this resource next have a free slot?
    let resourceReady = depReady
    if (resourceId) {
      const slots = resourceActive.get(resourceId) ?? []
      if (multitasking) {
        // Queue if already at maxConcurrent at depReady time
        // Find earliest time when concurrent count < maxConcurrent
        let candidate = depReady
        // Collect all finish times at or after depReady
        const finishPoints = [...new Set(
          slots.filter((e) => e.finish > candidate).map((e) => e.finish)
        )].sort((a, b) => a - b)
        for (const fp of [candidate, ...finishPoints]) {
          if (concurrentAt(resourceId, fp) < maxConcurrent) {
            candidate = fp
            break
          }
          candidate = fp
        }
        resourceReady = Math.max(depReady, candidate)
      } else {
        // Serial: wait for all prior tasks on this resource to finish
        const lastFinish = slots.reduce((mx, e) => Math.max(mx, e.finish), 0)
        resourceReady = Math.max(depReady, lastFinish)
      }
    }

    // 3. Available float — two sources combined:
    //    a) Internal padding: the safety embedded in the padded estimate (~40% of duration).
    //       This is the primary CCPM float — the worker knows the task has slack built in
    //       and delays starting until near the "deadline".
    //    b) External scheduling slack: gap between dep-finish and resource-ready time
    //       (resource was busy longer than deps needed).
    //    Together they represent all the time a worker could waste before the task is "due".
    const internalFloat = baseDur.get(id) * 0.4
    const externalFloat = Math.max(0, resourceReady - depES.get(id))
    const availableFloat = internalFloat + externalFloat

    // 4. Student syndrome: delay start by consuming available float
    let startTime = resourceReady
    if (studentSyndrome) {
      const variance = rand(0.8, 1.2)
      const consumed = clamp((studentDelayPct / 100) * variance, 0, 1) * availableFloat
      startTime = resourceReady + consumed
    }

    // 5. Effective duration accounting for switching costs
    let effectiveDur = baseDur.get(id)
    if (resourceId && multitasking && switchingCosts) {
      const concurrent = concurrentAt(resourceId, startTime)
      if (concurrent > 0) {
        effectiveDur = effectiveDur * Math.pow(1 + switchingCostPct / 100, concurrent)
      }
    }

    // 6. Natural finish
    let naturalFinish = startTime + effectiveDur

    // 7. Parkinson's Law: suppress early finishes
    const scheduledFinish = resourceReady + effectiveDur
    if (parkinsonsLaw && naturalFinish < scheduledFinish) {
      const passThrough = Math.random() < earlyFinishPassThroughPct / 100
      if (!passThrough) {
        naturalFinish = scheduledFinish
      }
    }

    actualStart.set(id, startTime)
    actualFinish.set(id, naturalFinish)

    if (resourceId) {
      const slots = resourceActive.get(resourceId) ?? []
      slots.push({ start: startTime, finish: naturalFinish, taskId: id })
      resourceActive.set(resourceId, slots)
    }

    // WIP sample at start and finish
    wipSamples.push({ time: startTime, taskId: id, delta: +1 })
    wipSamples.push({ time: naturalFinish, taskId: id, delta: -1 })
  }

  // Build WIP-over-time from delta events
  const wipOverTime = buildWipTimeSeries(wipSamples)

  const finishTime = Math.max(...actualFinish.values())
  return { finishTime, wipOverTime }
}

function buildWipTimeSeries(samples) {
  const events = [...samples].sort((a, b) => a.time - b.time || b.delta - a.delta)
  const result = []
  let wip = 0
  for (const e of events) {
    wip = Math.max(0, wip + e.delta)
    result.push({ time: e.time, wip })
  }
  return result
}

// ─── Critical chain finder ────────────────────────────────────────────────────

/**
 * Find the critical chain: the longest resource-constrained path.
 * Uses iterated forward passes until no resource conflicts.
 * Returns array of task ids in critical chain order.
 */
function findCriticalChain(tasks, taskMap, order, getDuration) {
  // Start with dependency-only forward pass
  const { ef } = dependencyForwardPass(taskMap, order, getDuration)

  // Resolve resource conflicts greedily: for each resource, sort tasks by
  // dependency-earliest-finish and schedule them serially
  const resourceQueues = new Map()
  for (const id of order) {
    const t = taskMap.get(id)
    if (!t.resourceId) continue
    const q = resourceQueues.get(t.resourceId) ?? []
    q.push(id)
    resourceQueues.set(t.resourceId, q)
  }

  // Adjusted earliest finish after resource serialisation
  const adjEF = new Map(ef)
  const adjES = new Map()
  for (const id of order) {
    const t = taskMap.get(id)
    const depReady = (t.dependencies ?? []).reduce((mx, d) => Math.max(mx, adjEF.get(d) ?? 0), 0)
    adjES.set(id, depReady)
  }

  // Resolve per-resource in order of dependency readiness
  for (const [, q] of resourceQueues) {
    q.sort((a, b) => (adjES.get(a) ?? 0) - (adjES.get(b) ?? 0))
    let resourceTime = 0
    for (const id of q) {
      const t = taskMap.get(id)
      const depReady = (t.dependencies ?? []).reduce((mx, d) => Math.max(mx, adjEF.get(d) ?? 0), 0)
      const start = Math.max(depReady, resourceTime)
      adjES.set(id, start)
      adjEF.set(id, start + getDuration(id))
      resourceTime = adjEF.get(id)
    }
  }

  // Critical chain = trace back from the task with the latest finish
  const lastTaskId = order.reduce(
    (mx, id) => ((adjEF.get(id) ?? 0) > (adjEF.get(mx) ?? 0) ? id : mx),
    order[0]
  )

  // Trace predecessor path
  function predecessors(id) {
    const t = taskMap.get(id)
    if (!t) return []
    const deps = t.dependencies ?? []
    if (!deps.length) return [id]
    // Follow the dependency with the latest adjusted EF
    const critDep = deps.reduce(
      (mx, d) => ((adjEF.get(d) ?? 0) > (adjEF.get(mx) ?? 0) ? d : mx),
      deps[0]
    )
    return [...predecessors(critDep), id]
  }

  return predecessors(lastTaskId)
}

// ─── CCPM scheduler ───────────────────────────────────────────────────────────

/**
 * Run one CCPM iteration.
 * Returns { finishTime, criticalChainDuration, projectBufferSize, bufferTrace }
 */
function runCcpmIteration(tasks, taskMap, order, cfg) {
  // 1. Strip safety: aggressive duration with ±10% random variance
  const aggrDur = new Map(
    tasks.map((t) => [t.id, t.estimatedDuration * 0.6 * rand(0.9, 1.1)])
  )

  // 2. Identify critical chain
  const ccIds = new Set(findCriticalChain(tasks, taskMap, order, (id) => aggrDur.get(id)))

  // 3. Compute buffers
  const criticalChainDuration = [...ccIds].reduce((s, id) => s + aggrDur.get(id), 0)
  const projectBufferSize = 0.5 * criticalChainDuration

  // Feeding chains: tasks marked 'feeding' (or not on CC) grouped by their
  // merge point into the CC
  const feedingBuffers = new Map() // merge task id → buffer size
  for (const t of tasks) {
    if (!ccIds.has(t.id)) {
      // Find which CC task this feeds into
      const mergeId = (t.dependencies ?? []).find((d) => ccIds.has(d))
        ?? tasks.find((cc) => ccIds.has(cc.id) && (cc.dependencies ?? []).includes(t.id))?.id
      if (mergeId) {
        const existing = feedingBuffers.get(mergeId) ?? 0
        feedingBuffers.set(mergeId, existing + 0.5 * aggrDur.get(t.id))
      }
    }
  }

  // 4. Schedule with CC priority and relay runner
  const actualStart = new Map()
  const actualFinish = new Map()
  const resourceLastFinish = new Map() // for CC tasks: strict serial per resource

  // Process in topo order, CC tasks first within each "ready" wave
  const ccOrder = order.filter((id) => ccIds.has(id))
  const nonCcOrder = order.filter((id) => !ccIds.has(id))
  const scheduleOrder = [...ccOrder, ...nonCcOrder]

  // We need to re-sort respecting dependencies while giving CC priority
  // Simple approach: process in topo order; CC tasks use WIP=1 per resource
  for (const id of order) {
    const t = taskMap.get(id)
    const isCC = ccIds.has(id)
    const resourceId = t.resourceId ?? null

    // Earliest start from deps (relay runner: actual finish used immediately)
    const depReady = (t.dependencies ?? []).reduce(
      (mx, d) => Math.max(mx, actualFinish.get(d) ?? 0),
      0
    )

    // Resource contention
    let resourceReady = depReady
    if (resourceId) {
      if (isCC) {
        // WIP=1: wait for this resource's last CC task to finish
        const lastCC = resourceLastFinish.get(`cc:${resourceId}`) ?? 0
        resourceReady = Math.max(depReady, lastCC)
      } else {
        // Non-CC tasks: simple serial per resource (don't block CC)
        const lastAny = resourceLastFinish.get(resourceId) ?? 0
        resourceReady = Math.max(depReady, lastAny)
      }
    }

    const startTime = resourceReady
    const finishTime = startTime + aggrDur.get(id)

    actualStart.set(id, startTime)
    actualFinish.set(id, finishTime)

    if (resourceId) {
      if (isCC) {
        resourceLastFinish.set(`cc:${resourceId}`, finishTime)
      }
      const prev = resourceLastFinish.get(resourceId) ?? 0
      resourceLastFinish.set(resourceId, Math.max(prev, finishTime))
    }
  }

  // 5. Project finish and buffer consumption trace
  const ccFinishTimes = [...ccIds].map((id) => actualFinish.get(id) ?? 0)
  const plannedCCEnd = criticalChainDuration // baseline without any delay
  const actualCCEnd = Math.max(...ccFinishTimes)
  const projectEnd = actualCCEnd + projectBufferSize

  // Buffer consumption: how much of the project buffer was consumed
  // Trace at each CC task completion
  const bufferTrace = []
  const sortedCCFinish = [...ccIds]
    .map((id) => ({ id, finish: actualFinish.get(id) ?? 0 }))
    .sort((a, b) => a.finish - b.finish)

  let expectedEnd = 0
  const ccList = order.filter((id) => ccIds.has(id))
  for (let i = 0; i < ccList.length; i++) {
    expectedEnd += aggrDur.get(ccList[i])
    const actual = actualFinish.get(ccList[i]) ?? 0
    const slip = Math.max(0, actual - expectedEnd)
    const pct = projectBufferSize > 0 ? clamp((slip / projectBufferSize) * 100, 0, 100) : 0
    bufferTrace.push({ time: actual, pct })
  }
  // Final point
  const finalSlip = Math.max(0, actualCCEnd - criticalChainDuration)
  const finalPct = projectBufferSize > 0
    ? clamp((finalSlip / projectBufferSize) * 100, 0, 100) : 0
  bufferTrace.push({ time: actualCCEnd, pct: finalPct })

  const finishTime = actualCCEnd  // report CC end; buffer absorbs overrun
  return { finishTime, criticalChainDuration, projectBufferSize, bufferTrace }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Run AS-IS and CCPM Monte Carlo simulations.
 *
 * @param {object} inputs
 * @param {Array}  inputs.tasks
 * @param {Array}  inputs.resources
 * @param {string} inputs.timeUnit  — metadata only
 * @param {object} inputs.behaviourConfig
 * @param {number} inputs.iterations
 * @returns {{ asIs, ccpm }}
 */
export function runSimulation({ tasks, resources, behaviourConfig, iterations = 500 }) {
  if (!tasks || tasks.length === 0) throw new Error('No tasks provided')

  // Normalise behaviour config with safe defaults
  const cfg = {
    studentSyndrome:          behaviourConfig?.studentSyndrome          ?? false,
    studentDelayPct:          behaviourConfig?.studentDelayPct          ?? 60,
    parkinsonsLaw:            behaviourConfig?.parkinsonsLaw            ?? false,
    earlyFinishPassThroughPct: behaviourConfig?.earlyFinishPassThroughPct ?? 10,
    multitasking:             behaviourConfig?.multitasking             ?? false,
    maxConcurrent:            behaviourConfig?.maxConcurrent            ?? 3,
    switchingCosts:           behaviourConfig?.switchingCosts           ?? false,
    switchingCostPct:         behaviourConfig?.switchingCostPct         ?? 20,
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  let order
  try {
    order = topoSort(tasks)
  } catch (e) {
    throw new Error(`Task scheduling error: ${e.message}`)
  }

  // Compute total estimated duration on the dependency-critical path
  const { ef: baseEF } = dependencyForwardPass(
    taskMap, order, (id) => taskMap.get(id).estimatedDuration
  )
  const baselineProjectDuration = Math.max(...baseEF.values())

  // ── AS-IS Monte Carlo ──
  const asIsFinishTimes = []
  const asIsWipSeries = []

  for (let i = 0; i < iterations; i++) {
    const { finishTime, wipOverTime } = runAsIsIteration(tasks, taskMap, order, cfg)
    asIsFinishTimes.push(finishTime)
    asIsWipSeries.push(wipOverTime)
  }

  const asIsAvgFinish = asIsFinishTimes.reduce((s, v) => s + v, 0) / asIsFinishTimes.length
  const avgSlippage = baselineProjectDuration > 0
    ? ((asIsAvgFinish / baselineProjectDuration) - 1) * 100
    : 0

  const wipOverTime = averageTimeSeries(
    asIsWipSeries.map((s) => s.map((p) => ({ time: p.time, value: p.wip }))),
    'value'
  ).map(({ time, value }) => ({ time, wip: value }))

  // ── CCPM Monte Carlo ──
  const ccpmFinishTimes = []
  const ccpmBufferSeries = []
  let lastCriticalChainDuration = 0
  let lastProjectBufferSize = 0

  for (let i = 0; i < iterations; i++) {
    const { finishTime, criticalChainDuration, projectBufferSize, bufferTrace } =
      runCcpmIteration(tasks, taskMap, order, cfg)
    ccpmFinishTimes.push(finishTime)
    ccpmBufferSeries.push(bufferTrace.map((p) => ({ time: p.time, value: p.pct })))
    lastCriticalChainDuration = criticalChainDuration
    lastProjectBufferSize = projectBufferSize
  }

  const bufferConsumption = averageTimeSeries(ccpmBufferSeries, 'value')
    .map(({ time, value }) => ({ time, pct: value }))

  return {
    asIs: {
      finishTimes: asIsFinishTimes,
      p50: percentile(asIsFinishTimes, 50),
      p80: percentile(asIsFinishTimes, 80),
      p95: percentile(asIsFinishTimes, 95),
      avgSlippage,
      wipOverTime,
    },
    ccpm: {
      finishTimes: ccpmFinishTimes,
      p50: percentile(ccpmFinishTimes, 50),
      p80: percentile(ccpmFinishTimes, 80),
      p95: percentile(ccpmFinishTimes, 95),
      criticalChainDuration: lastCriticalChainDuration,
      projectBufferSize: lastProjectBufferSize,
      bufferConsumption,
    },
  }
}
