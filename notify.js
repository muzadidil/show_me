// notify.js — Hacker-style toast notification
// Usage: notify('pesan', 'success' | 'error' | 'warn')

let _container = null;

function getContainer() {
    if (_container) return _container;
    _container = document.createElement('div');
    Object.assign(_container.style, {
        position:       'fixed',
        top:            '15px',
        right:          '15px',
        zIndex:         '99999',
        display:        'flex',
        flexDirection:  'column',
        gap:            '8px',
        pointerEvents:  'none',
    });
    document.body.appendChild(_container);

    // inject keyframes once
    const style = document.createElement('style');
    style.textContent = `
        @keyframes _nIn  { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes _nOut { from { opacity:1; } to { opacity:0; } }
        @keyframes _nBar { from { width:100%; } to { width:0%; } }
    `;
    document.head.appendChild(style);
    return _container;
}

export function notify(message, type = 'success') {
    const colors = {
        success: '#00ff00',
        error:   '#ff3333',
        warn:    '#ffaa00',
    };
    const icons = {
        success: '[OK]',
        error:   '[!!]',
        warn:    '[?!]',
    };

    const color = colors[type] || colors.success;
    const icon  = icons[type]  || icons.success;
    const c     = getContainer();

    const box = document.createElement('div');
    box.style.cssText = `
        background: #000;
        border: 1px solid ${color};
        color: ${color};
        font-family: 'Courier New', monospace;
        font-size: 12px;
        padding: 9px 14px 14px;
        min-width: 200px;
        max-width: 320px;
        text-shadow: 0 0 6px ${color};
        box-shadow: 0 0 12px ${color}44;
        position: relative;
        overflow: hidden;
        pointer-events: all;
        cursor: pointer;
        animation: _nIn 0.15s ease;
        word-break: break-word;
        line-height: 1.5;
    `;

    const bar = document.createElement('div');
    bar.style.cssText = `
        position: absolute;
        bottom: 0; left: 0;
        height: 2px;
        background: ${color};
        animation: _nBar 3s linear forwards;
    `;

    box.innerHTML = `<span style="font-weight:bold;">${icon}</span> ${esc(message)}`;
    box.appendChild(bar);
    box.addEventListener('click', () => remove(box));
    c.appendChild(box);

    setTimeout(() => remove(box), 3000);
}

function remove(el) {
    el.style.animation = '_nOut 0.2s ease forwards';
    setTimeout(() => { try { el.remove(); } catch(_) {} }, 200);
}

function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
