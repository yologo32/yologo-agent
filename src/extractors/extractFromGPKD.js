// src/extractors/extractFromGPKD.js
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';
import { config } from '../config.js';

const execAsync = promisify(exec);
const client = new OpenAI({
  baseURL: config.ai.baseURL,
  apiKey: config.ai.apiKey,
});

const GPKD_PROMPT = `Đây là ảnh Giấy phép kinh doanh (GPKD) hoặc Giấy chứng nhận đăng ký hộ kinh doanh / doanh nghiệp Việt Nam.
Hãy trích xuất các thông tin sau và trả về JSON:
{
  "ten_cong_ty": "Tên doanh nghiệp / hộ kinh doanh đầy đủ (trường 'Tên doanh nghiệp' hoặc 'Tên hộ kinh doanh')",
  "ma_so_thue": "Chỉ lấy phần chữ số trong trường 'Mã số doanh nghiệp' hoặc 'Mã số thuế' (bỏ dấu gạch ngang)",
  "dia_chi": "Địa chỉ trụ sở chính đầy đủ (trường 'Địa chỉ trụ sở chính' hoặc 'Địa chỉ')",
  "nguoi_dai_dien": "Họ và tên đầy đủ người đại diện pháp luật (trường 'Họ và tên' hoặc 'Người đại diện theo pháp luật')",
  "chuc_vu": "Chức danh / chức vụ (trường 'Chức danh' hoặc 'Chức vụ')",
  "dien_thoai": "Số điện thoại liên lạc (trường 'Điện thoại' hoặc 'Tel', null nếu không có)"
}
Chỉ trả về JSON, không giải thích thêm.`;

/**
 * Convert PDF to images and extract GPKD info.
 * @param {Buffer} pdfBuffer
 */
export async function extractFromGPKD(pdfBuffer) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gpkd-'));
  const pdfPath = path.join(tmpDir, 'gpkd.pdf');
  const imgPrefix = path.join(tmpDir, 'page');

  try {
    await fs.writeFile(pdfPath, pdfBuffer);

    // Convert only page 1 to JPEG (faster)
    await execAsync(`pdftoppm -jpeg -r 150 -f 1 -l 1 "${pdfPath}" "${imgPrefix}"`);

    // Read generated images
    const files = await fs.readdir(tmpDir);
    const imgFiles = files
      .filter(f => f.startsWith('page-') && f.endsWith('.jpg'))
      .sort()
      .slice(0, 3);

    if (imgFiles.length === 0) {
      throw new Error('No images generated from PDF');
    }

    // Use first page for extraction
    const imgBuffer = await fs.readFile(path.join(tmpDir, imgFiles[0]));
    const base64 = imgBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    const response = await client.chat.completions.create({
      model: config.ai.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: GPKD_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 600,
      temperature: 0.1,
    });

    const text = response.choices[0]?.message?.content || '';
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      return {};
    }
  } finally {
    // Cleanup temp files
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
