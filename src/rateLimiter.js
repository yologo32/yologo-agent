// src/rateLimiter.js
// Rate limiter đơn giản để tránh bot spam quá nhiều

import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Rate limiter dạng sliding window per user
 * Theo dõi số lần bot đã reply cho từng user trong 1 phút
 */
class RateLimiter {
  constructor() {
    // Map<userId, number[]> - lưu timestamps của các request
    this.requests = new Map();
    this.limitPerMinute = config.bot.rateLimitPerMinute;
    this.windowMs = 60 * 1000; // 1 phút
  }

  /**
   * Kiểm tra xem user có bị rate limit không
   * @param {string} userId
   * @returns {boolean} true = được phép, false = bị giới hạn
   */
  isAllowed(userId) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Lấy hoặc tạo mảng timestamps cho user này
    const timestamps = this.requests.get(userId) || [];

    // Lọc bỏ timestamps cũ hơn 1 phút
    const recentTimestamps = timestamps.filter((t) => t > windowStart);

    if (recentTimestamps.length >= this.limitPerMinute) {
      logger.warn(`Rate limit: User ${userId} đã vượt quá ${this.limitPerMinute} request/phút`);
      return false;
    }

    // Thêm timestamp hiện tại và lưu lại
    recentTimestamps.push(now);
    this.requests.set(userId, recentTimestamps);
    return true;
  }

  /**
   * Lấy thời gian chờ còn lại (ms) trước khi user có thể dùng lại
   * @param {string} userId
   * @returns {number} milliseconds
   */
  getRetryAfter(userId) {
    const timestamps = this.requests.get(userId) || [];
    if (timestamps.length === 0) return 0;

    const windowStart = Date.now() - this.windowMs;
    const recentTimestamps = timestamps.filter((t) => t > windowStart);

    if (recentTimestamps.length < this.limitPerMinute) return 0;

    // Thời gian đến khi oldest timestamp hết hạn
    const oldestInWindow = Math.min(...recentTimestamps);
    return Math.max(0, oldestInWindow + this.windowMs - Date.now());
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
