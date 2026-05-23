import { db, authReady } from './firebase-config.js';
import { notify } from './notify.js';
import {
    collection, doc, addDoc, setDoc, deleteDoc,
    query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const PASSWORD     = 'zasha';
const PAGES        = { kamus: 'index.html', todo: 'todo.html', notes: 'notes.html' };
const DEFAULT_COLS = ['Tanggal', 'Keterangan', 'Nominal'];

// DOM
const lockScreen  = document.getElementById('lock-screen');
const appDiv      = document.getElementById('app');
const passInput   = document.getElementById('pass-input');
const lockError   = document.getElementById('lock-error');
const tablesList  = document.getElementById('tables-list');
const tblCount    = document.getElementById('tbl-count');
const tblLabel    = document.getElementById('tbl-label');
const unsavedDot  = document.getElementById('unsaved-dot');
const tblInfo     = document.getElementById('tbl-info');
const tableWrap   = document.getElementById('table-wrap');
const dataTable   = document.getElementById('data-table');
const emptyState  = document.getElementById('empty-state');
const cmdInput    = document.getElementById('cmd-input');
const cmdHint     = document.getElementById('cmd-hint');
const btnSave     = document.getElementById('btn-save');
const btnDel      = document.getElementById('btn-del');

// State
let allTables       = [];
let activeTableId   = null;
let activeName      = '';
let columns         = [];  // column names (excluding No)
let rows            = [];  // array of arrays, each matching columns
let isDirty         = false;
let pendingDeleteId = null;

// --- Login ---
passInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    if (passInput.value === PASSWORD) {
        lockScreen.style.display = 'none';
        appDiv.style.display = 'flex';
        cmdInput.focus();
        await authReady;
        listenTables();
    } else {
        lockError.style.display = 'block';
        passInput.value = '';
    }
});

// --- Realtime table list ---
function listenTables() {
    const q = query(collection(db, 'excel_data'), orderBy('updated_at', 'desc'));
    onSnapshot(q, snap => {
        allTables = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTableList();
    });
}

function renderTableList() {
    tblCount.textContent = allTables.length;
    tablesList.innerHTML = '';
    if (allTables.length === 0) {
        tablesList.innerHTML = '<div style="color:#002200;font-size:12px;padding:12px;text-shadow:none;">Ketik: add &lt;nama&gt;</div>';
        return;
    }
    allTables.forEach(t => {
        const item = document.createElement('div');
        item.className = 'tbl-item' + (t.id === activeTableId ? ' active' : '');
        item.dataset.id = t.id;
        const date = t.updated_at?.toDate?.()?.toLocaleDateString('id-ID', { day:'2-digit', month:'short' }) || '--';
        item.innerHTML = `
            <div class="ti-name">${escHtml(t.name)}</div>
            <div class="ti-meta">${t.row_count || 0} baris &middot; ${t.col_count || 0} kol &middot; ${date}</div>
        `;
        item.addEventListener('click', () => openTable(t));
        tablesList.appendChild(item);
    });
}

// --- Open table (data already in allTables from onSnapshot) ---
function openTable(meta) {
    if (isDirty) {
        notify('Ada perubahan belum tersimpan. Ketik save atau CTRL+S dahulu.', 'warn');
        return;
    }
    activeTableId = meta.id;
    activeName    = meta.name;
    columns       = Array.isArray(meta.columns) ? [...meta.columns] : DEFAULT_COLS.slice();
    rows          = JSON.parse(meta.rows_json || '[]');
    isDirty       = false;
    unsavedDot.style.display = 'none';
    tblLabel.textContent = meta.name;
    renderTable();
    updateToolbar();
    renderTableList();
    notify(`'${meta.name}' dimuat.`, 'success');
}

// --- Render table ---
function renderTable() {
    emptyState.style.display = 'none';
    tableWrap.style.display  = 'block';

    const lastIdx = columns.length - 1;
    const sumVal  = computeSum(rows, lastIdx);

    const thead = document.createElement('thead');
    const hrow  = document.createElement('tr');

    const thNo = document.createElement('th');
    thNo.className   = 'th-no';
    thNo.textContent = 'No';
    hrow.appendChild(thNo);

    columns.forEach((col, ci) => {
        const th = document.createElement('th');
        if (ci === lastIdx) {
            th.className     = 'th-sum';
            th.dataset.origname = col;
            th.textContent   = sumVal !== null ? formatSum(sumVal) : col;
        } else {
            th.textContent = col;
        }
        hrow.appendChild(th);
    });
    thead.appendChild(hrow);

    const tbody = document.createElement('tbody');
    rows.forEach((row, ri) => {
        const tr = document.createElement('tr');

        const tdNo = document.createElement('td');
        tdNo.className   = 'td-no';
        tdNo.textContent = ri + 1;
        tr.appendChild(tdNo);

        columns.forEach((col, ci) => {
            const td = document.createElement('td');
            td.contentEditable = 'true';
            td.textContent     = row[ci] ?? '';
            td.dataset.row = ri;
            td.dataset.col = ci;

            td.addEventListener('input', () => {
                markDirty();
                if (ci === lastIdx) updateSumHeader();
            });

            td.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const cells = [...tr.querySelectorAll('td[contenteditable]')];
                    const idx   = cells.indexOf(td);
                    if (!e.shiftKey && idx < cells.length - 1) {
                        cells[idx + 1].focus();
                    } else if (e.shiftKey && idx > 0) {
                        cells[idx - 1].focus();
                    } else {
                        cmdInput.focus();
                    }
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const allRows = [...tbody.children];
                    const nextTr  = allRows[ri + 1];
                    if (nextTr) {
                        const nextCells = [...nextTr.querySelectorAll('td[contenteditable]')];
                        if (nextCells[ci]) nextCells[ci].focus();
                    } else {
                        cmdInput.focus();
                    }
                }
                if (e.key === 'Escape') {
                    cmdInput.focus();
                }
            });
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    dataTable.innerHTML = '';
    dataTable.appendChild(thead);
    dataTable.appendChild(tbody);
    updateInfo();
}

// --- Sum helpers ---
function computeSum(rowsData, colIdx) {
    let sum = 0, hasNum = false;
    rowsData.forEach(row => {
        const v = parseFloat(String(row[colIdx] || '').replace(/[^0-9.,\-]/g, '').replace(',', '.'));
        if (!isNaN(v) && isFinite(v)) { sum += v; hasNum = true; }
    });
    return hasNum ? sum : null;
}

function updateSumHeader() {
    const lastIdx = columns.length - 1;
    const cells   = dataTable.querySelectorAll(`tbody td[data-col="${lastIdx}"]`);
    let sum = 0, hasNum = false;
    cells.forEach(td => {
        const v = parseFloat(String(td.textContent || '').replace(/[^0-9.,\-]/g, '').replace(',', '.'));
        if (!isNaN(v) && isFinite(v)) { sum += v; hasNum = true; }
    });
    const th = dataTable.querySelector('thead th.th-sum');
    if (th) {
        const origName = th.dataset.origname || columns[lastIdx];
        th.textContent = hasNum ? formatSum(sum) : origName;
    }
}

function formatSum(val) {
    return 'Σ ' + val.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function updateInfo() {
    tblInfo.textContent = rows.length + ' baris · ' + columns.length + ' kolom';
}

function markDirty() {
    isDirty = true;
    unsavedDot.style.display = 'inline';
}

function updateToolbar() {
    btnSave.style.display = activeTableId ? 'inline-block' : 'none';
    btnDel.style.display  = activeTableId ? 'inline-block' : 'none';
}

// --- Read rows from DOM ---
function getRowsFromDom() {
    const trs = dataTable.querySelectorAll('tbody tr');
    return Array.from(trs).map(tr => {
        const cells = tr.querySelectorAll('td[contenteditable]');
        return Array.from(cells).map(td => td.textContent);
    });
}

// --- Save ---
async function saveTable() {
    if (!activeTableId) { notify('Tidak ada tabel aktif.', 'warn'); return; }
    rows = getRowsFromDom();
    try {
        await setDoc(doc(db, 'excel_data', activeTableId), {
            name:       activeName,
            columns,
            rows_json:  JSON.stringify(rows),
            row_count:  rows.length,
            col_count:  columns.length,
            updated_at: serverTimestamp()
        });
        isDirty = false;
        unsavedDot.style.display = 'none';
        notify('Tersimpan.', 'success');
    } catch (err) {
        notify('Gagal simpan: ' + err.message, 'error');
    }
}

// --- Create new table ---
async function createTable(name) {
    const today   = new Date().toLocaleDateString('id-ID');
    const cols    = DEFAULT_COLS.slice();
    const rowData = [
        [today, '', ''],
        [today, '', '']
    ];
    try {
        const ref = await addDoc(collection(db, 'excel_data'), {
            name,
            columns:    cols,
            rows_json:  JSON.stringify(rowData),
            row_count:  rowData.length,
            col_count:  cols.length,
            updated_at: serverTimestamp()
        });
        activeTableId = ref.id;
        activeName    = name;
        columns       = cols;
        rows          = rowData;
        isDirty       = false;
        unsavedDot.style.display = 'none';
        tblLabel.textContent = name;
        renderTable();
        updateToolbar();
        notify(`Tabel '${name}' dibuat.`, 'success');
    } catch (err) {
        notify('Gagal buat tabel: ' + err.message, 'error');
    }
}

// --- Delete table ---
async function deleteTable(id, name) {
    try {
        await deleteDoc(doc(db, 'excel_data', id));
        if (activeTableId === id) {
            activeTableId = null;
            activeName    = '';
            columns       = [];
            rows          = [];
            isDirty       = false;
            unsavedDot.style.display = 'none';
            tblLabel.textContent     = '-- pilih tabel --';
            tableWrap.style.display  = 'none';
            emptyState.style.display = 'flex';
            tblInfo.textContent      = '';
            updateToolbar();
        }
        notify(`'${name}' dihapus.`, 'success');
    } catch (err) {
        notify('Gagal hapus: ' + err.message, 'error');
    }
}

// --- Row / column operations ---
function addRowBelow() {
    if (!activeTableId) { notify('Pilih tabel dulu.', 'warn'); return; }
    rows = getRowsFromDom();
    const today  = new Date().toLocaleDateString('id-ID');
    const newRow = columns.map((_, ci) => ci === 0 ? today : '');
    rows.push(newRow);
    renderTable();
    markDirty();
    tableWrap.scrollTop = tableWrap.scrollHeight;
    notify('1 baris ditambahkan di bawah.', 'success');
}

function addRowAbove() {
    if (!activeTableId) { notify('Pilih tabel dulu.', 'warn'); return; }
    rows = getRowsFromDom();
    const today  = new Date().toLocaleDateString('id-ID');
    const newRow = columns.map((_, ci) => ci === 0 ? today : '');
    rows.unshift(newRow);
    renderTable();
    markDirty();
    notify('1 baris ditambahkan di atas.', 'success');
}

function addColumnRight(name) {
    if (!activeTableId) { notify('Pilih tabel dulu.', 'warn'); return; }
    rows = getRowsFromDom();
    const colName = name || ('Kolom ' + (columns.length + 2));
    columns.push(colName);
    rows = rows.map(r => [...r, '']);
    renderTable();
    markDirty();
    notify(`Kolom '${colName}' ditambahkan di kanan.`, 'success');
}

function addColumnLeft(name) {
    if (!activeTableId) { notify('Pilih tabel dulu.', 'warn'); return; }
    rows = getRowsFromDom();
    const colName = name || ('Kolom ' + (columns.length + 2));
    columns.unshift(colName);
    rows = rows.map(r => ['', ...r]);
    renderTable();
    markDirty();
    notify(`Kolom '${colName}' ditambahkan di kiri.`, 'success');
}

// --- Buttons ---
btnSave.addEventListener('click', saveTable);
btnDel.addEventListener('click', () => {
    if (!activeTableId) return;
    pendingDeleteId = activeTableId;
    cmdHint.textContent = `Hapus tabel '${activeName}'? Ketik YES.`;
    cmdInput.focus();
});

document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        await saveTable();
    }
});

// --- Commands ---
cmdInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const raw   = cmdInput.value.trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    cmdInput.value = '';
    cmdHint.textContent = '';

    if (pendingDeleteId) {
        if (lower === 'yes') {
            const meta = allTables.find(t => t.id === pendingDeleteId);
            await deleteTable(pendingDeleteId, meta?.name || '');
        } else {
            notify('Hapus dibatalkan.', 'warn');
        }
        pendingDeleteId = null;
        return;
    }

    if (lower === 'exit' || lower === 'goto kamus') { window.location.href = 'index.html'; return; }
    if (lower.startsWith('goto ')) {
        const dest = lower.substring(5).trim();
        if (PAGES[dest]) { window.location.href = PAGES[dest]; }
        else notify(`Halaman '${dest}' tidak ada.`, 'error');
        return;
    }

    if (lower === 'ls') {
        if (!allTables.length) { notify('Belum ada tabel.', 'warn'); return; }
        notify(allTables.map((t, i) => `${i+1}. ${t.name} (${t.row_count || 0}r × ${t.col_count || 0}k)`).join('\n'), 'success');
        return;
    }

    if (lower === 'save') { await saveTable(); return; }

    if (lower === 'add row below')  { addRowBelow();  return; }
    if (lower === 'add row above')  { addRowAbove();  return; }
    if (lower.startsWith('add row right')) {
        const name = raw.substring('add row right'.length).trim();
        addColumnRight(name || null);
        return;
    }
    if (lower.startsWith('add row left')) {
        const name = raw.substring('add row left'.length).trim();
        addColumnLeft(name || null);
        return;
    }

    if (lower.startsWith('cd ')) {
        const name = raw.substring(3).trim();
        const found = allTables.find(t => t.name.toLowerCase() === name.toLowerCase())
            || allTables.find(t => t.name.toLowerCase().startsWith(name.toLowerCase()));
        if (!found) { notify(`Tabel '${name}' tidak ditemukan. Ketik ls.`, 'error'); return; }
        openTable(found);
        return;
    }

    if (lower.startsWith('rm ')) {
        const name = raw.substring(3).trim();
        const found = allTables.find(t => t.name.toLowerCase() === name.toLowerCase())
            || allTables.find(t => t.name.toLowerCase().startsWith(name.toLowerCase()));
        if (!found) { notify(`Tabel '${name}' tidak ditemukan.`, 'error'); return; }
        pendingDeleteId = found.id;
        cmdHint.textContent = `Hapus tabel '${found.name}'? Ketik YES.`;
        return;
    }

    if (lower.startsWith('add ')) {
        const name = raw.substring(4).trim();
        if (!name) { notify('Ketik: add <nama tabel>', 'warn'); return; }
        if (allTables.find(t => t.name.toLowerCase() === name.toLowerCase())) {
            notify(`Tabel '${name}' sudah ada. Gunakan: cd ${name}`, 'warn');
            return;
        }
        await createTable(name);
        return;
    }

    notify('Perintah: add <nama> · cd <nama> · rm <nama> · ls · save · add row above/below/right/left', 'warn');
});

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
