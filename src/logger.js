// src/logger.js
// Logger đơn giản với màu sắc

import chalk from 'chalk';

const timestamp = () => {
  return new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const logger = {
  info: (msg) => console.log(chalk.cyan(`[${timestamp()}] ℹ️  ${msg}`)),
  success: (msg) => console.log(chalk.green(`[${timestamp()}] ✅ ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`[${timestamp()}] ⚠️  ${msg}`)),
  error: (msg, err) => {
    console.error(chalk.red(`[${timestamp()}] ❌ ${msg}`));
    if (err) console.error(chalk.red(err?.stack || err));
  },
  bot: (msg) => console.log(chalk.magenta(`[${timestamp()}] 🤖 ${msg}`)),
  message: (from, group, tone) =>
    console.log(
      chalk.blue(`[${timestamp()}] 💬 Mention từ [${from}] trong group [${group}] | Tone: ${chalk.bold(tone)}`)
    ),
};
