// src/contractHandler.js
import https from 'https';
import http from 'http';
import { ThreadType } from 'zca-js';
import { extractFromXLSX } from './extractors/extractFromXLSX.js';
import { extractFromCCCD } from './extractors/extractFromCCCD.js';
import { extractFromGPKD } from './extractors/extractFromGPKD.js';
import { extractFromGiayUyQuyen } from './extractors/extractFromGiayUyQuyen.js';
import { fillDocxTemplate } from './docxFiller.js';
import { logger } from './logger.js';
import { recordContractEnd } from './metrics.js';

/**
 * Download a file from a URL, returns Buffer.
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadFile(res.headers.location));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function getMimeType(filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/**
 * Handle completed file collection: extract + fill + send.
 */
export async function handleContractFiles(files, groupId, senderName, senderId, api) {
  const t0 = Date.now();
  const docxFile   = files.find(f => f.type === 'docx');
  const imageFile  = files.find(f => f.type === 'image');
  const xlsxFile   = files.find(f => f.type === 'xlsx');
  const pdfFile    = files.find(f => f.type === 'pdf');
  const guyFile    = files.find(f => f.type === 'giay_uy_quyen'); // optional

  // imageFile (CCCD) is optional
  const missing = [];
  if (!docxFile) missing.push('hợp đồng (.docx)');
  if (!xlsxFile) missing.push('thông tin (.xlsx)');
  if (!pdfFile)  missing.push('GPKD (.pdf)');

  if (missing.length > 0) {
    await api.sendMessage(
      { msg: '❌ @' + senderName + ' Thiếu file bắt buộc: ' + missing.join(', ') + '. Vui lòng gửi lại /hd.',
        mentions: [{ uid: senderId, pos: 3, len: senderName.length }] },
      groupId, ThreadType.Group
    );
    return;
  }

  try {
    logger.info('[/hd] Downloading files...');
    await api.sendMessage(
      { msg: `⏳ @${senderName} Đang tải file...`,
        mentions: [{ uid: senderId, pos: 3, len: senderName.length }] },
      groupId, ThreadType.Group
    );

    const [templateBuf, xlsxBuf, pdfBuf, imageBuf, guyBuf] = await Promise.all([
      downloadFile(docxFile.url),
      downloadFile(xlsxFile.url),
      downloadFile(pdfFile.url),
      imageFile ? downloadFile(imageFile.url) : Promise.resolve(null),
      guyFile   ? downloadFile(guyFile.url)   : Promise.resolve(null),
    ]);

    logger.info('[/hd] Extracting data...');
    const parts = ['GPKD', 'thông tin'];
    if (imageFile) parts.unshift('CCCD');
    if (guyFile)   parts.push('Giấy ủy quyền');
    await api.sendMessage(
      { msg: '🔍 @' + senderName + ' Đang đọc ' + parts.join(', ') + '...',
        mentions: [{ uid: senderId, pos: 3, len: senderName.length }] },
      groupId, ThreadType.Group
    );

    const extractTasks = [
      Promise.resolve(extractFromXLSX(xlsxBuf)),
      imageFile ? extractFromCCCD(imageBuf, getMimeType(imageFile.name)) : Promise.resolve({}),
      extractFromGPKD(pdfBuf),
    ];
    if (guyFile && guyBuf) extractTasks.push(extractFromGiayUyQuyen(guyBuf));
    const [xlsxData, cccdData, gpkdData, guyData] = await Promise.all(extractTasks);

    logger.info('[/hd] XLSX:', xlsxData);
    if (imageFile) logger.info('[/hd] CCCD:', cccdData);
    logger.info('[/hd] GPKD:', gpkdData);
    if (guyData) logger.info('[/hd] GUQ:', guyData);

    // Build giay_uy_quyen string if authorization letter was provided
    let giayUyQuyenStr = '';
    if (guyData && (guyData.so_uy_quyen || guyData.ngay_ky)) {
      giayUyQuyenStr = 'Theo giấy ủy quyền số ' + (guyData.so_uy_quyen || '...') +
        ' kí ngày ' + (guyData.ngay_ky || '...');
    }

    // Merge fields: GPKD is primary source for company info
    const dienThoai = gpkdData.dien_thoai || xlsxData.dien_thoai || '';
    const fields = {
      ten:               gpkdData.ten_cong_ty || '',
      dia_chi:           gpkdData.dia_chi || '',
      ma_so_thue:        (gpkdData.ma_so_thue || '').replace(/\D/g, ''),
      dai_dien:          gpkdData.nguoi_dai_dien || (cccdData && cccdData.ho_ten) || '',
      chuc_vu:           gpkdData.chuc_vu || '',
      dien_thoai:        dienThoai,
      email:             xlsxData.email || '',
      so_tai_khoan:      xlsxData.so_tai_khoan || '',
      ngan_hang:         xlsxData.ngan_hang || '',
      ten_chu_tai_khoan: xlsxData.ten_chu_tai_khoan || gpkdData.ten_cong_ty || '',
      hotline:           dienThoai,
      giay_uy_quyen:     giayUyQuyenStr,
      stores:            xlsxData.stores || [],
      // BÊN A contact table — all 4 roles sourced from xlsx
      // Role 1 (phụ trách hợp đồng): xlsx preferred, fallback to GPKD legal rep
      ct_hd_ten:   xlsxData.ct_hd_ten   || gpkdData.nguoi_dai_dien || '',
      ct_hd_cv:    xlsxData.ct_hd_cv    || gpkdData.chuc_vu || '',
      ct_hd_email: xlsxData.ct_hd_email || '',
      ct_hd_sdt:   xlsxData.ct_hd_sdt   || dienThoai,
      ct_kt_ten:   xlsxData.ct_kt_ten   || '',
      ct_kt_cv:    xlsxData.ct_kt_cv    || '',
      ct_kt_email: xlsxData.ct_kt_email || '',
      ct_kt_sdt:   xlsxData.ct_kt_sdt   || '',
      ct_kh_ten:   xlsxData.ct_kh_ten   || '',
      ct_kh_cv:    xlsxData.ct_kh_cv    || '',
      ct_kh_email: xlsxData.ct_kh_email || '',
      ct_kh_sdt:   xlsxData.ct_kh_sdt   || '',
      ct_tt_ten:   xlsxData.ct_tt_ten   || '',
      ct_tt_cv:    xlsxData.ct_tt_cv    || '',
      ct_tt_email: xlsxData.ct_tt_email || '',
      ct_tt_sdt:   xlsxData.ct_tt_sdt   || '',
    };

    // Build summary of extracted data for user confirmation
    const summaryLines = [];
    if (fields.ten)        summaryLines.push('🏢 ' + fields.ten);
    if (fields.ma_so_thue) summaryLines.push('🔢 MST: ' + fields.ma_so_thue);
    if (fields.dai_dien)   summaryLines.push('👤 ' + fields.dai_dien + (fields.chuc_vu ? ' (' + fields.chuc_vu + ')' : ''));
    if (fields.dien_thoai) summaryLines.push('📞 ' + fields.dien_thoai);
    if (fields.ngan_hang && fields.so_tai_khoan) summaryLines.push('🏦 ' + fields.ngan_hang + ' — ' + fields.so_tai_khoan);
    if (fields.stores.length > 0) summaryLines.push('🏪 ' + fields.stores.length + ' cửa hàng');

    logger.info('[/hd] Filling template...');
    await api.sendMessage(
      { msg: '✍️ @' + senderName + ' Đang điền hợp đồng...\n' + summaryLines.join('\n'),
        mentions: [{ uid: senderId, pos: 3, len: senderName.length }] },
      groupId, ThreadType.Group
    );

    const filledBuf = await fillDocxTemplate(templateBuf, fields);

    logger.info('[/hd] Sending filled docx...');
    const outName = 'HopDong_' + (fields.ten || 'KhachHang').replace(/\s+/g, '_') + '.docx';
    await api.sendMessage(
      {
        msg: '✅ @' + senderName + ' Hợp đồng đã điền xong!',
        mentions: [{ uid: senderId, pos: 3, len: senderName.length }],
        attachments: {
          data: filledBuf,
          filename: outName,
          metadata: { totalSize: filledBuf.length },
        },
      },
      groupId,
      ThreadType.Group
    );
    recordContractEnd(Date.now() - t0, true);

  } catch (err) {
    recordContractEnd(Date.now() - t0, false);
    logger.error('[/hd] Error:', err);
    await api.sendMessage(
      { msg: `❌ @${senderName} Có lỗi xảy ra khi xử lý hợp đồng: ${err.message}`,
        mentions: [{ uid: senderId, pos: 3, len: senderName.length }] },
      groupId, ThreadType.Group
    );
  }
}
