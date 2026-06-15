// src/docxFiller.js
import JSZip from 'jszip';

function escapeXml(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getParaText(pXml) {
  return pXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const DOTS_ONLY_RE = /^[…\.]+$/;
const HAS_DOTS_RE = /[…]{2,}|\.{5,}/;

function replaceDots(paraXml, value) {
  const escaped = escapeXml(value || '');
  let filledFirst = false;
  return paraXml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (match, attrs, content) => {
    const stripped = content.replace(/^CÔNG TY\s+/, '').replace(/^[\s]+/, '').trim();
    if (DOTS_ONLY_RE.test(stripped) && stripped.length > 0) {
      if (!filledFirst) {
        filledFirst = true;
        return '<w:t' + attrs + '>' + escaped + '</w:t>';
      } else {
        return '<w:t' + attrs + '></w:t>';
      }
    }
    return match;
  });
}

function replaceMixedDots(paraXml, value) {
  return replaceDots(paraXml, value);
}

function replaceClickOrTap(xml, nth, value) {
  const escaped = escapeXml(value || '');
  const PLACEHOLDER = 'Click or tap here to enter text.';
  let count = 0;
  let pos = 0;

  while (true) {
    const idx = xml.indexOf(PLACEHOLDER, pos);
    if (idx < 0) break;

    count++;
    if (count !== nth) {
      pos = idx + PLACEHOLDER.length;
      continue;
    }

    // Find the opening <w:t ...> right before this placeholder
    const tOpen = xml.lastIndexOf('<w:t', idx);
    const tClose = xml.indexOf('</w:t>', idx) + 6;

    // Replace entire <w:t...>placeholder</w:t> with our value
    xml = xml.slice(0, tOpen) + '<w:t>' + escaped + '</w:t>' + xml.slice(tClose);

    // Remove <w:showingPlcHdr/> in the enclosing SDT (look back up to 3000 chars)
    const lookback = Math.max(0, tOpen - 3000);
    const before = xml.slice(lookback, tOpen);
    const plcIdx = before.lastIndexOf('<w:showingPlcHdr/>');
    if (plcIdx >= 0) {
      const abs = lookback + plcIdx;
      xml = xml.slice(0, abs) + xml.slice(abs + '<w:showingPlcHdr/>'.length);
    }

    break;
  }

  return xml;
}

function identifyLabel(text) {
  const t = text.toLowerCase().trim();
  if (t === 'tên:' || t === 'tên') return 'ten';
  if (t === 'địa chỉ:' || t === 'địa chỉ') return 'dia_chi';
  if (t === 'điện thoại:' || t === 'điện thoại') return 'dien_thoai';
  if (t === 'mã số thuế' || t === 'mã số thuế:' || t === 'mã số doanh nghiệp' || t === 'mã số doanh nghiệp:') return 'ma_so_thue';
  if (t === 'đại diện' || t === 'đại diện:' || t === 'người đại diện' || t === 'người đại diện:') return 'dai_dien';
  if (t === 'chức vụ:' || t === 'chức vụ') return 'chuc_vu';
  if (t === 'giấy ủy quyền:' || t === 'giấy ủy quyền') return 'giay_uy_quyen';
  return null;
}

function makeStoreRow(stt, ten, diaChi) {
  const borders = '<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders>';
  const pPr = '<w:pPr><w:spacing w:before="120" w:after="120" w:line="288" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>';
  const rPr = '<w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>';
  const cell = (w, text) =>
    '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + borders + '</w:tcPr>' +
    '<w:p>' + pPr + '<w:r>' + rPr + '<w:t>' + escapeXml(text) + '</w:t></w:r></w:p></w:tc>';
  return '<w:tr>' + cell('1555', String(stt)) + cell('4678', ten) + cell('3117', diaChi) + '</w:tr>';
}

function fillStoreTable(xml, stores) {
  // Use specific marker to find the correct table (not the "PHAM VI CHAP NHAN" table)
  const MARKER = 'DANH SACH DIEM CHAP NHAN';
  const MARKER_VI = 'DANH SÁCH ĐIỂM CHẤP NHẬN';

  let markerIdx = xml.indexOf(MARKER_VI);
  if (markerIdx < 0) markerIdx = xml.indexOf(MARKER);
  if (markerIdx < 0) return xml;

  const tblIdx = xml.indexOf('<w:tbl>', markerIdx);
  if (tblIdx < 0) return xml;

  const tblEnd = xml.indexOf('</w:tbl>', tblIdx) + 8;
  const tblXml = xml.slice(tblIdx, tblEnd);

  const firstTrEnd = tblXml.indexOf('</w:tr>') + 7;
  const tblProps = tblXml.slice(0, tblXml.indexOf('<w:tr'));
  const headerTr = tblXml.slice(tblXml.indexOf('<w:tr'), firstTrEnd);

  const dataRows = stores.map(s => makeStoreRow(s.stt, s.ten, s.dia_chi)).join('');
  const newTbl = tblProps + headerTr + dataRows + '</w:tbl>';
  return xml.slice(0, tblIdx) + newTbl + xml.slice(tblEnd);
}

// Fill Bên A representative table (ĐẠI DIỆN BÊN A)
// Structure: table with 2 rows (header + data), 2 cells (BênA | BênB)
// Cell[0] = BênA, contains paragraphs with inline label+dots patterns
function fillRepresentativeTable(xml, fields) {
  const MARKER = 'ĐẠI DIỆN BÊN A';
  const markerIdx = xml.indexOf(MARKER);
  if (markerIdx < 0) return xml;

  const tblStart = xml.lastIndexOf('<w:tbl>', markerIdx);
  if (tblStart < 0) return xml;
  const tblEnd = xml.indexOf('</w:tbl>', tblStart) + 8;
  const tblXml = xml.slice(tblStart, tblEnd);

  // Skip header row, find data row
  const firstTrEnd = tblXml.indexOf('</w:tr>') + 7;
  const dataRowStart = tblXml.indexOf('<w:tr', firstTrEnd);
  if (dataRowStart < 0) return xml;
  const dataRowEnd = tblXml.indexOf('</w:tr>', dataRowStart) + 7;
  const dataRow = tblXml.slice(dataRowStart, dataRowEnd);

  // First <w:tc> is Bên A column (may have attributes, use '<w:tc')
  const tcStart = dataRow.indexOf('<w:tc');
  const tcEnd = dataRow.indexOf('</w:tc>') + 7;
  if (tcStart < 0) return xml;
  const benaCell = dataRow.slice(tcStart, tcEnd);

  // Fill dots in Bên A cell: each paragraph has inline label prefix + dots
  const filledCell = benaCell.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paraXml) => {
    const text = getParaText(paraXml);
    if (!HAS_DOTS_RE.test(text)) return paraXml;
    const tl = text.toLowerCase();
    let value = '';
    if (tl.includes('ông') && (tl.includes('bà') || tl.includes('ba'))) value = fields.dai_dien || '';
    else if (tl.includes('chức vụ')) value = fields.chuc_vu || '';
    else if (tl.includes('email')) value = fields.email || '';
    else if (tl.includes('điện thoại') || tl.includes('mobile')) value = fields.dien_thoai || '';
    return value ? replaceDots(paraXml, value) : paraXml;
  });

  const newDataRow = dataRow.slice(0, tcStart) + filledCell + dataRow.slice(tcEnd);
  const newTbl = tblXml.slice(0, dataRowStart) + newDataRow + tblXml.slice(dataRowEnd);
  return xml.slice(0, tblStart) + newTbl + xml.slice(tblEnd);
}

export async function fillDocxTemplate(templateBuffer, fields) {
  const zip = await JSZip.loadAsync(templateBuffer);
  let xml = await zip.file('word/document.xml').async('string');

  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  const parts = [];
  let lastIdx = 0;
  let m;
  paraRe.lastIndex = 0;
  while ((m = paraRe.exec(xml)) !== null) {
    if (m.index > lastIdx) parts.push({ type: 'gap', content: xml.slice(lastIdx, m.index) });
    parts.push({ type: 'para', content: m[0] });
    lastIdx = paraRe.lastIndex;
  }
  if (lastIdx < xml.length) parts.push({ type: 'gap', content: xml.slice(lastIdx) });

  const FIELD_MAP = {
    ten:          fields.ten || '',
    dia_chi:      fields.dia_chi || '',
    dien_thoai:   fields.dien_thoai || '',
    ma_so_thue:   fields.ma_so_thue || '',
    dai_dien:     fields.dai_dien || '',
    chuc_vu:      fields.chuc_vu || '',
    giay_uy_quyen: fields.giay_uy_quyen || '',
  };

  let currentLabel = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type !== 'para') continue;

    const text = getParaText(part.content);
    const label = identifyLabel(text);

    if (label) {
      currentLabel = label;
      continue;
    }

    if (currentLabel && HAS_DOTS_RE.test(text)) {
      const value = FIELD_MAP[currentLabel] || '';
      parts[i] = { type: 'para', content: replaceDots(part.content, value) };
      currentLabel = null;
      continue;
    }

    const lowerText = text.toLowerCase();
    if (lowerText.startsWith('hotline:') && HAS_DOTS_RE.test(text)) {
      parts[i] = { type: 'para', content: replaceMixedDots(part.content, fields.hotline || fields.dien_thoai || '') };
      currentLabel = null;
      continue;
    }
    if (lowerText.startsWith('email:') && HAS_DOTS_RE.test(text)) {
      parts[i] = { type: 'para', content: replaceMixedDots(part.content, fields.email || '') };
      currentLabel = null;
      continue;
    }

    if (text && !HAS_DOTS_RE.test(text) && !label) {
      currentLabel = null;
    }
  }

  xml = parts.map(p => p.content).join('');

  if (fields.so_tai_khoan) xml = replaceClickOrTap(xml, 1, fields.so_tai_khoan);
  if (fields.ten_chu_tai_khoan || fields.ten) xml = replaceClickOrTap(xml, 2, fields.ten_chu_tai_khoan || fields.ten);
  if (fields.ngan_hang) xml = replaceClickOrTap(xml, 3, fields.ngan_hang);

  xml = fillRepresentativeTable(xml, fields);

  if (fields.stores && fields.stores.length > 0) {
    xml = fillStoreTable(xml, fields.stores);
  }

  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}
