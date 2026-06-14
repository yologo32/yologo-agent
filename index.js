// index.js
// Entry point - khởi động Zalo AI Bot

import 'dotenv/config';
import { startBot } from './src/bot.js';
import { logger } from './src/logger.js';

// ─────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════╗
║           🤖  ZALO AI BOT  🤖               ║
║        Powered by VNG Cloud AI               ║
║   Model: google/gemma-4-31b-it               ║
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
