import { db, authReady } from './firebase-config.js';
import {
    collection, doc, addDoc, setDoc, deleteDoc,
    query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const PASSWORD = 'zasha';
let activeNoteId = null;
let isSaved = true;

const lockScreen    = document.getElementById('lock-screen');
const appDiv        = document.getElementById('app');
const passInput     = document.getElementById('pass-input');
const lockError     = document.getElementById('lock-error');
const notesList     = document.getElementById('notes-list');
const noteCount     = document.getElementById('note-count');
const emptyEditor   = document.getElementById('empty-editor');
const editorForm    = document.getElementById('editor-form');
const titleInput    = document.getElementById('note-title-input');
const contentInput  = document.getElementById('note-content-input');
const statusEl      = document.getElementById('editor-status');

// --- Login ---
passInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    if (passInput.value === PASSWORD) {
        lockScreen.style.display = 'none';
        appDiv.style.display = 'flex';
        await authReady;
        listenNotes();
    } else {
        lockError.style.display = 'block';
        passInput.value = '';
    }
});

// --- Realtime list ---
function listenNotes() {
    const q = query(collection(db, 'notes'), orderBy('updated_at', 'desc'));
    onSnapshot(q, snap => {
        const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderList(notes);
    });
}

function renderList(notes) {
    noteCount.textContent = notes.length;
    notesList.innerHTML = '';

    if (notes.length === 0) {
        notesList.innerHTML = '<div id="empty-list" style="color:#003300;font-size:12px;padding:15px 12px;text-shadow:none;">Belum ada catatan.</div>';
        return;
    }

    notes.forEach(note => {
        const item = document.createElement('div');
        item.className = 'note-item' + (note.id === activeNoteId ? ' active' : '');
        item.dataset.id = note.id;

        const date = note.updated_at?.toDate?.()
            ?.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }) || '--';
        const preview = (note.content || '').replace(/\n/g, ' ').substring(0, 60);

        item.innerHTML = `
            <div class="ni-title">${escHtml(note.title || '(tanpa judul)')}</div>
            <div class="ni-preview">${escHtml(preview)}</div>
            <div class="ni-date">${date}</div>
        `;
        item.addEventListener('click', () => openNote(note));
        notesList.appendChild(item);
    });
}

function openNote(note) {
    activeNoteId = note.id;
    titleInput.value   = note.title || '';
    contentInput.value = note.content || '';
    isSaved = true;
    setStatus('Tersimpan.');
    showEditor();
    document.querySelectorAll('.note-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === note.id);
    });
    contentInput.focus();
}

// --- New note ---
document.getElementById('btn-new').addEventListener('click', newNote);

function newNote() {
    activeNoteId = null;
    titleInput.value = '';
    contentInput.value = '';
    isSaved = false;
    setStatus('Note baru — belum disimpan.');
    showEditor();
    document.querySelectorAll('.note-item').forEach(el => el.classList.remove('active'));
    titleInput.focus();
}

function showEditor() {
    emptyEditor.style.display = 'none';
    editorForm.style.display = 'flex';
}

// --- Save ---
async function saveNote() {
    const title   = titleInput.value.trim() || '(tanpa judul)';
    const content = contentInput.value;
    if (!content.trim() && title === '(tanpa judul)') return;

    const data = { title, content, updated_at: serverTimestamp() };

    if (activeNoteId) {
        await setDoc(doc(db, 'notes', activeNoteId), data, { merge: true });
    } else {
        const ref = await addDoc(collection(db, 'notes'), data);
        activeNoteId = ref.id;
    }

    isSaved = true;
    setStatus('Tersimpan pada ' + new Date().toLocaleTimeString('id-ID'));
}

// --- Delete ---
async function deleteNote() {
    if (!activeNoteId) { newNote(); return; }
    if (!confirm('Hapus catatan ini?')) return;
    await deleteDoc(doc(db, 'notes', activeNoteId));
    activeNoteId = null;
    titleInput.value = '';
    contentInput.value = '';
    emptyEditor.style.display = 'flex';
    editorForm.style.display = 'none';
    setStatus('--');
}

document.getElementById('btn-save').addEventListener('click', saveNote);
document.getElementById('btn-delete').addEventListener('click', deleteNote);

// --- Track unsaved changes ---
[titleInput, contentInput].forEach(el => {
    el.addEventListener('input', () => {
        if (isSaved) {
            isSaved = false;
            setStatus('Belum disimpan...');
        }
    });
});

// --- Keyboard shortcuts ---
document.addEventListener('keydown', async (e) => {
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (editorForm.style.display !== 'none') await saveNote();
    }
    if (e.key === 'Escape') {
        if (!isSaved && !confirm('Perubahan belum disimpan. Lanjutkan?')) return;
        if (activeNoteId) {
            isSaved = true;
            setStatus('Dibatalkan.');
        }
    }
});

function setStatus(msg) { statusEl.textContent = msg; }

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
