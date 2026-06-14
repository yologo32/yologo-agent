// src/messageParser.js
// Phân tích tin nhắn từ Zalo group để extract tone và câu hỏi

import { config } from './config.js';

/**
 * Kết quả parse từ tin nhắn
 * @typedef {Object} ParseResult
 * @property {boolean} isMentioned     - Bot có bị mention không
 * @property {string}  tone            - Tone keyword ('genz' | 'cb' | 'kkk' | 'mama' | 'serious')
 * @property {string}  question        - Câu hỏi sau khi đã strip mention và tone tag
 * @property {string}  senderName      - Tên người gửi
 * @property {string}  senderId        - UID người gửi
 */

/**
 * Parse tin nhắn từ group để xác định:
 * 1. Bot có bị mention không
 * 2. Tone keyword là gì (nếu có)
 * 3. Câu hỏi thực sự là gì
 *
 * @param {Object} message      - Message object từ zca-js
 * @param {string} botUserId    - UID của tài khoản bot
 * @returns {ParseResult}
 */
export function parseGroupMessage(message, botUserId) {
  const data = message.data;

  // Lấy content - có thể là string hoặc object (nếu có attachment)
  const rawContent = typeof data.content === 'string'
    ? data.content
    : data.content?.msg || '';

  // Lấy danh sách mentions từ message
  // zca-js cung cấp mentions dưới dạng array của { uid, len, pos, ... }
  const mentions = data.mentions || data.content?.mentions || [];

  // Lấy thông tin người gửi
  const senderName = data.dName || data.uidFrom?.toString() || 'Bạn';
  const senderId = data.uidFrom?.toString() || '';

  // ─────────────────────────────────────────────
  // Kiểm tra bot có bị mention không
  // ─────────────────────────────────────────────
  const isMentioned = mentions.some(
    (m) => m.uid?.toString() === botUserId?.toString()
  );

  if (!isMentioned) {
    return {
      isMentioned: false,
      tone: config.tones.DEFAULT,
      question: rawContent.trim(),
      senderName,
      senderId,
    };
  }

  // ─────────────────────────────────────────────
  // Strip phần @mention khỏi content
  // Zalo thường format mention như "@TênBot " trong text
  // ─────────────────────────────────────────────
  let cleanedContent = rawContent;

  // Xóa tất cả các @mention (dựa trên position và length trong mentions array)
  // Sắp xếp theo position giảm dần để xóa từ cuối lên (tránh shift index)
  const sortedMentions = [...mentions].sort((a, b) => b.pos - a.pos);
  for (const m of sortedMentions) {
    if (typeof m.pos === 'number' && typeof m.len === 'number') {
      cleanedContent =
        cleanedContent.slice(0, m.pos) + cleanedContent.slice(m.pos + m.len);
    }
  }

  // Fallback: nếu vẫn còn @TênBot trong text thì xóa bằng regex
  cleanedContent = cleanedContent
    .replace(/@[\w\sÀ-ỹ]+/g, '') // Xóa @mention patterns
    .trim();

  // ─────────────────────────────────────────────
  // Detect tone keyword: [genz], [cb], [kkk], [mama], [serious]
  // Format: [keyword] ở đầu message (sau khi đã strip mention)
  // ─────────────────────────────────────────────
  const supportedTones = config.tones.SUPPORTED;
  const toneRegex = new RegExp(
    `^\\s*\\[(${supportedTones.join('|')})\\]\\s*`,
    'i'
  );

  let tone = config.tones.DEFAULT;
  const toneMatch = cleanedContent.match(toneRegex);

  if (toneMatch) {
    tone = toneMatch[1].toLowerCase();
    // Xóa tone tag khỏi content
    cleanedContent = cleanedContent.replace(toneRegex, '').trim();
  }

  // ─────────────────────────────────────────────
  // Câu hỏi cuối cùng sau khi đã clean
  // ─────────────────────────────────────────────
  const question = cleanedContent.trim();

  return {
    isMentioned: true,
    tone,
    question,
    senderName,
    senderId,
  };
}

/**
 * Kiểm tra câu hỏi có hợp lệ không (không rỗng)
 * @param {string} question
 * @returns {boolean}
 */
export function isValidQuestion(question) {
  return typeof question === 'string' && question.trim().length > 0;
}

/**
 * Phát hiện implicit trigger (yêu cầu tóm tắt không cần gọi bot)
 * @param {string} text
 * @returns {boolean}
 */
export function isSummaryTrigger(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  const keywords = [
    'tối cổ',
    'có biến gì',
    'chuyện gì vạy',
    'chuyện gì vậy',
    'kể nghe với',
    'vụ gì v',
    'tóm tắt',
    'nói cái gì mà dài vậy',
    'nói cái gì mà dài v',
    'ai rảnh tóm tắt không',
    'ai rảnh tóm tắt',
    'mn đang nói gì',
    'mọi người đang nói gì',
    'tóm lại là',
    'hóng'
  ];

  return keywords.some(kw => lower.includes(kw));
}
