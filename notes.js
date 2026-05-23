import { db, authReady } from './firebase-config.js';
import { notify } from './notify.js';
import {
    collection, doc, addDoc, setDoc, deleteDoc,
    query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const PASSWORD = 'zasha';
const PAGES    = { kamus: 'index.html', todo: 'todo.html', excel: 'excel.html' };

let allNotes      = [];
let activeNoteId  = null;
let pendingDelete = null;   // { id, title } — waiting for 'yes' confirmation

const lockScreen   = document.getElementById('lock-screen');
const appDiv       = document.getElementById('app');
const passInput    = document.getElementById('pass-input');
const lockError    = document.getElementById('lock-error');
const notesList    = document.getElementById('notes-list');
const noteCount    = document.getElementById('note-count');
const emptyEditor  = document.getElementById('empty-editor');
const editorForm   = document.getElementById('editor-form');
const titleInput   = document.getElementById('note-title-input');
const contentInput = document.getElementById('note-content-input');
const cmdInput     = document.getElementById('cmd-input');
const cmdHint      = document.getElementById('cmd-hint');

// ── Login ──────────────────────────────────────────────────────────────
passInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    if (passInput.value === PASSWORD) {
        lockScreen.style.display = 'none';
        appDiv.style.display = 'flex';
        cmdInput.focus();
        await authReady;
        listenNotes();
    } else {
        lockError.style.display = 'block';
        passInput.value = '';
    }
});

// ── Realtime sync ──────────────────────────────────────────────────────
function listenNotes() {
    const q = query(collection(db, 'notes'), orderBy('updated_at', 'desc'));
    onSnapshot(q, snap => {
        allNotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderList();
    });
}

function renderList() {
    noteCount.textContent = allNotes.length;
    notesList.innerHTML = '';
    if (allNotes.length === 0) {
        notesList.innerHTML = '<div style="color:#003300;font-size:12px;padding:12px;text-shadow:none;">Belum ada catatan.<br>Ketik: add &lt;judul&gt;</div>';
        return;
    }
    allNotes.forEach(note => {
        const item = document.createElement('div');
        item.className = 'note-item' + (note.id === activeNoteId ? ' active' : '');
        item.dataset.id = note.id;
        const date = note.updated_at?.toDate?.()
            ?.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) || '--';
        item.innerHTML = `
            <div class="ni-title">${escHtml(note.title || '(tanpa judul)')}</div>
            <div class="ni-date">${date}</div>
        `;
        notesList.appendChild(item);
    });
}

// ── Command handler ────────────────────────────────────────────────────
cmdInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const raw = cmdInput.value.trim();
    if (!raw) return;
    cmdInput.value = '';
    cmdHint.textContent = '';

    const lower = raw.toLowerCase();

    // ── Confirm delete ──
    if (pendingDelete) {
        if (lower === 'yes') {
            await doDelete(pendingDelete);
        } else {
            notify('Hapus dibatalkan.', 'warn');
        }
        pendingDelete = null;
        cmdHint.textContent = '';
        return;
    }

    // ── goto / exit ──
    if (lower === 'exit' || lower === 'goto kamus') {
        window.location.href = 'index.html'; return;
    }
    if (lower.startsWith('goto ')) {
        const dest = lower.substring(5).trim();
        if (PAGES[dest]) { window.location.href = PAGES[dest]; }
        else notify(`Halaman '${dest}' tidak ada. Tersedia: kamus, todo, excel`, 'error');
        return;
    }

    // ── ls ──
    if (lower === 'ls') {
        if (allNotes.length === 0) { notify('Belum ada catatan.', 'warn'); return; }
        notify('Notes: ' + allNotes.map(n => n.title).join(', '), 'success');
        return;
    }

    // ── add <judul> ──
    if (lower.startsWith('add ') || lower === 'add') {
        const title = raw.substring(4).trim();
        if (!title) { notify('Ketik: add <judul>', 'warn'); return; }
        openEditor(null, title);
        return;
    }

    // ── rm <judul> ──
    if (lower.startsWith('rm ') || lower === 'rm') {
        const title = raw.substring(3).trim();
        if (!title) { notify('Ketik: rm <judul>', 'warn'); return; }
        const found = findNote(title);
        if (!found) { notify(`Note '${title}' tidak ditemukan.`, 'error'); return; }
        pendingDelete = found;
        cmdHint.textContent = `Hapus '${found.title}'? Ketik YES untuk konfirmasi.`;
        return;
    }

    // ── buka note by nama ──
    const found = findNote(lower);
    if (found) {
        openNote(found);
    } else {
        notify(`'${raw}' tidak ditemukan. Ketik 'ls' untuk daftar.`, 'error');
    }
});

// ── Cari note (exact dulu, lalu startswith) ────────────────────────────
function findNote(query) {
    const q = query.toLowerCase();
    return allNotes.find(n => n.title.toLowerCase() === q)
        || allNotes.find(n => n.title.toLowerCase().startsWith(q))
        || null;
}

// ── Buka note ──────────────────────────────────────────────────────────
function openNote(note) {
    activeNoteId       = note.id;
    titleInput.value   = note.title || '';
    contentInput.value = note.content || '';
    showEditor();
    renderList();
    contentInput.focus();
}

// ── Buka editor kosong (new note) ──────────────────────────────────────
function openEditor(id, title) {
    activeNoteId       = id;
    titleInput.value   = title || '';
    contentInput.value = '';
    showEditor();
    renderList();
    contentInput.focus();
}

function showEditor() {
    emptyEditor.style.display = 'none';
    editorForm.style.display  = 'flex';
}

function closeEditor() {
    emptyEditor.style.display = 'flex';
    editorForm.style.display  = 'none';
    activeNoteId = null;
    renderList();
    cmdInput.focus();
}

// ── Save ───────────────────────────────────────────────────────────────
async function saveNote() {
    const title   = titleInput.value.trim() || '(tanpa judul)';
    const content = contentInput.value;
    if (!content.trim() && title === '(tanpa judul)') { notify('Catatan kosong.', 'warn'); return; }

    const data = { title, content, updated_at: serverTimestamp() };
    try {
        if (activeNoteId) {
            await setDoc(doc(db, 'notes', activeNoteId), data, { merge: true });
        } else {
            const ref  = await addDoc(collection(db, 'notes'), data);
            activeNoteId = ref.id;
        }
        notify(`'${title}' tersimpan.`, 'success');
    } catch (err) {
        notify('Gagal simpan: ' + err.message, 'error');
    }
}

// ── Delete ─────────────────────────────────────────────────────────────
async function doDelete(note) {
    try {
        await deleteDoc(doc(db, 'notes', note.id));
        if (activeNoteId === note.id) closeEditor();
        notify(`'${note.title}' dihapus.`, 'success');
    } catch (err) {
        notify('Gagal hapus: ' + err.message, 'error');
    }
}

// ── Button & keyboard ──────────────────────────────────────────────────
document.getElementById('btn-save').addEventListener('click', saveNote);

document.addEventListener('keydown', async (e) => {
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (editorForm.style.display !== 'none') await saveNote();
    }
    if (e.key === 'Escape' && editorForm.style.display !== 'none') {
        closeEditor();
    }
    // TAB dari editor → fokus ke command input
    if (e.key === 'Tab' && document.activeElement === contentInput) {
        e.preventDefault();
        cmdInput.focus();
    }
});

// Klik sidebar item → buka note
notesList.addEventListener('click', (e) => {
    const item = e.target.closest('.note-item');
    if (!item) return;
    const note = allNotes.find(n => n.id === item.dataset.id);
    if (note) openNote(note);
});

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
