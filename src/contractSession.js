// src/contractSession.js
// Collects files from a Zalo group conversation for the /hd feature
// Required: docx, xlsx, pdf (GPKD)
// Optional: image (CCCD), giay_uy_quyen (2nd PDF)
// Auto-resolves when: docx + xlsx + pdf + image all received
// Force-resolves via /done when: at least docx + xlsx + pdf received

const TIMEOUT_MS = 90_000;
const REQUIRED_TYPES = ['docx', 'xlsx', 'pdf'];
const sessions = new Map(); // key: `${groupId}:${userId}`

function sessionKey(groupId, userId) {
  return `${groupId}:${userId}`;
}

/**
 * Start a collection session after /hd trigger.
 * @param {Function} onFileAdded - callback(session) called each time a new file is added
 * @returns {boolean} true if started, false if already active
 */
export function startSession(groupId, userId, onFileAdded) {
  const key = sessionKey(groupId, userId);
  if (sessions.has(key)) return false;

  const session = {
    groupId,
    userId,
    files: [],        // { url, name, type: 'docx'|'image'|'xlsx'|'pdf'|'unknown' }
    createdAt: Date.now(),
    resolve: null,
    timer: null,
    onFileAdded: onFileAdded || null,
  };

  const promise = new Promise((resolve) => {
    session.resolve = resolve;
    session.timer = setTimeout(() => {
      sessions.delete(key);
      resolve({ timeout: true, files: session.files });
    }, TIMEOUT_MS);
  });

  session.promise = promise;
  sessions.set(key, session);
  return true;
}

/** Detect file type from filename and existing session files */
function detectType(filename, existingFiles) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'pdf') {
    // First PDF = GPKD, second PDF = Giấy ủy quyền (optional)
    if (existingFiles && existingFiles.some(f => f.type === 'pdf')) return 'giay_uy_quyen';
    return 'pdf';
  }
  return 'unknown';
}

/**
 * Add a file to an active session.
 * @returns {boolean} true if there is an active session for this user/group
 */
export function addFileToSession(groupId, userId, url, filename) {
  const key = sessionKey(groupId, userId);
  const session = sessions.get(key);
  if (!session) return false;

  const type = detectType(filename, session.files);
  // Only keep first file of each type (except unknown and giay_uy_quyen which is the 2nd pdf)
  if (type !== 'unknown' && type !== 'giay_uy_quyen' && session.files.some(f => f.type === type)) return true;

  session.files.push({ url, name: filename, type });

  // Notify caller that a file was added
  if (session.onFileAdded) {
    try { session.onFileAdded(session); } catch {}
  }

  // Auto-resolve when docx + xlsx + pdf + image (CCCD) all received
  const types = new Set(session.files.map(f => f.type));
  if (types.has('docx') && types.has('image') && types.has('xlsx') && types.has('pdf')) {
    clearTimeout(session.timer);
    sessions.delete(key);
    session.resolve({ timeout: false, files: session.files });
  }

  return true;
}

/**
 * Wait for the session to complete (all files received or timeout).
 * Returns null if no active session.
 */
export function waitForSession(groupId, userId) {
  const key = sessionKey(groupId, userId);
  const session = sessions.get(key);
  return session ? session.promise : null;
}

export function hasActiveSession(groupId, userId) {
  return sessions.has(sessionKey(groupId, userId));
}

/**
 * Force-complete session via /done command.
 * @returns {'ok'|'missing'|'no_session'}
 *   'ok'         — had required files, resolved
 *   'missing'    — session exists but missing required files (returns list)
 *   'no_session' — no active session
 */
export function completeSession(groupId, userId) {
  const key = sessionKey(groupId, userId);
  const session = sessions.get(key);
  if (!session) return { status: 'no_session' };

  const types = new Set(session.files.map(f => f.type));
  const missing = REQUIRED_TYPES.filter(t => !types.has(t));
  if (missing.length > 0) {
    return { status: 'missing', missing, files: session.files };
  }

  clearTimeout(session.timer);
  sessions.delete(key);
  session.resolve({ timeout: false, files: session.files });
  return { status: 'ok' };
}

export function cancelSession(groupId, userId) {
  const key = sessionKey(groupId, userId);
  const session = sessions.get(key);
  if (!session) return;
  clearTimeout(session.timer);
  sessions.delete(key);
  session.resolve({ timeout: true, files: session.files });
}

export { REQUIRED_TYPES };
