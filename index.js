// index.js
// Entry point - khởi động Zalo AI Bot

import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import { startBot } from './src/bot.js';
import { logger } from './src/logger.js';
import { getStats } from './src/metrics.js';
import { renderDashboard } from './src/dashboard.js';

const VERSION = fs.readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim();

// ─────────────────────────────────────────────
// Health check + Metrics dashboard (port 8080)
// ─────────────────────────────────────────────
http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: VERSION, uptime: process.uptime() }));
  } else if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getStats(), null, 2));
  } else if (req.url === '/' || req.url === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderDashboard(getStats(), VERSION));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(8080, () => {
  logger.info('Dashboard: http://localhost:8080  |  /health  |  /metrics');
});

// ─────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════╗
║           🤖  ZALO AI BOT  🤖               ║
║        Powered by VNG Cloud AI               ║
║   Model: google/gemma-4-31b-it               ║
║   Version: v${VERSION.padEnd(31)}║
╠══════════════════════════════════════════════╣
║  Tones: [genz] [cb] [kkk] [mama] [serious]  ║
║  Mặc định: [genz] nếu không ghi tone        ║
╚══════════════════════════════════════════════╝
`);

// ─────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────
process.on('SIGINT', () => {
  logger.bot('Bot đang tắt... Goodbye! 👋');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.bot('Bot đang tắt... Goodbye! 👋');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

// ─────────────────────────────────────────────
// Khởi động bot
// ─────────────────────────────────────────────
startBot().catch((err) => {
  logger.error('Không thể khởi động bot:', err);
  process.exit(1);
});
