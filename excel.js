import { db, authReady } from './firebase-config.js';
import {
    collection, doc, addDoc, getDoc, getDocs, deleteDoc,
    query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const PASSWORD  = 'zasha';
const MAX_ROWS  = 500;

// State
let currentHeaders = [];
let currentRows    = [];
let currentFileId  = null;   // id dokumen Firestore yang sedang ditampilkan
let pendingUpload  = false;  // true = data dari upload, belum disimpan

// DOM
const lockScreen  = document.getElementById('lock-screen');
const appDiv      = document.getElementById('app');
const passInput   = document.getElementById('pass-input');
const lockError   = document.getElementById('lock-error');
const filesList   = document.getElementById('files-list');
const fileCount   = document.getElementById('file-count');
const fileLabel   = document.getElementById('file-label');
const rowInfo     = document.getElementById('row-info');
const uploadZone  = document.getElementById('upload-zone');
const tableWrap   = document.getElementById('table-wrap');
const dataTable   = document.getElementById('data-table');
const statusBar   = document.getElementById('status-bar');
const fileInput   = document.getElementById('file-input');
const dropArea    = document.getElementById('drop-area');

const btnUpload   = document.getElementById('btn-upload-new');
const btnSaveDb   = document.getElementById('btn-save-db');
const btnDlXlsx   = document.getElementById('btn-dl-xlsx');
const btnDlCsv    = document.getElementById('btn-dl-csv');
const btnDelDb    = document.getElementById('btn-del-db');

// --- Login ---
passInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    if (passInput.value === PASSWORD) {
        lockScreen.style.display = 'none';
        appDiv.style.display = 'flex';
        await authReady;
        loadFileList();
    } else {
        lockError.style.display = 'block';
        passInput.value = '';
    }
});

// --- Load saved file list ---
async function loadFileList() {
    const q = query(collection(db, 'excel_data'), orderBy('uploaded_at', 'desc'));
    const snap = await getDocs(q);
    const files = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFileList(files);
}

function renderFileList(files) {
    fileCount.textContent = files.length;
    filesList.innerHTML = '';

    if (files.length === 0) {
        filesList.innerHTML = '<div id="empty-files" style="color:#003300;font-size:12px;padding:12px;text-shadow:none;">Belum ada file tersimpan.</div>';
        return;
    }

    files.forEach(f => {
        const item = document.createElement('div');
        item.className = 'file-item' + (f.id === currentFileId ? ' active' : '');
        item.dataset.id = f.id;

        const date = f.uploaded_at?.toDate?.()
            ?.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }) || '--';

        item.innerHTML = `
            <div class="fi-name">${escHtml(f.filename)}</div>
            <div class="fi-meta">${f.row_count} baris · ${f.col_count} kolom · ${date}</div>
        `;
        item.addEventListener('click', () => openSavedFile(f));
        filesList.appendChild(item);
    });
}

// --- Open saved file from Firestore ---
async function openSavedFile(fileMeta) {
    setStatus('[LOAD] Mengambil data dari Firestore...');
    const snap = await getDoc(doc(db, 'excel_data', fileMeta.id));
    if (!snap.exists()) { setStatus('[ERROR] File tidak ditemukan.'); return; }

    const data = snap.data();
    currentHeaders  = data.headers || [];
    currentRows     = JSON.parse(data.rows_json || '[]');
    currentFileId   = fileMeta.id;
    pendingUpload   = false;

    fileLabel.textContent = data.filename;
    rowInfo.textContent   = `${currentRows.length} baris · ${currentHeaders.length} kolom`;

    renderTable(currentHeaders, currentRows);
    showTableButtons(false); // false = bukan pending upload, tampilkan btn DEL bukan SAVE
    setStatus(`[OK] '${data.filename}' dimuat. ${currentRows.length} baris.`);

    document.querySelectorAll('.file-item').forEach(el =>
        el.classList.toggle('active', el.dataset.id === fileMeta.id)
    );
}

// --- Upload button ---
btnUpload.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) processFile(e.target.files[0]);
    e.target.value = '';
});

// --- Drag & drop ---
dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('dragover'); });
dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
});

// --- Process uploaded file with SheetJS ---
function processFile(file) {
    setStatus(`[PARSE] Memproses '${file.name}'...`);
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheet    = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

            if (!jsonData.length) { setStatus('[ERROR] File kosong.'); return; }

            currentHeaders  = jsonData[0].map(String);
            currentRows     = jsonData.slice(1).map(row =>
                currentHeaders.map((_, i) => String(row[i] ?? ''))
            );
            currentFileId   = null;
            pendingUpload   = true;

            let warning = '';
            if (currentRows.length > MAX_ROWS) {
                warning = ` [WARN] Dipotong ke ${MAX_ROWS} baris untuk Firestore.`;
                currentRows = currentRows.slice(0, MAX_ROWS);
            }

            fileLabel.textContent = file.name;
            rowInfo.textContent   = `${currentRows.length} baris · ${currentHeaders.length} kolom`;

            renderTable(currentHeaders, currentRows);
            showTableButtons(true); // true = pending upload, tampilkan btn SAVE
            setStatus(`[OK] '${file.name}' — ${currentRows.length} baris, ${currentHeaders.length} kolom.${warning}`);

            document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
        } catch (err) {
            setStatus(`[ERROR] Gagal parse file: ${err.message}`);
        }
    };
    reader.readAsBinaryString(file);
}

// --- Save to Firestore ---
btnSaveDb.addEventListener('click', async () => {
    if (!pendingUpload || !currentHeaders.length) return;

    const filename = fileLabel.textContent;
    setStatus('[SAVE] Menyimpan ke Firestore...');
    btnSaveDb.disabled = true;

    try {
        const ref = await addDoc(collection(db, 'excel_data'), {
            filename,
            headers:     currentHeaders,
            rows_json:   JSON.stringify(currentRows),
            row_count:   currentRows.length,
            col_count:   currentHeaders.length,
            uploaded_at: serverTimestamp()
        });

        currentFileId = ref.id;
        pendingUpload = false;
        showTableButtons(false);
        setStatus(`[OK] Tersimpan ke Firestore.`);
        await loadFileList();
    } catch (err) {
        setStatus(`[ERROR] Gagal simpan: ${err.message}`);
    }
    btnSaveDb.disabled = false;
});

// --- Delete from Firestore ---
btnDelDb.addEventListener('click', async () => {
    if (!currentFileId) return;
    if (!confirm(`Hapus '${fileLabel.textContent}' dari Firestore?`)) return;
    await deleteDoc(doc(db, 'excel_data', currentFileId));

    currentHeaders = [];
    currentRows    = [];
    currentFileId  = null;
    pendingUpload  = false;

    fileLabel.textContent = '-- tidak ada file --';
    rowInfo.textContent   = '';
    showUploadZone();
    setStatus('[OK] File dihapus.');
    await loadFileList();
});

// --- Download XLSX ---
btnDlXlsx.addEventListener('click', () => {
    if (!currentHeaders.length) return;
    const ws = XLSX.utils.aoa_to_sheet([currentHeaders, ...currentRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const name = (fileLabel.textContent || 'data').replace(/\.[^.]+$/, '') + '.xlsx';
    XLSX.writeFile(wb, name);
    setStatus(`[DL] Download '${name}' selesai.`);
});

// --- Download CSV ---
btnDlCsv.addEventListener('click', () => {
    if (!currentHeaders.length) return;
    const ws  = XLSX.utils.aoa_to_sheet([currentHeaders, ...currentRows]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = (fileLabel.textContent || 'data').replace(/\.[^.]+$/, '') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`[DL] Download CSV selesai.`);
});

// --- Render table ---
function renderTable(headers, rows) {
    uploadZone.style.display = 'none';
    tableWrap.style.display  = 'block';

    const thead = document.createElement('thead');
    const hrow  = document.createElement('tr');
    // Row number column
    const thNum = document.createElement('th');
    thNum.textContent = '#';
    hrow.appendChild(thNum);
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        hrow.appendChild(th);
    });
    thead.appendChild(hrow);

    const tbody = document.createElement('tbody');
    rows.forEach((row, i) => {
        const tr = document.createElement('tr');
        const tdNum = document.createElement('td');
        tdNum.textContent = i + 1;
        tdNum.style.color = '#004400';
        tr.appendChild(tdNum);
        row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    dataTable.innerHTML = '';
    dataTable.appendChild(thead);
    dataTable.appendChild(tbody);
}

// --- UI helpers ---
function showTableButtons(isPending) {
    btnSaveDb.style.display = isPending ? 'inline-block' : 'none';
    btnDelDb.style.display  = !isPending && currentFileId ? 'inline-block' : 'none';
    btnDlXlsx.style.display = 'inline-block';
    btnDlCsv.style.display  = 'inline-block';
}

function showUploadZone() {
    tableWrap.style.display  = 'none';
    uploadZone.style.display = 'flex';
    btnSaveDb.style.display  = 'none';
    btnDelDb.style.display   = 'none';
    btnDlXlsx.style.display  = 'none';
    btnDlCsv.style.display   = 'none';
}

function setStatus(msg) { statusBar.textContent = msg; }

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
