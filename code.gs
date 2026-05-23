// code.gs — Google Apps Script Web App (JSON API)
// Deploy: Extensions > Apps Script > Deploy > New deployment
//         Type: Web app | Execute as: Me | Access: Anyone

const SPREADSHEET_ID = '18-lR6kbBywnAjiPOy6XZ9ClDfB_xZpdvUVsPOcmzmho';
const SHEET_GID      = 2127838344;

// TODO: Token in query string is visible in browser history and server logs.
//       Fine for blocking casual access, but upgrade to OAuth / service account
//       if this data is ever sensitive.
const API_TOKEN = 'muzadidil';

// ── Entry point ───────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    if (!validateToken(e)) {
      return jsonOutput({ error: 'unauthorized', message: 'Invalid or missing token.' });
    }

    const q = sanitizeQuery(e.parameter.q);
    if (!q) {
      return jsonOutput({ count: 0, data: [] });
    }

    const sheet  = getTargetSheet();
    const values = sheet.getDataRange().getValues(); // single batch read — no getValue() in loop

    if (values.length < 2) {
      return jsonOutput({ count: 0, data: [] });
    }

    const headers = values[0].map(h => String(h).trim());
    const rows    = values.slice(1);

    const matched = rows
      .filter(row => rowMatchesQuery(row, q))
      .map(row => mapRowToObject(headers, row));

    return jsonOutput({ count: matched.length, data: matched });

  } catch (err) {
    // Structured log — easy to parse by external monitoring
    console.error(JSON.stringify({ event: 'API_ERROR', message: err.message, stack: err.stack }));
    return jsonOutput({ error: 'server_error', message: err.message });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateToken(e) {
  const token = (e.parameter.token || '').trim();
  return token === API_TOKEN;
}

function sanitizeQuery(raw) {
  return (raw || '').trim().toLowerCase();
}

function getTargetSheet() {
  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();
  const found  = sheets.find(s => s.getSheetId() === SHEET_GID);
  return found || ss.getSheets()[0]; // fallback to first sheet if GID not found
}

function rowMatchesQuery(row, q) {
  return row.some(cell => String(cell).toLowerCase().includes(q));
}

function mapRowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, i) => {
    obj[header] = (row[i] !== undefined && row[i] !== null) ? row[i] : '';
  });
  return obj;
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
