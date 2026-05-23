import { db, authReady } from './firebase-config.js';
import { notify } from './notify.js';
import {
    collection, doc, addDoc, setDoc, deleteDoc,
    query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const PASSWORD = 'zasha';
const PAGES    = { kamus: 'index.html', notes: 'notes.html', excel: 'excel.html' };

// DOM
const lockScreen  = document.getElementById('lock-screen');
const appDiv      = document.getElementById('app');
const passInput   = document.getElementById('pass-input');
const lockError   = document.getElementById('lock-error');
const todoLists   = document.getElementById('todo-lists');
const listCount   = document.getElementById('list-count');
const todoLabel   = document.getElementById('todo-label');
const todoInfo    = document.getElementById('todo-info');
const todoClock   = document.getElementById('todo-clock');
const tableWrap   = document.getElementById('table-wrap');
const todoTable   = document.getElementById('todo-table');
const emptyState  = document.getElementById('empty-state');
const cmdInput    = document.getElementById('cmd-input');
const cmdHint     = document.getElementById('cmd-hint');
const btnDelList  = document.getElementById('btn-del-list');

// State
let allLists        = [];
let activeListId    = null;
let activeName      = '';
let items           = [];   // [{keterangan, status}]
let pendingDeleteId = null;

// --- Clock ---
function updateClock() {
    todoClock.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false });
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
        listenLists();
    } else {
        lockError.style.display = 'block';
        passInput.value = '';
    }
});

// --- Realtime listener ---
function listenLists() {
    const q = query(collection(db, 'todo_lists'), orderBy('updated_at', 'desc'));
    onSnapshot(q, snap => {
        allLists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSidebar();
    });
}

function renderSidebar() {
    listCount.textContent = allLists.length;
    todoLists.innerHTML = '';
    if (allLists.length === 0) {
        todoLists.innerHTML = '<div style="color:#002200;font-size:12px;padding:12px;text-shadow:none;">Ketik: todo &lt;nama&gt;</div>';
        return;
    }
    allLists.forEach(list => {
        const item = document.createElement('div');
        item.className = 'tl-item' + (list.id === activeListId ? ' active' : '');
        const total   = list.items?.length || 0;
        const selesai = list.items?.filter(i => i.status === 'selesai').length || 0;
        item.innerHTML = `
            <div class="tl-name">${escHtml(list.name)}</div>
            <div class="tl-meta">${total} item &middot; ${selesai} selesai</div>
        `;
        item.addEventListener('click', () => openList(list));
        todoLists.appendChild(item);
    });
}

// --- Open list ---
function openList(meta) {
    activeListId = meta.id;
    activeName   = meta.name;
    items        = Array.isArray(meta.items) ? meta.items.map(i => ({ ...i })) : [];
    todoLabel.textContent = meta.name;
    renderTable();
    btnDelList.style.display = 'inline-block';
    renderSidebar();
    notify(`'${meta.name}' dibuka.`, 'success');
}

// --- Render table ---
function renderTable() {
    emptyState.style.display = 'none';
    tableWrap.style.display  = 'block';

    const thead = document.createElement('thead');
    const hrow  = document.createElement('tr');
    ['No', 'Keterangan', 'Status'].forEach((h, i) => {
        const th = document.createElement('th');
        th.textContent = h;
        if (i === 0) th.className = 'th-no';
        hrow.appendChild(th);
    });
    thead.appendChild(hrow);

    const tbody = document.createElement('tbody');
    items.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'row-' + (item.status || 'pending');

        const tdNo = document.createElement('td');
        tdNo.className   = 'td-no';
        tdNo.textContent = idx + 1;
        tr.appendChild(tdNo);

        const tdKet = document.createElement('td');
        tdKet.className   = 'td-ket';
        tdKet.textContent = item.keterangan;
        tr.appendChild(tdKet);

        const tdStatus = document.createElement('td');
        tdStatus.className   = 'td-status';
        tdStatus.textContent = (item.status || 'pending').toUpperCase();
        tr.appendChild(tdStatus);

        tbody.appendChild(tr);
    });

    todoTable.innerHTML = '';
    todoTable.appendChild(thead);
    todoTable.appendChild(tbody);
    updateInfo();
}

function updateInfo() {
    const total   = items.length;
    const selesai = items.filter(i => i.status === 'selesai').length;
    const pending = items.filter(i => i.status === 'pending').length;
    const batal   = items.filter(i => i.status === 'batal').length;
    todoInfo.textContent = `${total} item · ${selesai} selesai · ${pending} pending · ${batal} batal`;
}

// --- Save to Firestore ---
async function saveItems() {
    if (!activeListId) return;
    try {
        await setDoc(doc(db, 'todo_lists', activeListId), {
            name:       activeName,
            items,
            updated_at: serverTimestamp()
        });
    } catch (err) {
        notify('Gagal simpan: ' + err.message, 'error');
    }
}

// --- Create new list ---
async function createList(name) {
    try {
        const ref = await addDoc(collection(db, 'todo_lists'), {
            name,
            items:      [],
            updated_at: serverTimestamp()
        });
        activeListId = ref.id;
        activeName   = name;
        items        = [];
        todoLabel.textContent = name;
        renderTable();
        btnDelList.style.display = 'inline-block';
        notify(`Todo '${name}' dibuat.`, 'success');
    } catch (err) {
        notify('Gagal buat todo: ' + err.message, 'error');
    }
}

// --- Delete list ---
async function deleteList(id, name) {
    try {
        await deleteDoc(doc(db, 'todo_lists', id));
        if (activeListId === id) {
            activeListId = null;
            activeName   = '';
            items        = [];
            todoLabel.textContent    = '-- pilih todo --';
            todoInfo.textContent     = '';
            tableWrap.style.display  = 'none';
            emptyState.style.display = 'flex';
            btnDelList.style.display = 'none';
        }
        notify(`'${name}' dihapus.`, 'success');
    } catch (err) {
        notify('Gagal hapus: ' + err.message, 'error');
    }
}

// --- Commands ---
cmdInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const raw   = cmdInput.value.trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    cmdInput.value = '';
    cmdHint.textContent = '';

    // Pending delete confirm
    if (pendingDeleteId) {
        if (lower === 'yes') {
            const list = allLists.find(l => l.id === pendingDeleteId);
            await deleteList(pendingDeleteId, list?.name || '');
        } else {
            notify('Hapus dibatalkan.', 'warn');
        }
        pendingDeleteId = null;
        return;
    }

    // Navigation
    if (lower === 'exit' || lower === 'goto kamus') { window.location.href = 'index.html'; return; }
    if (lower.startsWith('goto ')) {
        const dest = lower.substring(5).trim();
        if (PAGES[dest]) { window.location.href = PAGES[dest]; }
        else notify(`Halaman '${dest}' tidak ada.`, 'error');
        return;
    }

    // ls
    if (lower === 'ls') {
        if (!allLists.length) { notify('Belum ada todo list.', 'warn'); return; }
        notify(allLists.map((l, i) => `${i+1}. ${l.name} (${l.items?.length || 0} item)`).join('\n'), 'success');
        return;
    }

    // todo <nama> — buat/buka list
    if (lower.startsWith('todo ')) {
        const name = raw.substring(5).trim();
        if (!name) { notify('Ketik: todo <nama>', 'warn'); return; }
        const exists = allLists.find(l => l.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            openList(exists);
        } else {
            await createList(name);
        }
        return;
    }

    // cd <nama> — buka list
    if (lower.startsWith('cd ')) {
        const name = raw.substring(3).trim();
        const found = allLists.find(l => l.name.toLowerCase() === name.toLowerCase())
            || allLists.find(l => l.name.toLowerCase().startsWith(name.toLowerCase()));
        if (!found) { notify(`Todo '${name}' tidak ditemukan. Ketik ls.`, 'error'); return; }
        openList(found);
        return;
    }

    // add todo <keterangan>
    if (lower.startsWith('add todo ')) {
        const ket = raw.substring(9).trim();
        if (!ket) { notify('Ketik: add todo <keterangan>', 'warn'); return; }
        if (!activeListId) { notify('Buka todo list dulu. Ketik: cd <nama>', 'warn'); return; }
        items.push({ keterangan: ket, status: 'pending' });
        renderTable();
        await saveItems();
        tableWrap.scrollTop = tableWrap.scrollHeight;
        notify('Item ditambahkan.', 'success');
        return;
    }

    // finish <no>
    if (lower.startsWith('finish ')) {
        const n = parseInt(lower.substring(7).trim());
        if (!setStatus(n, 'selesai')) return;
        return;
    }

    // pending <no>
    if (lower.startsWith('pending ')) {
        const n = parseInt(lower.substring(8).trim());
        if (!setStatus(n, 'pending')) return;
        return;
    }

    // cancel <no>
    if (lower.startsWith('cancel ')) {
        const n = parseInt(lower.substring(7).trim());
        if (!setStatus(n, 'batal')) return;
        return;
    }

    // rm <no> — hapus item by nomor
    if (lower.startsWith('rm ') && !lower.startsWith('rm todo')) {
        const n = parseInt(lower.substring(3).trim());
        if (isNaN(n) || n < 1 || n > items.length) {
            notify(`Nomor tidak valid. Tersedia: 1–${items.length}`, 'error'); return;
        }
        if (!activeListId) { notify('Buka todo list dulu.', 'warn'); return; }
        const removed = items.splice(n - 1, 1);
        renderTable();
        await saveItems();
        notify(`Item ${n} '${removed[0].keterangan}' dihapus.`, 'success');
        return;
    }

    // rm todo <nama> — hapus todo list
    if (lower.startsWith('rm todo ')) {
        const name = raw.substring(8).trim();
        const found = allLists.find(l => l.name.toLowerCase() === name.toLowerCase())
            || allLists.find(l => l.name.toLowerCase().startsWith(name.toLowerCase()));
        if (!found) { notify(`Todo '${name}' tidak ditemukan.`, 'error'); return; }
        pendingDeleteId = found.id;
        cmdHint.textContent = `Hapus todo '${found.name}'? Ketik YES.`;
        return;
    }

    notify('Perintah: todo <nama> · cd <nama> · add todo <ket> · finish/pending/cancel <no> · rm <no> · rm todo <nama> · ls', 'warn');
});

async function setStatus(n, status) {
    if (!activeListId) { notify('Buka todo list dulu.', 'warn'); return false; }
    if (isNaN(n) || n < 1 || n > items.length) {
        notify(`Nomor tidak valid. Tersedia: 1–${items.length}`, 'error'); return false;
    }
    items[n - 1].status = status;
    renderTable();
    await saveItems();
    notify(`Item ${n} → ${status.toUpperCase()}.`, 'success');
    return true;
}

// Delete list button
btnDelList.addEventListener('click', () => {
    if (!activeListId) return;
    pendingDeleteId = activeListId;
    cmdHint.textContent = `Hapus todo '${activeName}'? Ketik YES.`;
    cmdInput.focus();
});

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
