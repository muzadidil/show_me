import { db, authReady } from './firebase-config.js';
import { notify } from './notify.js';
import {
    collection, doc, addDoc, updateDoc, deleteDoc,
    query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const PASSWORD = 'zasha';
const PAGES    = { kamus: 'index.html', notes: 'notes.html', excel: 'excel.html' };

const lockScreen  = document.getElementById('lock-screen');
const appDiv      = document.getElementById('app');
const passInput   = document.getElementById('pass-input');
const lockError   = document.getElementById('lock-error');
const sidebarList = document.getElementById('todo-sidebar-list');
const countAll    = document.getElementById('count-all');
const statPending = document.getElementById('stat-pending');
const statDone    = document.getElementById('stat-done');
const clockEl     = document.getElementById('clock');
const dateEl      = document.getElementById('date-display');
const cmdInput    = document.getElementById('cmd-input');
const cmdHint     = document.getElementById('cmd-hint');

let allTodos        = [];
let pendingDeleteId = null;

// --- Clock ---
function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    dateEl.textContent  = now.toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}
setInterval(updateClock, 1000);
updateClock();

// --- Login ---
passInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    if (passInput.value === PASSWORD) {
        lockScreen.style.display = 'none';
        appDiv.style.display = 'flex';
        cmdInput.focus();
        await authReady;
        listenTodos();
    } else {
        lockError.style.display = 'block';
        passInput.value = '';
    }
});

// --- Realtime listener ---
function listenTodos() {
    const q = query(collection(db, 'todos'), orderBy('created_at', 'asc'));
    onSnapshot(q, snap => {
        allTodos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSidebar();
    });
}

function renderSidebar() {
    const pending = allTodos.filter(t => !t.completed).length;
    const done    = allTodos.filter(t =>  t.completed).length;
    countAll.textContent    = allTodos.length;
    statPending.textContent = pending;
    statDone.textContent    = done;

    sidebarList.innerHTML = '';
    if (allTodos.length === 0) {
        sidebarList.innerHTML = '<div style="color:#002200;font-size:12px;padding:12px;text-shadow:none;">Belum ada task.</div>';
        return;
    }
    allTodos.forEach(todo => {
        const item = document.createElement('div');
        item.className = 'ts-item' + (todo.completed ? ' done' : '');
        item.innerHTML = `
            <span class="ts-check">${todo.completed ? '[X]' : '[ ]'}</span>
            <span class="ts-text">${escHtml(todo.text)}</span>
            <span class="ts-del">[X]</span>
        `;
        item.querySelector('.ts-check').addEventListener('click', () => toggleTodo(todo.id, todo.completed));
        item.querySelector('.ts-text').addEventListener('click',  () => toggleTodo(todo.id, todo.completed));
        item.querySelector('.ts-del').addEventListener('click',   () => {
            pendingDeleteId = todo.id;
            cmdHint.textContent = `Hapus '${todo.text}'? Ketik YES.`;
            cmdInput.focus();
        });
        sidebarList.appendChild(item);
    });
}

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
            const todo = allTodos.find(t => t.id === pendingDeleteId);
            await deleteDoc(doc(db, 'todos', pendingDeleteId));
            notify(`'${todo?.text || 'task'}' dihapus.`, 'success');
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
        if (!allTodos.length) { notify('Belum ada task.', 'warn'); return; }
        notify(allTodos.map((t, i) => `${i+1}. ${t.completed ? '[X]' : '[ ]'} ${t.text}`).join('\n'), 'success');
        return;
    }

    if (lower === 'clear') {
        const done = allTodos.filter(t => t.completed);
        if (!done.length) { notify('Tidak ada task selesai untuk dihapus.', 'warn'); return; }
        for (const t of done) await deleteDoc(doc(db, 'todos', t.id));
        notify(`${done.length} task selesai dihapus.`, 'success');
        return;
    }

    if (lower.startsWith('done ')) {
        const q = raw.substring(5).trim().toLowerCase();
        const found = allTodos.find(t => t.text.toLowerCase().includes(q) && !t.completed);
        if (!found) { notify(`Task '${q}' tidak ditemukan.`, 'error'); return; }
        await updateDoc(doc(db, 'todos', found.id), { completed: true });
        notify(`'${found.text}' selesai.`, 'success');
        return;
    }

    if (lower.startsWith('rm ')) {
        const q = raw.substring(3).trim().toLowerCase();
        const found = allTodos.find(t => t.text.toLowerCase().includes(q));
        if (!found) { notify(`Task '${q}' tidak ditemukan.`, 'error'); return; }
        pendingDeleteId = found.id;
        cmdHint.textContent = `Hapus '${found.text}'? Ketik YES.`;
        return;
    }

    await addDoc(collection(db, 'todos'), {
        text: raw, completed: false, created_at: serverTimestamp()
    });
    notify('Task ditambahkan.', 'success');
});

async function toggleTodo(id, current) {
    await updateDoc(doc(db, 'todos', id), { completed: !current });
}

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
