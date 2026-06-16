// src/dashboard.js
// Renders the metrics dashboard HTML page

function fmt(ms) {
  if (ms === 0) return '—';
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function bar(ratio, width = 12) {
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function renderDashboard(stats, version) {
  const ai = stats.ai;
  const ct = stats.contract;
  const sm = stats.summary;

  const successRate = ai.total > 0 ? ((ai.total - ai.errors) / ai.total * 100).toFixed(1) : '100.0';
  const contractRate = ct.started > 0 ? (ct.completed / ct.started * 100).toFixed(0) : '—';
  const summaryRate  = sm.triggered > 0 ? (sm.completed / sm.triggered * 100).toFixed(0) : '—';

  const groupRows = Object.entries(stats.groups)
    .sort(([,a],[,b]) => (b.messages + b.summaries + b.contracts) - (a.messages + a.summaries + a.contracts))
    .slice(0, 10)
    .map(([id, g]) => `
      <tr>
        <td class="mono small">${id.slice(-8)}</td>
        <td>${g.messages}</td>
        <td>${g.summaries}</td>
        <td>${g.contracts}</td>
      </tr>`).join('');

  const eventRows = stats.recentEvents.map(e => {
    const ago = Math.round((Date.now() - e.time) / 1000);
    const agoStr = ago < 60 ? `${ago}s ago` : `${Math.floor(ago/60)}m ago`;
    return `<tr><td>${e.icon}</td><td class="mono small">${agoStr}</td><td class="small">${e.detail}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="15">
<title>Yô lô gơ Bot — Metrics</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; padding: 24px; }
  h1 { font-size: 1.4rem; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
  .sub { font-size: 0.8rem; color: #64748b; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .card { background: #1e2130; border: 1px solid #2d3348; border-radius: 12px; padding: 20px; }
  .card-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 12px; }
  .big { font-size: 2.2rem; font-weight: 700; line-height: 1; }
  .green  { color: #4ade80; }
  .yellow { color: #facc15; }
  .red    { color: #f87171; }
  .blue   { color: #60a5fa; }
  .purple { color: #c084fc; }
  .muted  { color: #64748b; font-size: 0.8rem; margin-top: 4px; }
  .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #2d3348; font-size: 0.85rem; }
  .stat-row:last-child { border-bottom: none; }
  .stat-val { font-weight: 600; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th { text-align: left; padding: 6px 10px; color: #64748b; font-size: 0.7rem; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #2d3348; }
  td { padding: 7px 10px; border-bottom: 1px solid #1a1f2e; }
  tr:last-child td { border-bottom: none; }
  .mono { font-family: monospace; }
  .small { font-size: 0.78rem; }
  .wide { grid-column: 1 / -1; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
  .pill-green  { background: #052e16; color: #4ade80; }
  .pill-yellow { background: #1c1206; color: #facc15; }
  .pill-red    { background: #1c0606; color: #f87171; }
  .refresh-bar { text-align: right; font-size: 0.72rem; color: #475569; margin-bottom: 8px; }
</style>
</head>
<body>

<h1>🤖 Yô lô gơ Bot — Metrics</h1>
<p class="sub">v${version} &nbsp;·&nbsp; Uptime: <strong>${fmtUptime(stats.uptime)}</strong> &nbsp;·&nbsp; Auto-refresh: 15s</p>

<div class="grid">

  <!-- AI Overview -->
  <div class="card">
    <div class="card-title">AI Calls</div>
    <div class="big blue">${ai.total}</div>
    <div class="muted">total requests</div>
    <div style="margin-top:14px">
      <div class="stat-row"><span>Success rate</span><span class="stat-val green">${successRate}%</span></div>
      <div class="stat-row"><span>Errors</span><span class="stat-val ${ai.errors > 0 ? 'red' : 'green'}">${ai.errors}</span></div>
    </div>
  </div>

  <!-- AI Latency -->
  <div class="card">
    <div class="card-title">AI Latency</div>
    <div class="big yellow">${fmt(ai.avg)}</div>
    <div class="muted">avg end-to-end</div>
    <div style="margin-top:14px">
      <div class="stat-row"><span>p50</span><span class="stat-val">${fmt(ai.p50)}</span></div>
      <div class="stat-row"><span>p95</span><span class="stat-val yellow">${fmt(ai.p95)}</span></div>
      <div class="stat-row"><span>p99</span><span class="stat-val red">${fmt(ai.p99)}</span></div>
    </div>
  </div>

  <!-- Contract /hd -->
  <div class="card">
    <div class="card-title">Contract /hd</div>
    <div class="big purple">${ct.started}</div>
    <div class="muted">sessions started</div>
    <div style="margin-top:14px">
      <div class="stat-row"><span>Completed</span><span class="stat-val green">${ct.completed}</span></div>
      <div class="stat-row"><span>Failed</span><span class="stat-val ${ct.failed > 0 ? 'red' : 'green'}">${ct.failed}</span></div>
      <div class="stat-row"><span>Success rate</span><span class="stat-val">${contractRate}%</span></div>
      <div class="stat-row"><span>Avg latency</span><span class="stat-val">${fmt(ct.avg)}</span></div>
      <div class="stat-row"><span>p95 latency</span><span class="stat-val yellow">${fmt(ct.p95)}</span></div>
    </div>
  </div>

  <!-- Summary -->
  <div class="card">
    <div class="card-title">Summary Requests</div>
    <div class="big green">${sm.triggered}</div>
    <div class="muted">total triggered</div>
    <div style="margin-top:14px">
      <div class="stat-row"><span>Completed</span><span class="stat-val green">${sm.completed}</span></div>
      <div class="stat-row"><span>Failed</span><span class="stat-val ${sm.failed > 0 ? 'red' : 'green'}">${sm.failed}</span></div>
      <div class="stat-row"><span>Success rate</span><span class="stat-val">${summaryRate}%</span></div>
      <div class="stat-row"><span>Avg latency</span><span class="stat-val">${fmt(sm.avg)}</span></div>
      <div class="stat-row"><span>p95 latency</span><span class="stat-val yellow">${fmt(sm.p95)}</span></div>
    </div>
  </div>

  <!-- Rate limit -->
  <div class="card">
    <div class="card-title">Rate Limits</div>
    <div class="big ${stats.rateLimitHits > 0 ? 'yellow' : 'green'}">${stats.rateLimitHits}</div>
    <div class="muted">hits since startup</div>
  </div>

  <!-- AI by type -->
  <div class="card">
    <div class="card-title">AI Calls by Type</div>
    <table>
      <tr><th>Type</th><th>Count</th><th>Avg</th><th>p95</th></tr>
      ${Object.entries(ai.byType).map(([t, v]) => `
      <tr>
        <td>${t}</td>
        <td>${v.count}</td>
        <td>${fmt(v.avg)}</td>
        <td class="yellow">${fmt(v.p95)}</td>
      </tr>`).join('')}
    </table>
  </div>

  <!-- Groups -->
  <div class="card wide">
    <div class="card-title">Groups (top 10 by activity)</div>
    <table>
      <tr><th>Group ID (last 8)</th><th>Messages</th><th>Summaries</th><th>Contracts</th></tr>
      ${groupRows || '<tr><td colspan="4" style="color:#475569;padding:12px">No activity yet</td></tr>'}
    </table>
  </div>

  <!-- Recent events -->
  <div class="card wide">
    <div class="card-title">Recent Events (last 30)</div>
    <table>
      <tr><th></th><th>When</th><th>Detail</th></tr>
      ${eventRows || '<tr><td colspan="3" style="color:#475569;padding:12px">No events yet</td></tr>'}
    </table>
  </div>

</div>

<div class="refresh-bar">Next refresh in 15s &nbsp;·&nbsp; <a href="/metrics" style="color:#475569">JSON</a></div>

</body>
</html>`;
}
