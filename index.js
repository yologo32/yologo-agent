// index.js
// Entry point - khởi động Zalo AI Bot

import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import { startBot } from './src/bot.js';
import { logger } from './src/logger.js';

const VERSION = fs.readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim();

// ─────────────────────────────────────────────
// Health check server (port 8080)
// ─────────────────────────────────────────────
http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(8080, () => {
  logger.info('Health check server listening on :8080/health');
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
