// src/extractors/extractFromXLSX.js
import XLSX from 'xlsx';

/**
 * Extract contact/payment info and store list from the XLSX file.
 */
export function extractFromXLSX(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  // ── Sheet 1: key-value info ──────────────────────────────────────────────────
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const data = {};
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const label = String(row[0] || '').trim().toLowerCase();
    const value = String(row[1] || '').trim();
    if (!value) continue;

    if (label === 'email') data.email = value;
    else if (label === 'phone') {
      data.dien_thoai = value.replace(/\D/g, '').replace(/^(\d{9})$/, '0$1');
    }
    else if (label === 'stk thanh toán' || label.includes('stk')) {
      const match = value.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        data.ngan_hang = match[1].trim();
        data.so_tai_khoan = match[2].trim();
      } else {
        data.so_tai_khoan = value;
      }
    }
    else if (label === 'email đối soát' || label.includes('đối soát')) {
      data.email_doi_soat = value;
    }
  }

  // ── Sheet 2: store list ──────────────────────────────────────────────────────
  // Columns: STT(0), Store ID(1), CỬA HÀNG(2), GIỜ MỞ CỬA(3), ĐỊA CHỈ(4)
  const sheet2 = wb.Sheets[wb.SheetNames[1]];
  if (sheet2) {
    const rows2 = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: '' });
    data.stores = [];
    for (const row of rows2) {
      const stt = row[0];
      if (!stt || isNaN(Number(stt))) continue;
      const ten = String(row[2] || '').trim();
      const diaChi = String(row[4] || '').trim();
      if (!ten) continue;
      data.stores.push({ stt: Number(stt), ten, dia_chi: diaChi });
    }
  }

  return data;
}
