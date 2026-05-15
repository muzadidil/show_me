<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kamus Zasha.online - ROOT SYSTEM</title>
    <!-- Tambahan v= time agar tidak kena cache bandel lagi -->
    <link rel="stylesheet" href="style.css?v=<?php echo time(); ?>">
</head>
<body>

<div id="terminal">
    <!-- Kosong untuk layar login, ASCII akan dimuat JS -->
    <div id="history"></div>
    <div class="input-line">
        <span class="prompt" id="prompt-text"></span>
        <input type="password" id="cmdInput" autocomplete="off" autofocus spellcheck="false">
    </div>
</div>

<div id="editor">
    <div class="editor-header">Script Editor --- Dir: [<span id="edit-dir"></span>] --- Script: <span id="edit-keyword"></span></div>
    <div class="system-msg">COMMAND: Tekan <b>CTRL + S</b> untuk Save/Compile. Tekan <b>ESC</b> untuk Abort.</div>
    <textarea id="editor-textarea" spellcheck="false"></textarea>
</div>

<!-- FOOTER ANIMASI HACKER -->
<div id="hacker-footer">
    <div id="footer-status">SYSTEM IDLE...</div>
    <div id="footer-bar">[<span id="footer-progress">----------</span>] <span id="footer-percent">0%</span></div>
</div>

<script src="app.js?v=<?php echo time(); ?>"></script>

</body>
</html>