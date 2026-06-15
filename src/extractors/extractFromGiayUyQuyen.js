// src/extractors/extractFromGiayUyQuyen.js
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

const GUQ_PROMPT = `Đây là ảnh trang 1 của Giấy ủy quyền Việt Nam.
Hãy tìm:
1. Số giấy ủy quyền: thường ở góc trên bên TRÁI, dạng "Số: ..." hoặc "Số/No: ..." hoặc chỉ là một số/mã
2. Ngày ký: thường ở góc trên bên PHẢI hoặc cuối trang, dạng "ngày ... tháng ... năm ..." hoặc "date: ..."

Trả về JSON:
{
  "so_uy_quyen": "số giấy ủy quyền (chỉ lấy phần số/mã, bỏ chữ 'Số:' hoặc 'No:')",
  "ngay_ky": "ngày ký theo định dạng DD/MM/YYYY hoặc nguyên văn như trong tài liệu"
}
Nếu không tìm thấy thông tin nào, trả về null cho trường đó.
Chỉ trả về JSON, không giải thích thêm.`;

/**
 * Extract authorization number and signing date from Giấy ủy quyền PDF.
 * Only reads page 1.
 * @param {Buffer} pdfBuffer
 * @returns {{ so_uy_quyen: string|null, ngay_ky: string|null }}
 */
export async function extractFromGiayUyQuyen(pdfBuffer) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'guq-'));
  const pdfPath = path.join(tmpDir, 'guq.pdf');
  const imgPrefix = path.join(tmpDir, 'page');

  try {
    await fs.writeFile(pdfPath, pdfBuffer);

    // Convert only page 1 to JPEG
    await execAsync(`pdftoppm -jpeg -r 150 -f 1 -l 1 "${pdfPath}" "${imgPrefix}"`);

    const files = await fs.readdir(tmpDir);
    const imgFiles = files.filter(f => f.startsWith('page-') && f.endsWith('.jpg')).sort();

    if (imgFiles.length === 0) {
      throw new Error('No image generated from PDF');
    }

    const imgBuffer = await fs.readFile(path.join(tmpDir, imgFiles[0]));
    const base64 = imgBuffer.toString('base64');

    const response = await client.chat.completions.create({
      model: config.ai.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: GUQ_PROMPT },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + base64 } },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
    });

    const text = response.choices[0]?.message?.content || '';
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { so_uy_quyen: null, ngay_ky: null };
    } catch {
      return { so_uy_quyen: null, ngay_ky: null };
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
