// src/sessionManager.js
// Quản lý session Zalo qua biến môi trường ZALO_SESSION (base64-encoded JSON)
// Không cần file — thân thiện với cloud (Railway, Render, Fly.io, VPS...)

import { Zalo, LoginQRCallbackEventType } from 'zca-js';
import { logger } from './logger.js';

const ENV_KEY = 'ZALO_SESSION';

// ─────────────────────────────────────────────
// Encode / Decode Base64
// ─────────────────────────────────────────────

function encodeSession(credentials) {
  return Buffer.from(JSON.stringify(credentials)).toString('base64');
}

function decodeSession(b64) {
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
}

// ─────────────────────────────────────────────
// In hướng dẫn sau khi QR login thành công
// ─────────────────────────────────────────────

function printSessionInstructions(b64) {
  const line = '═'.repeat(60);
  console.log(`\n${line}`);
  console.log('🔑 SESSION ĐÃ SẴN SÀNG — Copy giá trị dưới vào env var:');
  console.log(`\n   ${ENV_KEY}=${b64}\n`);
  console.log('📋 Cách dùng:');
  console.log('   • Local  : thêm vào file .env');
  console.log('   • Railway: Settings → Variables → Add');
  console.log('   • Render : Environment → Add Env Var');
  console.log('   • VPS    : export ZALO_SESSION="..." trong .bashrc');
  console.log(`${line}\n`);
}

// ─────────────────────────────────────────────
// Thử login bằng session từ env var
// ─────────────────────────────────────────────

async function tryLoginWithEnv() {
  const b64 = process.env[ENV_KEY];
  if (!b64) return null;

  logger.info(`Tìm thấy ${ENV_KEY}, đang thử đăng nhập...`);
  try {
    const credentials = decodeSession(b64);
    const zalo = new Zalo(credentials, undefined, { logging: false });
    const api = await zalo.login();
    logger.success('✅ Đăng nhập bằng session thành công! (không cần quét QR)');
    return api;
  } catch (err) {
    logger.warn(`Session hết hạn hoặc không hợp lệ: ${err?.message || err}`);
    logger.warn(`Hãy xóa ${ENV_KEY} khỏi env và chạy lại để lấy session mới.`);
    return null;
  }
}

// ─────────────────────────────────────────────
// QR Login + bắt credentials qua callback event GotLoginInfo
// zca-js expose credentials qua loginQR callback, không phải return value
// ─────────────────────────────────────────────

async function loginWithQR() {
  logger.info('─'.repeat(50));
  logger.info('Đang tạo QR code đăng nhập Zalo...');
  logger.info('Mở Zalo trên điện thoại:');
  logger.info('  Android: Trang chủ → icon QR góc trên phải');
  logger.info('  iOS    : Cài đặt → QR Code');
  logger.info('─'.repeat(50));

  const zaloInstance = new Zalo({ logging: false });

  // Bắt credentials từ event GotLoginInfo trong callback
  let capturedCredentials = null;

  const api = await zaloInstance.loginQR(async (event) => {
    switch (event.type) {
      // QR được tạo — in ra terminal
      case LoginQRCallbackEventType.QRCodeGenerated:
        await event.actions.saveToFile(); // tự in QR lên terminal
        logger.info('QR code đã hiển thị — hãy quét bằng Zalo trên điện thoại.');
        break;

      // QR hết hạn — tự retry
      case LoginQRCallbackEventType.QRCodeExpired:
        logger.warn('QR hết hạn, đang tạo QR mới...');
        event.actions.retry();
        break;

      // Đã quét QR
      case LoginQRCallbackEventType.QRCodeScanned:
        logger.info(`Đã quét QR! Đang chờ xác nhận từ ${event.data.display_name}...`);
        break;

      // Từ chối trên điện thoại
      case LoginQRCallbackEventType.QRCodeDeclined:
        logger.warn('Người dùng từ chối trên điện thoại. Đang thử lại...');
        event.actions.retry();
        break;

      // ✅ Đây là lúc credentials có sẵn
      case LoginQRCallbackEventType.GotLoginInfo:
        capturedCredentials = {
          cookie: event.data.cookie,
          imei: event.data.imei,
          userAgent: event.data.userAgent,
        };
        logger.success('Đã lấy được credentials từ Zalo!');
        break;
    }
  });

  // Encode và in hướng dẫn
  if (capturedCredentials) {
    const b64 = encodeSession(capturedCredentials);
    printSessionInstructions(b64);
  } else {
    logger.warn('Không lấy được credentials từ callback. Bạn sẽ cần QR lại lần sau.');
  }

  return api;
}

// ─────────────────────────────────────────────
// Export: Smart login
// ─────────────────────────────────────────────

/**
 * Đăng nhập Zalo thông minh:
 * 1. Đọc ZALO_SESSION env var → decode base64 → thử login
 * 2. Nếu không có hoặc hết hạn → QR login → in base64 để copy vào env
 */
export async function smartLogin() {
  // Ưu tiên env var trước
  const api = await tryLoginWithEnv();
  if (api) return api;

  // Fallback: QR login
  return loginWithQR();
}
