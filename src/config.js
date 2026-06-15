// src/config.js
// Cấu hình tập trung cho toàn bộ bot

import 'dotenv/config';

export const config = {
  // VNG Cloud AI API
  ai: {
    baseURL: 'https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1',
    apiKey: process.env.AI_PLATFORM_API_KEY,
    model: 'google/gemma-4-31b-it',
    maxTokens: 2000,
    temperature: 0.9,
    topP: 0.7,
    presencePenalty: 0,
  },

  // Bot settings
  bot: {
    name: process.env.BOT_NAME || 'Bot',
    // Danh sách Zalo UID của owner (cách nhau bằng dấu phẩy)
    // Chỉ owner mới nhận được DM hướng dẫn khi tag bot không kèm câu hỏi
    ownerIds: (process.env.BOT_OWNER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    // Giới hạn số request mỗi phút để tránh spam
    rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '10', 10),
  },

  // Contract /hd feature
  contract: {
    allowedIds: (process.env.CONTRACT_IDS || '')
      .split(',').map(id => id.trim()).filter(Boolean),
  },

  // Danh sách tone keyword được hỗ trợ
  tones: {
    DEFAULT: 'auto',
    SUPPORTED: ['genz', 'cb', 'kkk', 'mama', 'serious', 'auto'],
  },
};

// Validate API key
if (!config.ai.apiKey || config.ai.apiKey === 'your_vng_cloud_api_key_here') {
  console.error('❌ Lỗi: Chưa cấu hình AI_PLATFORM_API_KEY trong file .env');
  process.exit(1);
}
