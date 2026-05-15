<?php
// Pengaturan Database
$host     = "localhost"; // Biasanya localhost, atau cek di panel hosting Anda
$user     = "u607709216_kamus";
$password = "Q05a10z92!!!";
$database = "u607709216_kamus";

// Membuat Koneksi
$koneksi = mysqli_connect($host, $user, $password, $database);

// Memeriksa Koneksi
if (!$koneksi) {
    die("Koneksi gagal: " . mysqli_connect_error());
}

// Opsional: Set charset ke utf8 agar karakter kamus (seperti aksen) tampil benar
mysqli_set_charset($koneksi, "utf8");

// Jika berhasil, variabel $koneksi siap digunakan di file lain
?>