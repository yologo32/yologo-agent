// src/bot.js
// Logic chính của bot: đăng nhập Zalo, lắng nghe & xử lý tin nhắn

import { ThreadType } from 'zca-js';
import { smartLogin } from './sessionManager.js';
import { parseGroupMessage, isValidQuestion, isSummaryTrigger } from './messageParser.js';
import * as memory from './memory.js';
import { generateReply, generateSummary } from './ai.js';
import { rateLimiter } from './rateLimiter.js';
import { getTonePrompt } from './tones.js';
import { logger } from './logger.js';
import { config } from './config.js';

/**
 * Tin nhắn hướng dẫn khi bot bị tag nhưng không có câu hỏi
 */
const HELP_MESSAGE = `🎯 Tao là "AI Giao Tiếp Đỉnh Cao" — chuyên địch mọi câu nói thô thành 4 phiên bản giao tiếp xịt của nhau.

Cách dùng:
  @Bot [nội dung thô của mày]

Ví dụ:
  @Bot sếp ơi hom nay đau bụng xin nghỉ nha
  @Bot nhắn khách hàng bảo từ chối khéo
  @Bot nhắn bạn bảo mượn tiền

Bot sẽ tự nhận đối tượng từ ngữ cảnh và output đủ 4 phiên bản:
  👔 Chuyên nghiệp • 🧠 Khéo léo • ⚡ Ngắn gọn • 🎭 Hài hước

Muốn override tone riêng? Thêm [tone] vào đầu:
  [genz] [cb] [kkk] [mama] [serious]`;


/**
 * Khởi động Zalo Bot
 * @returns {Promise<void>}
 */
export async function startBot() {
  logger.bot('Đang khởi động Zalo AI Bot...');
  logger.info(`Model AI: ${config.ai.model}`);
  logger.info(`Bot name: ${config.bot.name}`);
  logger.info(`Rate limit: ${config.bot.rateLimitPerMinute} request/phút/user`);

  // ─────────────────────────────────────────────
  // Đăng nhập Zalo (smart: tự dùng session đã lưu hoặc QR nếu hết hạn)
  // ─────────────────────────────────────────────
  let api;
  try {
    api = await smartLogin();
  } catch (loginError) {
    logger.error('Đăng nhập thất bại:', loginError);
    process.exit(1);
  }

  // ─────────────────────────────────────────────
  // Lấy thông tin tài khoản bot
  // ─────────────────────────────────────────────
  let botUserId = null;

  try {
    const ownId = api.getOwnId?.();
    botUserId = ownId?.toString();
    logger.success(`Bot UID: ${botUserId}`);
  } catch {
    logger.warn('Không lấy được UID bot, sẽ fallback sang kiểm tra tên');
  }

  // ─────────────────────────────────────────────
  // Khởi động listener
  // ─────────────────────────────────────────────
  logger.bot('Đang lắng nghe tin nhắn trong các group...');
  logger.info('─'.repeat(50));

  api.listener.on('message', async (message) => {
    // Chỉ xử lý tin nhắn từ GROUP
    if (message.type !== ThreadType.Group) return;

    // Chỉ xử lý tin nhắn dạng text
    const isTextMessage =
      typeof message.data?.content === 'string' ||
      typeof message.data?.content?.msg === 'string';

    if (!isTextMessage) return;

    // ─────────────────────────────────────────────
    // Parse tin nhắn
    // ─────────────────────────────────────────────
    const parsed = parseGroupMessage(message, botUserId);
    const { tone, question, senderName, senderId, isMentioned } = parsed;
    const groupId = message.threadId;

    // ─────────────────────────────────────────────
    // LƯU TIN NHẮN VÀO TRÍ NHỚ (Bỏ qua tin nhắn của chính bot)
    // Lưu rawContent thực sự thay vì question đã bị strip
    // ─────────────────────────────────────────────
    if (senderId !== botUserId && senderId) {
      // Lấy nội dung thô trước khi strip mention
      const rawText = typeof message.data?.content === 'string'
        ? message.data.content
        : message.data?.content?.msg || '';
      if (rawText.trim()) {
        memory.addMessage(groupId, senderName || senderId, rawText.trim());
      }
    }

    // ─────────────────────────────────────────────
    // KIỂM TRA TRIGGER TÓM TẮT (Bà Hàng Xóm Mode)
    // ─────────────────────────────────────────────
    // ─────────────────────────────────────────────
    // KIỂM TRA TRIGGER TÓM TẮT (Chế độ DUY NHẤT hiện tại)
    // ─────────────────────────────────────────────
    // Tính năng chat bình thường đã bị tắt. 
    // Giờ hễ cứ tag @Bot HOẶC dùng từ khóa ngầm định là sẽ gọi tóm tắt
    const isImplicitSummary = !isMentioned && isSummaryTrigger(question);

    if (isMentioned || isImplicitSummary) {
      logger.info(`🚨 Yêu cầu tóm tắt từ ${senderName} — đang có ${memory.getHistory(groupId).length} tin trong bộ nhớ`);
      const history = memory.getHistory(groupId);
      
      if (history.length < 2) {
        // Không đủ tin nhắn để tóm tắt
        if (isMentioned) {
          api.sendMessage({ msg: `@${senderName} Group vắng tanh vắng ngắt không biến gì hết má!`, mentions: [{uid: senderId, pos: 0, len: senderName.length + 1}] }, groupId, ThreadType.Group);
        }
        return;
      }

      // Kiểm tra rate limit chống spam tóm tắt liên tục
      if (!rateLimiter.isAllowed(senderId)) {
        const retryAfterSec = Math.ceil(rateLimiter.getRetryAfter(senderId) / 1000);
        try {
          await api.sendMessage(
            {
              msg: `⏳ ${senderName} ơi, hóng biến từ từ thôi. Thử lại sau ${retryAfterSec} giây nhé!`,
              mentions: senderId ? [{ uid: senderId, pos: 3, len: senderName.length }] : [],
            },
            groupId,
            ThreadType.Group
          );
        } catch (err) {}
        return;
      }

      try {
        const summaryText = await generateSummary(history);
        const mentionText = `@${senderName}`;
        await api.sendMessage(
          {
            msg: `${mentionText} 📢 GÓC TÓM TẮT:\n\n${summaryText}`,
            mentions: [{ uid: senderId, pos: 0, len: mentionText.length }]
          },
          groupId,
          ThreadType.Group
        );
      } catch (err) {
        logger.error('Lỗi khi tóm tắt:', err);
      }
      return;
    }


  });

  // ─────────────────────────────────────────────
  // Xử lý lỗi kết nối
  // ─────────────────────────────────────────────
  api.listener.on('error', (err) => {
    logger.error('Listener error:', err);
  });

  api.listener.on('close', () => {
    logger.warn('Kết nối Zalo bị đóng. Đang thử kết nối lại...');
    // zca-js tự động reconnect trong một số trường hợp
  });

  // Bắt đầu lắng nghe
  api.listener.start();
}
