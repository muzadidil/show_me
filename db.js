// db.js
// Drop-in replacement untuk api.php
// Kontrak response sama persis: { status: 'success'|'error', pesan: string, data?: object }

import { db, authReady } from './firebase-config.js';
import {
    collection, doc, getDoc, getDocs, setDoc, deleteDoc,
    query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const COLLECTION = 'catatan';

/**
 * Build deterministic doc ID from kategori + keyword (composite key).
 * Mengganti UNIQUE KEY (kategori, keyword) dari MySQL.
 */
function buildDocId(kategori, keyword) {
    const safe = (s) => String(s).replace(/[\/.#$\[\]]/g, '_').trim();
    return `${safe(kategori)}__${safe(keyword)}`;
}

/**
 * Main API. Sama kontrak dengan fetch('api.php', { body: JSON.stringify(payload) }).
 */
export async function apiCall(payload) {
    await authReady; // pastikan sudah login anonymous sebelum query

    const action = payload.action || 'read';
    const cmd = (payload.cmd || '').trim();
    const kategori = (payload.kategori || 'global').trim();

    try {
        switch (action) {
            case 'save':      return await actionSave(kategori, cmd, payload.konten || '');
            case 'list':      return await actionList(kategori);
            case 'dirs':      return await actionDirs();
            case 'delete':    return await actionDelete(kategori, cmd);
            case 'load_cmds': return await actionLoadCmds();
            case 'read':      return await actionRead(kategori, cmd);
            default:          return { status: 'error', pesan: 'Unknown action' };
        }
    } catch (err) {
        console.error(`[DB ERROR] action=${action}`, err);
        return { status: 'error', pesan: `[ERROR] ${err.message}` };
    }
}

// 1. SAVE (INSERT ... ON DUPLICATE KEY UPDATE)
async function actionSave(kategori, cmd, konten) {
    if (!cmd || !konten) {
        return { status: 'error', pesan: 'Keyword dan konten tidak boleh kosong.' };
    }
    const id = buildDocId(kategori, cmd);
    await setDoc(doc(db, COLLECTION, id), {
        kategori,
        keyword: cmd,
        konten,
        updated_at: serverTimestamp()
    }, { merge: true });
    return { status: 'success', pesan: `[SYSTEM] '${cmd}' berhasil di-write ke sektor '${kategori}'!` };
}

// 2. LIST (SELECT keyword WHERE kategori = ?)
async function actionList(kategori) {
    const q = query(collection(db, COLLECTION), where('kategori', '==', kategori));
    const snap = await getDocs(q);
    if (snap.empty) {
        return { status: 'error', pesan: `Direktori [${kategori}] masih kosong.` };
    }
    const list = snap.docs.map(d => '- ' + d.data().keyword);
    return { status: 'success', pesan: `Daftar file di direktori [${kategori}]:\n${list.join('\n')}` };
}

// 3. DIRS (SELECT DISTINCT kategori)
// Firestore tidak punya DISTINCT, dedupe client-side
async function actionDirs() {
    const snap = await getDocs(collection(db, COLLECTION));
    const set = new Set();
    snap.forEach(d => {
        const k = d.data().kategori;
        if (k && k !== 'system_bin') set.add(k);
    });
    if (set.size === 0) {
        return { status: 'success', pesan: "Belum ada direktori kustom. Sistem baru memiliki root 'global'." };
    }
    const list = [...set].sort().map(k => '[DIR] ' + k);
    return { status: 'success', pesan: `Daftar Direktori Aktif:\n${list.join('\n')}` };
}

// 4. DELETE
async function actionDelete(kategori, cmd) {
    if (!cmd) {
        return { status: 'error', pesan: 'Masukkan judul yang ingin dihapus.' };
    }
    const id = buildDocId(kategori, cmd);
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        return { status: 'error', pesan: `[ERROR] '${cmd}' tidak ditemukan di direktori '${kategori}'.` };
    }
    await deleteDoc(ref);
    return { status: 'success', pesan: `[SYSTEM] '${cmd}' berhasil di-wipe dari direktori '${kategori}'.` };
}

// 5. LOAD_CMDS (system_bin custom commands)
async function actionLoadCmds() {
    const q = query(collection(db, COLLECTION), where('kategori', '==', 'system_bin'));
    const snap = await getDocs(q);
    const cmds = {};
    snap.forEach(d => {
        const data = d.data();
        cmds[data.keyword] = data.konten;
    });
    return { status: 'success', data: cmds };
}

// 6. READ
async function actionRead(kategori, cmd) {
    if (!cmd) {
        return { status: 'error', pesan: '' };
    }
    const id = buildDocId(kategori, cmd);
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) {
        return { status: 'error', pesan: `COMMAND NOT FOUND: '${cmd}'. Ketik 'help' atau buat baru dengan 'add ${cmd}'.` };
    }
    return { status: 'success', pesan: snap.data().konten };
}
