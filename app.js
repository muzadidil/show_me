let currentMode = 'terminal';
let activeKeyword = '';
let currentDir = 'global';
let activeDirForEditor = '';
let customCommands = {}; 

// --- VARIABEL FITUR BARU ---
const SYSTEM_PASSWORD = 'zasha'; // UBAH PASSWORD ANDA DI SINI
let isLoggedIn = false;

const inputField = document.getElementById('cmdInput');
const historyDiv = document.getElementById('history');
const editorDiv = document.getElementById('editor');
const terminalDiv = document.getElementById('terminal');
const textarea = document.getElementById('editor-textarea');
const promptElement = document.getElementById('prompt-text');
const keywordDisplay = document.getElementById('edit-keyword');
const dirDisplay = document.getElementById('edit-dir');
const hackerFooter = document.getElementById('hacker-footer'); 

// --- UPDATE: Link Akses Cepat di Banner ---
const BANNER = `
<div class="ascii-art">
  ______         _             ___        _ _            
 |___  /        | |           / _ \\      | (_)           
    / / __ _ ___| |__   __ _ | | | |_ __ | |_ _ __   ___ 
   / / / _\` / __| '_ \\ / _\` || | | | '_ \\| | | '_ \\ / _ \\
  / /_| (_| \\__ \\ | | | (_| || |_| | | | | | | | | |  __/
 /_____\\__,_|___/_| |_|\\__,_| \\___/|_| |_|_|_|_| |_|\\___|
</div>
<div class="system-msg">
=========================================================
  SYSTEM TERMINAL v5.0 (MUZ PRO EDITION)
  Modul Aktif: CRUD, Live Scripting, Auto-Copy, Footer
=========================================================
Ketik 'help' atau <a href="dokter/" target="_blank" style="color:#00ff00; text-decoration:none; font-weight:bold;">[ KLIK DISINI ]</a> untuk akses Dokter Zasha.
</div><br>`;

// 1. INISIALISASI LOCK SCREEN
function initLockScreen() {
    historyDiv.innerHTML = '<div class="error-msg">SYSTEM SECURED. ENCRYPTED PROTOCOL ACTIVE.</div><br>';
    promptElement.textContent = 'Enter Password:';
    inputField.type = 'password';
    if(hackerFooter) hackerFooter.style.display = 'none'; 
}
initLockScreen();

// 2. EFEK LOADING & FOOTER ANIMASI
async function runHackerLoading() {
    inputField.disabled = true;
    historyDiv.innerHTML = '';
    
    const steps = [
        "[SYSTEM] Authenticating credentials...",
        "[SYSTEM] Access Granted. Welcome, Admin.",
        "[SYSTEM] Decrypting local database clusters...",
        "[SYSTEM] Injecting regex listener for Auto-Copy...",
        "[SYSTEM] Modules loaded... [||||||||||] 100%"
    ];

    for (let step of steps) {
        appendHistory(step, 'system-msg');
        await new Promise(r => setTimeout(r, 400));
    }

    setTimeout(() => {
        historyDiv.innerHTML = BANNER;
        updatePrompt();
        inputField.type = 'text';
        inputField.disabled = false;
        inputField.focus();
        if(hackerFooter) hackerFooter.style.display = 'flex'; 
        startFooterAnimation();
        loadCustomCommands();
    }, 600);
}

// 3. LOGIKA ANIMASI FOOTER RANDOM
function startFooterAnimation() {
    const statuses = ["MONITORING TRAFFIC...", "SYNCING DATABASE...", "DECRYPTING NODES...", "BYPASSING FIREWALL...", "SYSTEM PROCESSING..."];
    const statusEl = document.getElementById('footer-status');
    const progressEl = document.getElementById('footer-progress');
    const percentEl = document.getElementById('footer-percent');

    setInterval(() => {
        if (Math.random() > 0.6 && statusEl) statusEl.textContent = statuses[Math.floor(Math.random() * statuses.length)];
        let percent = Math.floor(Math.random() * 90) + 10; 
        if(percentEl) percentEl.textContent = percent + '%';
        let bars = Math.floor(percent / 10);
        if(progressEl) progressEl.textContent = '|'.repeat(bars) + '-'.repeat(10 - bars);
    }, 600);
}

// 4. MENGAMBIL PERINTAH KUSTOM
async function loadCustomCommands() {
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'load_cmds' })
        });
        const data = await response.json();
        if (data.status === 'success') {
            customCommands = data.data;
        }
    } catch (e) {
        console.error("Gagal memuat memori perintah.");
    }
}

function updatePrompt() {
    if (currentDir === 'global') {
        promptElement.textContent = 'root@zasha:~$';
    } else {
        promptElement.textContent = `root@zasha:~/${currentDir}$`;
    }
}

document.body.addEventListener('click', () => {
    if (currentMode === 'terminal') inputField.focus();
});

// 5. EVENT LISTENER UNTUK TOMBOL COPY
historyDiv.addEventListener('click', function(e) {
    if (e.target.classList.contains('copy-btn')) {
        const rawText = decodeURIComponent(e.target.getAttribute('data-text'));
        navigator.clipboard.writeText(rawText).then(() => {
            const btn = e.target;
            btn.textContent = 'COPIED!';
            btn.style.backgroundColor = '#00ff00';
            btn.style.color = '#000';
            setTimeout(() => {
                btn.textContent = 'COPY';
                btn.style.backgroundColor = '#005500'; 
                btn.style.color = '#00ff00';
            }, 1500);
        });
    }
});

// 6. LOGIKA UTAMA TERMINAL
inputField.addEventListener('keydown', async function(e) {
    if (e.key === 'Enter') {
        const cmd = this.value.trim();
        if (!cmd) return;
        this.value = '';

        if (!isLoggedIn) {
            if (cmd === SYSTEM_PASSWORD) {
                isLoggedIn = true;
                runHackerLoading();
            } else {
                appendHistory("ACCESS DENIED. Incorrect password.", 'error-msg');
            }
            return;
        }

        const hardReject = (reason) => {
            const div = document.createElement('div');
            div.innerHTML = `
            <div style="font-weight:bold; border:2px solid #ff0000; padding:15px; background: rgba(255,0,0,0.1); margin: 15px 0; color: #ff0000; text-align: center;">
              [X]!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!![X]<br>
              [X]           DI TOLAK               [X]<br>
              [X]!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!![X]<br><br>
              ALASAN: ${reason}<br>
              MAX KARAKTER ADALAH 10
            </div>`;
            historyDiv.appendChild(div);
            window.scrollTo(0, document.body.scrollHeight);
        };

        const cmdLower = cmd.toLowerCase();

        // VALIDASI PENOLAKAN
        if (cmdLower.startsWith('cd ') || cmdLower === 'cd..') {
            let target = cmdLower === 'cd..' ? '..' : cmd.substring(3).trim();
            if (target !== '..' && target !== 'global' && target.length > 10) {
                hardReject("NAMA DIREKTORI TERLALU PANJANG");
                return;
            }
        } 
        else if (cmdLower.startsWith('add ')) {
            if (cmd.substring(4).trim().length > 10) {
                hardReject("KEYWORD TERLALU PANJANG");
                return;
            }
        } 
        else if (cmdLower.startsWith('edit ')) {
            if (cmd.substring(5).trim().length > 10) {
                hardReject("KEYWORD TERLALU PANJANG");
                return;
            }
        }
        else if (cmdLower.startsWith('mkcmd ')) {
            if (cmd.substring(6).trim().length > 10) {
                hardReject("NAMA PROGRAM TERLALU PANJANG");
                return;
            }
        }

        appendHistory(`${promptElement.textContent} ${cmd}`, 'prompt');

        // --- DAFTAR PERINTAH ---
        if (cmdLower === 'clear') {
            historyDiv.innerHTML = '';
            return;
        } 
        else if (cmdLower === 'help') {
            const helpText = `
PERINTAH DASAR:
- cd [nama] | ls | add | edit | rm
- syscmds   : List program kustom

MODUL DOKTER ZASHA:
- doctor    : Dashboard Dokter & Analyzer
- scan      : Global Find & Replace
- col       : Column Explorer (Struktur DB)
- db        : Data Explorer (Isi DB)
- link      : Link Health Scanner
            `;
            appendHistory(helpText.trim(), 'system-msg');
            return;
        } 
        // --- SHORTCUT DOKTER ZASHA ---
        else if (cmdLower === 'doctor') {
            appendHistory("[SYSTEM] Membuka panel utama Dokter Zasha...", 'system-msg');
            setTimeout(() => { window.open('dokter/index.php', '_blank'); }, 500);
            return;
        }
        else if (cmdLower === 'scan') {
            appendHistory("[SYSTEM] Membuka modul Find & Replace Global...", 'warning-msg');
            setTimeout(() => { window.open('dokter/find.php', '_blank'); }, 500);
            return;
        }
        else if (cmdLower === 'col' || cmdLower === 'columns') {
            appendHistory("[SYSTEM] Membuka Column Explorer...", 'system-msg');
            setTimeout(() => { window.open('dokter/exp.php', '_blank'); }, 500);
            return;
        }
        else if (cmdLower === 'data' || cmdLower === 'db') {
            appendHistory("[SYSTEM] Membuka Data Explorer...", 'system-msg');
            setTimeout(() => { window.open('dokter/db_view.php', '_blank'); }, 500);
            return;
        }
        else if (cmdLower === 'link' || cmdLower === 'links') {
            appendHistory("[SYSTEM] Membuka Link Health Scanner...", 'system-msg');
            setTimeout(() => { window.open('dokter/link.php', '_blank'); }, 500);
            return;
        }
        // --- END SHORTCUT ---
        else if (cmdLower === 'ls') {
            fetchAPI({ action: 'list', kategori: currentDir });
            return;
        } else if (cmdLower === 'dirs') {
            fetchAPI({ action: 'dirs' });
            return;
        } else if (cmdLower === 'syscmds') {
            const cmdList = Object.keys(customCommands).map(c => "-> " + c).join("\n");
            if(cmdList) appendHistory("Daftar Perintah Sistem Anda:\n" + cmdList, 'system-msg');
            else appendHistory("Belum ada program kustom.", 'system-msg');
            return;
        } else if (cmdLower.startsWith('cd ') || cmdLower === 'cd..') {
            let targetDir = cmdLower === 'cd..' ? '..' : cmd.substring(3).trim().toLowerCase();
            if (targetDir === '..' || targetDir === 'global' || targetDir === '~' || targetDir === '/') {
                currentDir = 'global';
            } else if (targetDir !== '') {
                currentDir = targetDir.replace(/\s+/g, '-'); 
            }
            updatePrompt();
            return;
        } else if (cmdLower.startsWith('add ')) {
            openEditor(cmd.substring(4).trim(), currentDir);
            return;
        } else if (cmdLower.startsWith('edit ')) {
            let keyword = cmd.substring(5).trim();
            appendHistory(`[SYSTEM] Fetching data for '${keyword}'...`, 'system-msg');
            fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'read', cmd: keyword, kategori: currentDir })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    openEditor(keyword, currentDir, data.pesan);
                } else {
                    appendHistory(`[ERROR] Data '${keyword}' tidak ditemukan.`, 'error-msg');
                }
            });
            return;
        } else if (cmdLower.startsWith('rm ')) {
            const keyword = cmd.substring(3).trim();
            if (keyword && confirm(`Hapus '${keyword}'?`)) {
                fetchAPI({ action: 'delete', cmd: keyword, kategori: currentDir });
            }
            return;
        } else if (cmdLower.startsWith('mkcmd ')) {
            openEditor(cmd.substring(6).trim(), 'system_bin'); 
            return;
        } else if (cmdLower.startsWith('rmcmd ')) {
            const keyword = cmd.substring(6).trim();
            if (!keyword) return;
            if(confirm(`Hapus program '${keyword}'?`)) {
                fetchAPI({ action: 'delete', cmd: keyword, kategori: 'system_bin' });
                delete customCommands[keyword]; 
            }
            return;
        }

        const cmdName = cmd.split(' ')[0].toLowerCase();
        if (customCommands[cmdName]) {
            try {
                eval(customCommands[cmdName]);
            } catch (err) {
                appendHistory(`[EXEC ERROR] Gagal menjalankan skrip: ${err.message}`, 'error-msg');
            }
            return;
        }

        fetchAPI({ action: 'read', cmd: cmd, kategori: currentDir });
    }
});

async function fetchAPI(payload) {
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.status === 'success') {
            if (payload.action === 'read') {
                appendHistoryWithCopy(data.pesan);
            } else {
                appendHistory(data.pesan, 'output-line');
            }
        } else {
            appendHistory(data.pesan, 'error-msg');
        }
    } catch (error) {
        appendHistory('FATAL ERROR: Server offline.', 'error-msg');
    }
}

function openEditor(keyword, targetDir, content = '') {
    currentMode = 'editor';
    activeKeyword = keyword;
    activeDirForEditor = targetDir;
    terminalDiv.style.display = 'none';
    editorDiv.style.display = 'block';
    dirDisplay.textContent = targetDir;
    keywordDisplay.textContent = keyword;
    textarea.value = content; 
    textarea.focus();
}

function closeEditor() {
    currentMode = 'terminal';
    editorDiv.style.display = 'none';
    terminalDiv.style.display = 'block';
    inputField.focus();
    window.scrollTo(0, document.body.scrollHeight);
}

textarea.addEventListener('keydown', async function(e) {
    if (e.key === 'Escape') {
        closeEditor();
        appendHistory("ABORTED.", 'system-msg');
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const konten = this.value.trim();
        if(!konten) { closeEditor(); return; }
        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save', cmd: activeKeyword, konten: konten, kategori: activeDirForEditor })
            });
            const data = await response.json();
            closeEditor();
            if (data.status === 'success') {
                if (activeDirForEditor === 'system_bin') loadCustomCommands();
                appendHistory(data.pesan, 'prompt'); 
            } else {
                appendHistory(data.pesan, 'error-msg');
            }
        } catch (error) {
            closeEditor();
            appendHistory('SAVE ERROR.', 'error-msg');
        }
    }
});

function appendHistory(text, className) {
    const div = document.createElement('div');
    div.className = className;
    div.textContent = text;
    historyDiv.appendChild(div);
    window.scrollTo(0, document.body.scrollHeight);
}

function appendHistoryWithCopy(text) {
    const div = document.createElement('div');
    div.className = 'output-line';
    let safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let regexSakti = /(`[^`]+`|'[^']+'|"[^"]+"|“[^”]+”|‘[^’]+’)/g;
    let formattedHTML = safeText.replace(regexSakti, function(match) {
        let innerText = match.substring(1, match.length - 1);
        let encoded = encodeURIComponent(innerText); 
        return `<span style="color:#00ffff; font-weight:bold;">${match}</span> <button class="copy-btn" data-text="${encoded}">COPY</button>`;
    });
    div.innerHTML = formattedHTML;
    historyDiv.appendChild(div);
    window.scrollTo(0, document.body.scrollHeight);
}