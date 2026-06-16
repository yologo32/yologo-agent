// src/metrics.js
// In-memory metrics store — no external dependencies

const startTime = Date.now();
const MAX_LATENCY_SAMPLES = 500; // cap to avoid unbounded memory
const MAX_EVENTS = 60;

// ── AI call latencies per type ─────────────────────────────────────────────
const aiLatencies = { summary: [], gpkd: [], cccd: [], giay_uy_quyen: [] };
let aiErrors = 0;
let aiTotal  = 0;

// ── Contract ───────────────────────────────────────────────────────────────
const contractStats    = { started: 0, completed: 0, failed: 0 };
const contractLatencies = [];

// ── Summary ────────────────────────────────────────────────────────────────
const summaryStats    = { triggered: 0, completed: 0, failed: 0 };
const summaryLatencies = [];

// ── Rate limit ─────────────────────────────────────────────────────────────
let rateLimitHits = 0;

// ── Per-group ──────────────────────────────────────────────────────────────
const groupStats = {}; // groupId → { messages, summaries, contracts, name }

// ── Recent event feed ──────────────────────────────────────────────────────
const recentEvents = [];

// ── Helpers ────────────────────────────────────────────────────────────────
function pushLatency(arr, val) {
  arr.push(val);
  if (arr.length > MAX_LATENCY_SAMPLES) arr.shift();
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p / 100) - 1)];
}

function avg(arr) {
  return arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
}

function addEvent(type, icon, detail) {
  recentEvents.unshift({ time: Date.now(), type, icon, detail });
  if (recentEvents.length > MAX_EVENTS) recentEvents.pop();
}

function ensureGroup(groupId) {
  if (!groupStats[groupId]) {
    groupStats[groupId] = { messages: 0, summaries: 0, contracts: 0 };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
export function recordMessage(groupId) {
  ensureGroup(groupId);
  groupStats[groupId].messages++;
}

export function recordAiCall(type, latencyMs, success = true) {
  aiTotal++;
  if (!success) aiErrors++;
  const bucket = aiLatencies[type];
  if (bucket) pushLatency(bucket, latencyMs);
  addEvent('ai', success ? '🤖' : '💥', `AI ${type} ${success ? 'ok' : 'err'} — ${latencyMs}ms`);
}

export function recordContractStart(groupId) {
  contractStats.started++;
  ensureGroup(groupId);
  groupStats[groupId].contracts++;
  addEvent('contract', '📝', `[/hd] started — group ${groupId}`);
}

export function recordContractEnd(latencyMs, success = true) {
  if (success) contractStats.completed++;
  else contractStats.failed++;
  pushLatency(contractLatencies, latencyMs);
  addEvent('contract', success ? '✅' : '❌', `[/hd] ${success ? 'done' : 'failed'} — ${latencyMs}ms`);
}

export function recordSummaryRequest(groupId) {
  summaryStats.triggered++;
  ensureGroup(groupId);
  groupStats[groupId].summaries++;
}

export function recordSummaryEnd(latencyMs, success = true) {
  if (success) summaryStats.completed++;
  else summaryStats.failed++;
  pushLatency(summaryLatencies, latencyMs);
  addEvent('summary', success ? '📋' : '❌', `summary ${success ? 'ok' : 'failed'} — ${latencyMs}ms`);
}

export function recordRateLimit(groupId) {
  rateLimitHits++;
  addEvent('rateLimit', '⏳', `rate limit hit — group ${groupId}`);
}

export function getStats() {
  const allAi = Object.values(aiLatencies).flat();
  return {
    uptime:  Date.now() - startTime,
    ai: {
      total:  aiTotal,
      errors: aiErrors,
      avg:    avg(allAi),
      p50:    pct(allAi, 50),
      p95:    pct(allAi, 95),
      p99:    pct(allAi, 99),
      byType: Object.fromEntries(
        Object.entries(aiLatencies).map(([k, v]) => [k, {
          count: v.length,
          avg:   avg(v),
          p50:   pct(v, 50),
          p95:   pct(v, 95),
        }])
      ),
    },
    contract: {
      ...contractStats,
      avg: avg(contractLatencies),
      p95: pct(contractLatencies, 95),
    },
    summary: {
      ...summaryStats,
      avg: avg(summaryLatencies),
      p95: pct(summaryLatencies, 95),
    },
    rateLimitHits,
    groups: groupStats,
    recentEvents: recentEvents.slice(0, 30),
  };
}
