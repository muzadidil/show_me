<?php
include 'koneksi.php';

header('Content-Type: application/json');
$data = json_decode(file_get_contents("php://input"), true);

$action   = isset($data['action']) ? $data['action'] : 'read';
$cmd      = isset($data['cmd']) ? trim($data['cmd']) : '';
$kategori = isset($data['kategori']) ? trim($data['kategori']) : 'global';

// =========================================================
// 1. Aksi Menyimpan Catatan & Script (Perintah 'add' / 'mkcmd')
// =========================================================
if ($action === 'save') {
    $konten = isset($data['konten']) ? $data['konten'] : '';
    
    if (empty($cmd) || empty($konten)) {
        echo json_encode(['status' => 'error', 'pesan' => 'Keyword dan konten tidak boleh kosong.']);
        exit;
    }

    $query = "INSERT INTO catatan (kategori, keyword, konten) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE konten = ?";
    $stmt = mysqli_prepare($koneksi, $query);
    mysqli_stmt_bind_param($stmt, "ssss", $kategori, $cmd, $konten, $konten);

    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(['status' => 'success', 'pesan' => "[SYSTEM] '$cmd' berhasil di-write ke sektor '$kategori'!"]);
    } else {
        echo json_encode(['status' => 'error', 'pesan' => '[ERROR] Gagal menyimpan: ' . mysqli_error($koneksi)]);
    }
    mysqli_stmt_close($stmt);
    exit;
}

// =========================================================
// 2. Aksi Menampilkan Semua Catatan di Folder Aktif (Perintah 'ls')
// =========================================================
if ($action === 'list') {
    $query = "SELECT keyword FROM catatan WHERE kategori = ?";
    $stmt = mysqli_prepare($koneksi, $query);
    mysqli_stmt_bind_param($stmt, "s", $kategori);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    $list = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $list[] = "- " . $row['keyword'];
    }

    if (count($list) > 0) {
        $pesan = "Daftar file di direktori [$kategori]:\n" . implode("\n", $list);
        echo json_encode(['status' => 'success', 'pesan' => $pesan]);
    } else {
        echo json_encode(['status' => 'error', 'pesan' => "Direktori [$kategori] masih kosong."]);
    }
    mysqli_stmt_close($stmt);
    exit;
}

// =========================================================
// 3. Aksi Menampilkan Semua Kategori/Folder (Perintah 'dirs')
// =========================================================
if ($action === 'dirs') {
    // Mengecualikan folder rahasia system_bin agar tidak muncul di list biasa
    $query = "SELECT DISTINCT kategori FROM catatan WHERE kategori != 'system_bin' ORDER BY kategori ASC";
    $result = mysqli_query($koneksi, $query);

    $list = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $list[] = "[DIR] " . $row['kategori'];
    }

    if (count($list) > 0) {
        $pesan = "Daftar Direktori Aktif:\n" . implode("\n", $list);
        echo json_encode(['status' => 'success', 'pesan' => $pesan]);
    } else {
        echo json_encode(['status' => 'success', 'pesan' => "Belum ada direktori kustom. Sistem baru memiliki root 'global'."]);
    }
    exit;
}

// =========================================================
// 4. Aksi Menghapus Catatan atau Script (Perintah 'rm' / 'rmcmd')
// =========================================================
if ($action === 'delete') {
    if (empty($cmd)) {
        echo json_encode(['status' => 'error', 'pesan' => 'Masukkan judul yang ingin dihapus.']);
        exit;
    }

    $query = "DELETE FROM catatan WHERE kategori = ? AND keyword = ?";
    $stmt = mysqli_prepare($koneksi, $query);
    mysqli_stmt_bind_param($stmt, "ss", $kategori, $cmd);
    mysqli_stmt_execute($stmt);

    if (mysqli_stmt_affected_rows($stmt) > 0) {
        echo json_encode(['status' => 'success', 'pesan' => "[SYSTEM] '$cmd' berhasil di-wipe dari direktori '$kategori'."]);
    } else {
        echo json_encode(['status' => 'error', 'pesan' => "[ERROR] '$cmd' tidak ditemukan di direktori '$kategori'."]);
    }
    mysqli_stmt_close($stmt);
    exit;
}

// =========================================================
// 5. Aksi Memuat Custom Command Buatan User ke Memori Browser
// =========================================================
if ($action === 'load_cmds') {
    $query = "SELECT keyword, konten FROM catatan WHERE kategori = 'system_bin'";
    $result = mysqli_query($koneksi, $query);
    $cmds = [];
    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $cmds[$row['keyword']] = $row['konten'];
        }
    }
    echo json_encode(['status' => 'success', 'data' => $cmds]);
    exit;
}

// =========================================================
// 6. Aksi Membaca 1 Catatan Spesifik
// =========================================================
if ($action === 'read') {
    if (empty($cmd)) {
        echo json_encode(['status' => 'error', 'pesan' => '']);
        exit;
    }

    $query = "SELECT konten FROM catatan WHERE kategori = ? AND keyword = ? LIMIT 1";
    $stmt = mysqli_prepare($koneksi, $query);
    mysqli_stmt_bind_param($stmt, "ss", $kategori, $cmd);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    if ($row = mysqli_fetch_assoc($result)) {
        echo json_encode(['status' => 'success', 'pesan' => $row['konten']]);
    } else {
        echo json_encode(['status' => 'error', 'pesan' => "COMMAND NOT FOUND: '$cmd'. Ketik 'help' atau buat baru dengan 'add $cmd'."]);
    }
    mysqli_stmt_close($stmt);
}

// Tutup koneksi database
mysqli_close($koneksi);
?>