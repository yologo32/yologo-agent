// src/ai.js
// Module gọi VNG Cloud AI API để sinh câu trả lời

import OpenAI from 'openai';
import { config } from './config.js';
import { getTonePrompt } from './tones.js';

// Khởi tạo OpenAI client trỏ đến VNG Cloud endpoint
const client = new OpenAI({
  baseURL: config.ai.baseURL,
  apiKey: config.ai.apiKey,
});

/**
 * Sinh câu trả lời từ AI theo tone cụ thể
 *
 * @param {string} question - Câu hỏi của user
 * @param {string} toneKey  - Keyword tone: 'genz' | 'cb' | 'kkk' | 'mama' | 'serious'
 * @param {string} [senderName] - Tên người hỏi (để cá nhân hóa câu trả lời)
 * @returns {Promise<string>} - Câu trả lời hoàn chỉnh
 */
export async function generateReply(question, toneKey, senderName = '') {
  const tone = getTonePrompt(toneKey);

  // Thêm context về người hỏi nếu có tên
  const userContext = senderName
    ? `Người đang hỏi tên là ${senderName}.`
    : '';

  const userMessage = userContext
    ? `${userContext}\n\nCâu hỏi: ${question}`
    : question;

  let fullResponse = '';

  try {
    const stream = await client.chat.completions.create({
      model: config.ai.model,
      messages: [
        {
          role: 'system',
          content: tone.systemPrompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
      top_p: config.ai.topP,
      presence_penalty: config.ai.presencePenalty,
      stream: true,
    });

    // Thu thập streaming response
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
      }
    }

    return fullResponse.trim();
  } catch (error) {
    // Xử lý lỗi API
    if (error?.status === 401) {
      throw new Error('API key không hợp lệ. Kiểm tra lại AI_PLATFORM_API_KEY trong .env');
    } else if (error?.status === 429) {
      throw new Error('Quá nhiều request. Vui lòng thử lại sau.');
    } else if (error?.status === 503) {
      throw new Error('AI service đang bận. Thử lại sau ít phút.');
    }
    throw new Error(`Lỗi AI API: ${error.message}`);
  }
}

/**
 * Sinh tóm tắt lịch sử chat (Bà hàng xóm mode)
 *
 * @param {Array<{sender: string, text: string, time: number}>} history
 * @returns {Promise<string>}
 */
export async function generateSummary(history) {
  const systemPrompt = `Mày là đứa xà lơ chuyên tóm tắt chuyện dùm người khác. Trả lời ĐÚNG 1-2 câu, không hơn. Không chào hỏi, không giải thích, không liệt kê — chỉ nói ngay tình hình hiện tại là đang đến đâu rồi. Văn phong lóng, tự nhiên, cà khịa nhẹ. Bằng tiếng Việt.`;

  // Chỉ lấy 20 tin nhắn gần nhất để focus vào tình hình HIỆN TẠI
  const recentHistory = history.slice(-20);
  const chatText = recentHistory.map(msg => `${msg.sender}: ${msg.text}`).join('\n');
  const userMessage = `Chat gần nhất:\n\n${chatText}\n\nĐang tình hình gì vậy?`;

  let fullResponse = '';

  try {
    const stream = await client.chat.completions.create({
      model: config.ai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1000,
      temperature: 0.9,
      top_p: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
      }
    }

    return fullResponse.trim();
  } catch (error) {
    throw new Error(`Lỗi AI khi tóm tắt: ${error.message}`);
  }
}
