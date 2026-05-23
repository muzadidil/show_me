// =============================================================================
// code.gs  —  Kamus Search API  (Google Apps Script Web App)
// Deploy : Extensions › Apps Script › Deploy › New deployment
//          Type: Web app | Execute as: Me | Access: Anyone
// =============================================================================

// ── CONFIGURE BEFORE DEPLOY ──────────────────────────────────────────────────
const SPREADSHEET_ID = '18-lR6kbBywnAjiPOy6XZ9ClDfB_xZpdvUVsPOcmzmho';
const SHEET_NAME     = 'NAMA_TAB';   // ← ganti: nama tab di Sheet Anda
const MAX_QUERY_LEN  = 100;          // max length of search query

// TODO: Token in query string is visible in browser source & server logs.
//       Fine for blocking casual access only. Upgrade to OAuth / service
//       account if this data is ever sensitive.
const API_TOKEN = 'muzadidil';

// ── Entry point ───────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    if (!validateToken(e.parameter.token)) {
      return jsonResponse({ error: 'unauthorized', message: 'Invalid or missing token.' });
    }

    const q = sanitizeQuery(e.parameter.q);
    if (!q) return jsonResponse({ count: 0, data: [] });

    const { headers, rows } = readSheet();
    const matched           = filterRows(rows, headers, q);

    return jsonResponse({ count: matched.length, total: rows.length, data: matched });

  } catch (err) {
    console.error(JSON.stringify({
      event:   'KAMUS_API_ERROR',
      message: err.message,
      stack:   err.stack
    }));
    return jsonResponse({ error: 'server_error', message: err.message });
  }
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateToken(token) {
  return (token || '').trim() === API_TOKEN;
}

function sanitizeQuery(raw) {
  const s = (raw || '').trim().toLowerCase();
  return s.length > MAX_QUERY_LEN ? s.substring(0, MAX_QUERY_LEN) : s;
}

// ── Sheet reader ─────────────────────────────────────────────────────────────
// Reads ALL data in a single batch call — never getValue() inside a loop.
function readSheet() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);    // standalone script
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');

  const values  = sheet.getDataRange().getValues();         // single batch read
  const headers = values[0].map(h => String(h).trim());
  const rows    = values.slice(1);

  return { headers, rows };
}

// ── Filter ───────────────────────────────────────────────────────────────────
function filterRows(rows, headers, q) {
  return rows
    .filter(row => row.some(cell => String(cell).toLowerCase().includes(q)))
    .map(row => rowToObject(headers, row));
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = (row[i] !== undefined && row[i] !== null) ? row[i] : '';
  });
  return obj;
}

// ── Response ──────────────────────────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
