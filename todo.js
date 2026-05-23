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
const todoListEl  = document.getElementById('todo-list');
const todoInput   = document.getElementById('todo-input');
const countPend   = document.getElementById('count-pending');
const countDone   = document.getElementById('count-done');
const clockEl     = document.getElementById('clock');
const dateEl      = document.getElementById('date-display');

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
        appDiv.style.display = 'block';
        todoInput.focus();
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
        const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTodos(todos);
    });
}

// --- Render ---
function renderTodos(todos) {
    countPend.textContent = todos.filter(t => !t.completed).length;
    countDone.textContent = todos.filter(t => t.completed).length;

    todoListEl.innerHTML = '';
    if (todos.length === 0) {
        todoListEl.innerHTML = '<div style="color:#003300;text-shadow:none;padding:15px 5px;font-size:13px;">Belum ada task. Ketik sesuatu di bawah dan tekan Enter.</div>';
        return;
    }

    todos.forEach(todo => {
        const row = document.createElement('div');
        row.className = 'todo-item';
        row.innerHTML = `
            <span class="todo-check">${todo.completed ? '[X]' : '[ ]'}</span>
            <span class="todo-text ${todo.completed ? 'done' : ''}">${escHtml(todo.text)}</span>
            <span class="todo-del">[DEL]</span>
        `;
        row.querySelector('.todo-check').addEventListener('click', () => toggleTodo(todo.id, todo.completed));
        row.querySelector('.todo-text').addEventListener('click',  () => toggleTodo(todo.id, todo.completed));
        row.querySelector('.todo-del').addEventListener('click',   () => deleteTodo(todo.id, todo.text));
        todoListEl.appendChild(row);
    });
}

// --- Input: tambah task atau command ---
todoInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const raw   = todoInput.value.trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    todoInput.value = '';

    // ── navigasi ──
    if (lower === 'exit' || lower === 'goto kamus') {
        window.location.href = 'index.html'; return;
    }
    if (lower.startsWith('goto ')) {
        const dest = lower.substring(5).trim();
        if (PAGES[dest]) { window.location.href = PAGES[dest]; }
        else notify(`Halaman '${dest}' tidak ada. Tersedia: kamus, notes, excel`, 'error');
        return;
    }

    // ── tambah task ──
    await addDoc(collection(db, 'todos'), {
        text:       raw,
        completed:  false,
        created_at: serverTimestamp()
    });
    notify(`Task ditambahkan.`, 'success');
});

// --- Toggle & Delete ---
async function toggleTodo(id, current) {
    await updateDoc(doc(db, 'todos', id), { completed: !current });
}

async function deleteTodo(id, text) {
    await deleteDoc(doc(db, 'todos', id));
    notify(`'${text}' dihapus.`, 'success');
}

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
