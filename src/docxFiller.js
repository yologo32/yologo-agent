// src/docxFiller.js
import JSZip from 'jszip';

function escapeXml(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const MARKER_VI = 'DANH SÁCH ĐIỂM CHẤP NHẬN';
  const MARKER    = 'DANH SACH DIEM CHAP NHAN';

  let markerIdx = xml.indexOf(MARKER_VI);
  if (markerIdx < 0) markerIdx = xml.indexOf(MARKER);
  if (markerIdx < 0) return xml;

  const tblIdx = xml.indexOf('<w:tbl>', markerIdx);
  if (tblIdx < 0) return xml;

  const tblEnd   = xml.indexOf('</w:tbl>', tblIdx) + 8;
  const tblXml   = xml.slice(tblIdx, tblEnd);
  const firstTrEnd = tblXml.indexOf('</w:tr>') + 7;
  const tblProps = tblXml.slice(0, tblXml.indexOf('<w:tr'));
  const headerTr = tblXml.slice(tblXml.indexOf('<w:tr'), firstTrEnd);

  const dataRows = stores.map(s => makeStoreRow(s.stt, s.ten, s.dia_chi)).join('');
  const newTbl   = tblProps + headerTr + dataRows + '</w:tbl>';
  return xml.slice(0, tblIdx) + newTbl + xml.slice(tblEnd);
}

/**
 * Word splits {placeholder} text across multiple XML runs when a user edits the template.
 * Handles two patterns:
 *   A) { in its own run, full name in one run, } in its own run
 *   B) { in its own run, name split across 2+ runs, } at end of last run's text
 *
 * Approach: find each '{</w:t>' position, scan forward collecting <w:t> text,
 * stop when '}' is found. If the collected text is a valid placeholder name,
 * replace the entire XML span with '{name}</w:t></w:r>'.
 */
function consolidateSplitPlaceholders(xml) {
  let result = xml;
  let changed = true;

  while (changed) {
    changed = false;
    const openIdx = result.indexOf('{</w:t>');
    if (openIdx < 0) break;

    // Scan forward from after '{</w:t>' collecting text from <w:t> elements
    let pos = openIdx + 7;
    let accumulated = '';
    let lastMatchEnd = -1;

    const tRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    tRe.lastIndex = pos;

    let tm;
    let scanLimit = pos + 3000;
    let foundClose = false;

    while ((tm = tRe.exec(result)) !== null && tm.index < scanLimit) {
      const textPart = tm[1];
      accumulated += textPart;

      if (accumulated.includes('}')) {
        const closeIdx = accumulated.indexOf('}');
        const namePart = accumulated.slice(0, closeIdx);
        const afterClose = accumulated.slice(closeIdx + 1);

        // Must be a valid placeholder name (letters/underscores only)
        if (/^[a-zA-Z_]+$/.test(namePart)) {
          // Find </w:r> right after this </w:t>
          const tmEnd = tm.index + tm[0].length;
          const rClose = result.indexOf('</w:r>', tmEnd);
          if (rClose >= 0) {
            const replaceEnd = rClose + 6;
            const newContent = '{' + namePart + '}</w:t></w:r>'
              + (afterClose ? '<w:r><w:t>' + afterClose + '</w:t></w:r>' : '');
            result = result.slice(0, openIdx) + newContent + result.slice(replaceEnd);
            changed = true;
            foundClose = true;
          }
        }
        break; // stop scanning (either replaced or invalid)
      }
    }

    // If no valid close found, skip this '{' to avoid infinite loop
    if (!foundClose && !changed) {
      // Temporarily mark to skip; restore after loop
      result = result.slice(0, openIdx) + '\x00' + result.slice(openIdx + 1);
    }
  }

  // Restore any skipped '{'
  return result.replace(/\x00/g, '{');
}

/**
 * Fill all {placeholder} markers in the document XML.
 * Handles placeholders split across runs by Word's XML engine.
 */
export async function fillDocxTemplate(templateBuffer, fields) {
  const zip = await JSZip.loadAsync(templateBuffer);
  let xml = await zip.file('word/document.xml').async('string');

  // Merge any {placeholder} text that Word split across XML runs
  xml = consolidateSplitPlaceholders(xml);

  const FIELD_MAP = {
    // Company info (from GPKD)
    ten_ben_a:      fields.ten          || '',
    dia_chi_ben_a:  fields.dia_chi      || '',
    ma_so_thue:     fields.ma_so_thue   || '',
    dai_dien:       fields.dai_dien     || '',
    chuc_vu:        fields.chuc_vu      || '',
    giay_uy_quyen:  fields.giay_uy_quyen || '',

    // Bank / contact (from XLSX)
    so_tai_khoan:   fields.so_tai_khoan     || '',
    ngan_hang:      fields.ngan_hang        || '',
    ten_chu_tk:     fields.ten_chu_tai_khoan || fields.ten || '',
    hotline:        fields.hotline          || fields.dien_thoai || '',
    email:          fields.email            || '',

    // BÊN A contact table — role 1: phụ trách hợp đồng
    ct_hd_ten:      fields.ct_hd_ten    || '',
    ct_hd_cv:       fields.ct_hd_cv     || '',
    ct_hd_email:    fields.ct_hd_email  || '',
    ct_hd_sdt:      fields.ct_hd_sdt    || '',

    // BÊN A contact table — roles 2-4: from xlsx extended fields (blank if not provided)
    ct_kt_ten:      fields.ct_kt_ten    || '',
    ct_kt_cv:       fields.ct_kt_cv     || '',
    ct_kt_email:    fields.ct_kt_email  || '',
    ct_kt_sdt:      fields.ct_kt_sdt    || '',

    ct_kh_ten:      fields.ct_kh_ten    || '',
    ct_kh_cv:       fields.ct_kh_cv     || '',
    ct_kh_email:    fields.ct_kh_email  || '',
    ct_kh_sdt:      fields.ct_kh_sdt    || '',

    ct_tt_ten:      fields.ct_tt_ten    || '',
    ct_tt_cv:       fields.ct_tt_cv     || '',
    ct_tt_email:    fields.ct_tt_email  || '',
    ct_tt_sdt:      fields.ct_tt_sdt    || '',
  };

  // Replace all {placeholder} occurrences
  for (const [key, value] of Object.entries(FIELD_MAP)) {
    const escaped = escapeXml(value);
    xml = xml.split('{' + key + '}').join(escaped);
  }

  // Fill store table (repeating rows — kept as structured logic)
  if (fields.stores && fields.stores.length > 0) {
    xml = fillStoreTable(xml, fields.stores);
  }

  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}
