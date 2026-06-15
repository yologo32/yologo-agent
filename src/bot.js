// src/bot.js
// Logic chính của bot: đăng nhập Zalo, lắng nghe & xử lý tin nhắn

import { ThreadType } from 'zca-js';
import { smartLogin } from './sessionManager.js';
import { parseGroupMessage, isSummaryTrigger } from './messageParser.js';
import * as memory from './memory.js';
import { generateSummary } from './ai.js';
import { rateLimiter } from './rateLimiter.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { isContractAuthorized } from './contractAuth.js';
import { startSession, addFileToSession, waitForSession, hasActiveSession, completeSession, REQUIRED_TYPES } from './contractSession.js';
import { handleContractFiles } from './contractHandler.js';

export async function startBot() {
  logger.bot('Đang khởi động Zalo AI Bot...');
  logger.info(`Model AI: ${config.ai.model}`);
  logger.info(`Bot name: ${config.bot.name}`);
  logger.info(`Rate limit: ${config.bot.rateLimitPerMinute} request/phút/user`);

  let api;
  try {
    api = await smartLogin();
  } catch (loginError) {
    logger.error('Đăng nhập thất bại:', loginError);
    process.exit(1);
  }

  let botUserId = null;
  try {
    const ownId = api.getOwnId?.();
    botUserId = ownId?.toString();
    logger.success(`Bot UID: ${botUserId}`);
  } catch {
    logger.warn('Không lấy được UID bot, sẽ fallback sang kiểm tra tên');
  }

  logger.bot('Đang lắng nghe tin nhắn trong các group...');
  logger.info('─'.repeat(50));

  // Notify owners on startup
  if (config.bot.ownerIds && config.bot.ownerIds.length > 0) {
    const { readFileSync } = await import('fs');
    const ver = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
    for (const ownerId of config.bot.ownerIds) {
      try {
        await api.sendMessage(
          { msg: 'Đã deploy thành công nha phú bà Nhi Nhi 🎉 (v' + ver + ')' },
          ownerId, ThreadType.User
        );
      } catch (e) {
        logger.warn('Không gửi được startup message cho owner ' + ownerId + ': ' + e.message);
      }
    }
  }

  api.listener.on('message', async (message) => {
    // Chỉ xử lý tin nhắn từ GROUP
    if (message.type !== ThreadType.Group) return;

    const content = message.data?.content;
    const senderId = message.data?.uidFrom?.toString() || '';
    const senderName = message.data?.dName || senderId;
    const groupId = message.threadId;

    // ─────────────────────────────────────────────
    // XỬ LÝ FILE ATTACHMENTS (cho /hd session)
    // ─────────────────────────────────────────────
    if (content && typeof content === 'object') {
      // File attachment or photo message
      const href = content.href || content.normalUrl || content.hdUrl
                || content.url || content.thumbUrl;
      const rawFname = content.fname || content.title || content.fileName || '';
      // Photos sent directly (not as file) have no fname → treat as image
      const fname = rawFname || (href ? 'photo.jpg' : '');

      logger.info(`[/hd] Attachment: fname=${fname} href=${href ? href.slice(0,60) : 'none'}`);

      if (href && fname && senderId && hasActiveSession(groupId, senderId)) {
        const added = addFileToSession(groupId, senderId, href, fname);
        if (added) {
          logger.info(`[/hd] File nhận được: ${fname} từ ${senderName}`);
        }
        return;
      }

      // Not an active session file — ignore attachment messages
      return;
    }

    // ─────────────────────────────────────────────
    // TIN NHẮN VĂN BẢN
    // ─────────────────────────────────────────────
    const rawText = typeof content === 'string' ? content : (content?.msg || '');
    if (!rawText.trim()) return;

    // Lưu vào memory
    if (senderId !== botUserId && senderId) {
      memory.addMessage(groupId, senderName || senderId, rawText.trim());
    }

    // ─────────────────────────────────────────────
    // LỆNH /hd — render hợp đồng
    // ─────────────────────────────────────────────
    if (rawText.trim().toLowerCase() === '/hd') {
      if (!isContractAuthorized(senderId)) {
        await api.sendMessage(
          { msg: `@${senderName} Bạn không có quyền dùng lệnh này.`,
            mentions: [{ uid: senderId, pos: 0, len: senderName.length + 1 }] },
          groupId, ThreadType.Group
        );
        return;
      }

      if (hasActiveSession(groupId, senderId)) {
        await api.sendMessage(
          { msg: `@${senderName} Đang có phiên /hd đang chờ file. Hãy gửi 4 file hoặc đợi 90 giây.`,
            mentions: [{ uid: senderId, pos: 0, len: senderName.length + 1 }] },
          groupId, ThreadType.Group
        );
        return;
      }

      const FILE_LABELS = {
        docx:          '📄 Hợp đồng (.docx)',
        xlsx:          '📊 Thông tin (.xlsx)',
        pdf:           '📜 GPKD (.pdf)',
        image:         '🪪 CCCD (ảnh) — tuỳ chọn',
        giay_uy_quyen: '📋 Giấy ủy quyền (.pdf) — tuỳ chọn',
      };

      function buildStatusMsg(files) {
        const received = new Set(files.map(f => f.type));
        const lines = REQUIRED_TYPES.map(t =>
          (received.has(t) ? '✅' : '⬜') + ' ' + FILE_LABELS[t]
        );
        if (received.has('image'))         lines.push('✅ ' + FILE_LABELS['image']);
        if (received.has('giay_uy_quyen')) lines.push('✅ ' + FILE_LABELS['giay_uy_quyen']);
        return lines.join('\n');
      }

      startSession(groupId, senderId, async (session) => {
        const received = new Set(session.files.map(f => f.type));
        const missingRequired = REQUIRED_TYPES.filter(t => !received.has(t));
        let statusLine;
        if (missingRequired.length > 0) {
          statusLine = 'Còn thiếu bắt buộc: ' + missingRequired.map(t => FILE_LABELS[t]).join(', ');
        } else if (!received.has('image')) {
          statusLine = 'Đã đủ file bắt buộc. Gõ /done để xử lý, hoặc gửi thêm CCCD.';
        } else {
          statusLine = 'Đã đủ file, đang xử lý...';
        }
        try {
          await api.sendMessage(
            { msg: '📋 @' + senderName + '\n' + buildStatusMsg(session.files) + '\n' + statusLine,
              mentions: [{ uid: senderId, pos: 3, len: senderName.length + 1 }] },
            groupId, ThreadType.Group
          );
        } catch {}
      });

      const initMsg = '📋 @' + senderName + ' Đã nhận lệnh /hd. Gửi file trong vòng 90 giây:\n' +
        REQUIRED_TYPES.map(t => '⬜ ' + FILE_LABELS[t]).join('\n') + '\n' +
        '🔘 ' + FILE_LABELS['image'] + '\n' +
        '🔘 ' + FILE_LABELS['giay_uy_quyen'] + '\n' +
        '💡 Nếu không có CCCD, gõ /done sau khi gửi đủ 3 file bắt buộc.';
      await api.sendMessage(
        { msg: initMsg, mentions: [{ uid: senderId, pos: 3, len: senderName.length + 1 }] },
        groupId, ThreadType.Group
      );

      // Wait for files in background
      const promise = waitForSession(groupId, senderId);
      if (!promise) return;

      promise.then(async ({ timeout, files }) => {
        if (timeout) {
          const received = new Set(files.map(f => f.type));
          const missing = REQUIRED_TYPES.filter(t => !received.has(t));
          if (missing.length > 0) {
            const missingStr = missing.map(t => FILE_LABELS[t]).join(', ');
            await api.sendMessage(
              { msg: '⏰ @' + senderName + ' Hết thời gian 90 giây.\n' + buildStatusMsg(files) + '\nThiếu bắt buộc: ' + missingStr + '. Gõ /hd lại để thử lại.',
                mentions: [{ uid: senderId, pos: 3, len: senderName.length + 1 }] },
              groupId, ThreadType.Group
            );
          }
          return;
        }
        await handleContractFiles(files, groupId, senderName, senderId, api);
      });

      return;
    }

    // ─────────────────────────────────────────────
    // LỆNH /done — kết thúc phiên /hd không có CCCD
    // ─────────────────────────────────────────────
    if (rawText.trim().toLowerCase() === '/done') {
      if (!hasActiveSession(groupId, senderId)) {
        await api.sendMessage(
          { msg: '@' + senderName + ' Không có phiên /hd nào đang chờ.',
            mentions: [{ uid: senderId, pos: 0, len: senderName.length + 1 }] },
          groupId, ThreadType.Group
        );
        return;
      }

      const result = completeSession(groupId, senderId);
      if (result.status === 'missing') {
        const FILE_LABELS_LOCAL = { docx: '📄 Hợp đồng', xlsx: '📊 Thông tin', pdf: '📜 GPKD' };
        const missingStr = result.missing.map(t => FILE_LABELS_LOCAL[t] || t).join(', ');
        await api.sendMessage(
          { msg: '❌ @' + senderName + ' Chưa đủ file bắt buộc. Còn thiếu: ' + missingStr,
            mentions: [{ uid: senderId, pos: 3, len: senderName.length + 1 }] },
          groupId, ThreadType.Group
        );
        return;
      }
      // 'ok' → session resolved, promise.then() above will call handleContractFiles
      return;
    }

    // ─────────────────────────────────────────────
    // KIỂM TRA TRIGGER TÓM TẮT
    // ─────────────────────────────────────────────
    const parsed = parseGroupMessage(message, botUserId);
    const { isMentioned } = parsed;
    const isImplicitSummary = !isMentioned && isSummaryTrigger(rawText);

    if (isMentioned || isImplicitSummary) {
      logger.info(`🚨 Yêu cầu tóm tắt từ ${senderName} — đang có ${memory.getHistory(groupId).length} tin trong bộ nhớ`);
      const history = memory.getHistory(groupId);

      if (history.length < 2) {
        if (isMentioned) {
          api.sendMessage(
            { msg: `@${senderName} Group vắng tanh vắng ngắt không biến gì hết má!`,
              mentions: [{ uid: senderId, pos: 0, len: senderName.length + 1 }] },
            groupId, ThreadType.Group
          );
        }
        return;
      }

      if (!rateLimiter.isAllowed(senderId)) {
        const retryAfterSec = Math.ceil(rateLimiter.getRetryAfter(senderId) / 1000);
        try {
          await api.sendMessage(
            { msg: `⏳ ${senderName} ơi, hóng biến từ từ thôi. Thử lại sau ${retryAfterSec} giây nhé!`,
              mentions: senderId ? [{ uid: senderId, pos: 3, len: senderName.length }] : [] },
            groupId, ThreadType.Group
          );
        } catch {}
        return;
      }

      try {
        const summaryText = await generateSummary(history);
        const mentionText = `@${senderName}`;
        await api.sendMessage(
          { msg: `${mentionText} 📢 GÓC TÓM TẮT:\n\n${summaryText}`,
            mentions: [{ uid: senderId, pos: 0, len: mentionText.length }] },
          groupId, ThreadType.Group
        );
      } catch (err) {
        logger.error('Lỗi khi tóm tắt:', err);
      }
    }
  });

  api.listener.on('error', (err) => { logger.error('Listener error:', err); });
  api.listener.on('close', () => { logger.warn('Kết nối Zalo bị đóng. Đang thử kết nối lại...'); });
  api.listener.start();
}
