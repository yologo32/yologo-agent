// src/memory.js
// Lưu trữ lịch sử tin nhắn ngắn hạn trên RAM cho tính năng "Tóm tắt drama"

const history = {};
const MAX_MESSAGES = 100;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Thêm tin nhắn vào bộ nhớ của group
 * @param {string} groupId ID của group chat
 * @param {string} sender Tên người gửi
 * @param {string} text Nội dung tin nhắn
 */
export function addMessage(groupId, sender, text) {
  if (!groupId || !sender || !text) return;

  // Loại bỏ các tin nhắn quá ngắn hoặc không mang ý nghĩa
  if (text.length < 3) return;

  if (!history[groupId]) {
    history[groupId] = [];
  }

  history[groupId].push({
    sender,
    text,
    time: Date.now(),
  });

  // Giữ lại tối đa MAX_MESSAGES tin nhắn gần nhất
  if (history[groupId].length > MAX_MESSAGES) {
    history[groupId].shift();
  }
}

/**
 * Lấy lịch sử tin nhắn của group (đã dọn dẹp các tin nhắn quá hạn 24h)
 * @param {string} groupId ID của group chat
 * @returns {Array<{sender: string, text: string, time: number}>}
 */
export function getHistory(groupId) {
  if (!history[groupId]) return [];

  const now = Date.now();
  // Lọc bỏ tin nhắn cũ hơn 24h
  history[groupId] = history[groupId].filter((msg) => now - msg.time <= MAX_AGE_MS);

  return history[groupId];
}

/**
 * Xoá toàn bộ lịch sử của group (Dùng khi đã tóm tắt xong nếu muốn reset)
 */
export function clearHistory(groupId) {
  if (history[groupId]) {
    history[groupId] = [];
  }
}

// Chạy dọn rác định kỳ mỗi 1 giờ để giải phóng RAM
setInterval(() => {
  const now = Date.now();
  for (const groupId in history) {
    history[groupId] = history[groupId].filter((msg) => now - msg.time <= MAX_AGE_MS);
    if (history[groupId].length === 0) {
      delete history[groupId];
    }
  }
}, 60 * 60 * 1000);
