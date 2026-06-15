// src/extractors/extractFromCCCD.js
import OpenAI from 'openai';
import { config } from '../config.js';

const client = new OpenAI({
  baseURL: config.ai.baseURL,
  apiKey: config.ai.apiKey,
});

const CCCD_PROMPT = `Đây là ảnh Căn cước công dân (CCCD) / Chứng minh nhân dân (CMND) Việt Nam.
Hãy trích xuất thông tin và trả về JSON với các trường sau (bỏ qua trường nào không đọc được):
{
  "ho_ten": "Họ và tên đầy đủ",
  "so_cccd": "Số CCCD/CMND",
  "ngay_sinh": "Ngày sinh (DD/MM/YYYY)",
  "que_quan": "Quê quán",
  "thuong_tru": "Nơi thường trú"
}
Chỉ trả về JSON, không giải thích thêm.`;

/**
 * Extract info from CCCD image buffer.
 * @param {Buffer} imageBuffer
 * @param {string} mimeType - e.g. 'image/jpeg'
 */
export async function extractFromCCCD(imageBuffer, mimeType = 'image/jpeg') {
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await client.chat.completions.create({
    model: config.ai.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: CCCD_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.1,
  });

  const text = response.choices[0]?.message?.content || '';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return {};
  }
}
