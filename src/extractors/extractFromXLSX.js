// src/extractors/extractFromXLSX.js
import XLSX from 'xlsx';

/**
 * Parse a contact person multiline cell value:
 * "- Ông/bà: Nguyễn Văn A\n- Chức vụ: Giám đốc\n- Email: x@y.com\n- Điện thoại: 0912..."
 * → { ten, cv, email, sdt }
 */
function parseContactCell(raw) {
  const result = {};
  const lines = (raw || '').split('\n');
  for (const line of lines) {
    const l = line.replace(/^[-•\s]+/, '').trim();
    const sep = l.indexOf(':');
    if (sep < 0) continue;
    const key = l.slice(0, sep).trim().toLowerCase();
    const val = l.slice(sep + 1).trim();
    if (!val) continue;
    if (key.includes('ông') || key.includes('bà') || key.includes('ba'))  result.ten = val;
    else if (key.includes('chức vụ') || key.includes('chuc vu'))           result.cv  = val;
    else if (key.includes('email'))                                          result.email = val;
    else if (key.includes('điện thoại') || key.includes('dien thoai') ||
             key.includes('mobile') || key.includes('phone'))               result.sdt = val;
  }
  return result;
}

/**
 * Parse STK cell — supports formats:
 *   "TÊN: NGUYEN VAN A - STK:123456789 NGÂN HÀNG VIETCOMBANK"
 *   "VCB: 1234567890"          (legacy simple format)
 *   "1234567890"               (STK only, no bank)
 */
function parseSTK(value) {
  // New format: TÊN: ... - STK:<num> NGÂN HÀNG <bank>
  const newFmt = value.match(/STK[:\s]*(\S+)\s+(?:NGÂN HÀNG|NH|BANK)\s+(.+)/i);
  if (newFmt) {
    return { so_tai_khoan: newFmt[1].trim(), ngan_hang: newFmt[2].trim() };
  }
  // STK without bank name: STK:12345
  const stkOnly = value.match(/STK[:\s]*(\S+)/i);
  if (stkOnly) {
    return { so_tai_khoan: stkOnly[1].trim(), ngan_hang: '' };
  }
  // Legacy "BankName: AccountNumber"
  const legacy = value.match(/^([^:]+):\s*(.+)$/);
  if (legacy) {
    return { ngan_hang: legacy[1].trim(), so_tai_khoan: legacy[2].trim() };
  }
  // Plain number
  return { so_tai_khoan: value.trim(), ngan_hang: '' };
}

/**
 * Parse ten_chu_tk from STK cell: "TÊN: NGUYEN VAN A - STK:..."
 */
function parseTenChuTK(value) {
  const m = value.match(/TÊN[:\s]+([^-\n]+)/i);
  return m ? m[1].trim() : '';
}

/**
 * Extract contact/payment info and store list from the XLSX file.
 */
export function extractFromXLSX(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  // ── Sheet 1: key-value info ──────────────────────────────────────────────────
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const data = {};
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const label = String(row[0] || '').trim();
    const value = String(row[1] || '').trim();
    if (!value) continue;
    const ll = label.toLowerCase();

    if (ll === 'email')                                data.email = value;
    else if (ll === 'phone')                           data.dien_thoai = value.replace(/\D/g, '').replace(/^(\d{9})$/, '0$1');
    // STK: only match rows explicitly about bank account (starts with "stk" or label is "stk thanh toán")
    else if (ll.startsWith('stk') || ll === 'stk thanh toán') {
      const stk = parseSTK(value);
      Object.assign(data, stk);
      const ten = parseTenChuTK(value);
      if (ten) data.ten_chu_tai_khoan = ten;
    }
    else if (ll.includes('website') || ll.includes('ứng dụng')) data.website = value;

    // Contact person roles — checked BEFORE generic "đối soát" label
    // because "Phụ trách thanh toán, đối soát..." also contains those words
    else if (ll.includes('phụ trách hợp đồng')) {
      const c = parseContactCell(value);
      if (c.ten)   data.ct_hd_ten   = c.ten;
      if (c.cv)    data.ct_hd_cv    = c.cv;
      if (c.email) data.ct_hd_email = c.email;
      if (c.sdt)   data.ct_hd_sdt   = c.sdt;
    }
    else if (ll.includes('phụ trách kỹ thuật') || ll.includes('ky thuat')) {
      const c = parseContactCell(value);
      if (c.ten)   data.ct_kt_ten   = c.ten;
      if (c.cv)    data.ct_kt_cv    = c.cv;
      if (c.email) data.ct_kt_email = c.email;
      if (c.sdt)   data.ct_kt_sdt   = c.sdt;
    }
    else if (ll.includes('phụ trách quan hệ') || ll.includes('khiếu nại')) {
      const c = parseContactCell(value);
      if (c.ten)   data.ct_kh_ten   = c.ten;
      if (c.cv)    data.ct_kh_cv    = c.cv;
      if (c.email) data.ct_kh_email = c.email;
      if (c.sdt)   data.ct_kh_sdt   = c.sdt;
    }
    else if (ll.includes('phụ trách thanh toán') || ll.includes('hóa đơn')) {
      const c = parseContactCell(value);
      if (c.ten)   data.ct_tt_ten   = c.ten;
      if (c.cv)    data.ct_tt_cv    = c.cv;
      if (c.email) data.ct_tt_email = c.email;
      if (c.sdt)   data.ct_tt_sdt   = c.sdt;
    }
    // Generic "email đối soát" row — AFTER contact roles to avoid false match
    else if (ll.includes('đối soát') && !ll.includes('phụ trách')) {
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
      const ten    = String(row[2] || '').trim();
      const diaChi = String(row[4] || '').trim();
      if (!ten) continue;
      data.stores.push({ stt: Number(stt), ten, dia_chi: diaChi });
    }
  }

  return data;
}
