# 🎭 Imposter Party PWA

Aplikasi game santai atas talian (multiplayer local-mesh) berasaskan Progressive Web App (PWA) menggunakan **Vue.js (Composition API)** dan **PeerJS (WebRTC)** tanpa memerlukan pangkalan data pusat (serverless).

---

## 🛠️ Struktur Fail Projek

Pastikan fail di dalam direktori projek Spck Editor anda tersusun seperti ini:
* `index.html` - Struktur antaramuka (UI) & elemen interaktif game.
* `style.css` - Reka bentuk moden tema gelap (*dark mode*) & mesra peranti mudah alih.
* `main.js` - Logik perniagaan, pengurusan fasa, mata, serta sambungan PeerJS.
* `words.json` - Fail pangkalan data senarai kategori dan perkataan rahsia.

---

## 🎮 Cara Menjalankan Projek

1. Buka projek di dalam **Spck Editor** pada Android.
2. Klik butang **Play/Preview** untuk menjalankan pelayan lokal (`http://localhost:XXXX`).
3. Untuk dimainkan bersama rakan, pastikan semua peranti berada dalam talian internet atau rangkaian WiFi yang sama untuk jalinan PeerJS yang stabil.

---

## 🧪 Trik Pengujian (Testing 1 Telefon)

Oleh sebab kod dalam fail `main.js` telah diubah suai untuk membenarkan had minimum **2 orang pemain sahaja (untuk tujuan dev)**, anda boleh menguji logik penuh game menggunakan 1 telefon melalui langkah berikut:

1. **Pemain 1 (Host):** Buka link preview di browser telefon anda (cth: Chrome). Daftar nama, klik **Buat Bilik**, dan salin kod 4-aksara yang tertera.
2. **Pemain 2 (Player):** Buka tab baharu dalam **Mod Incognito (Private Tab)** pada browser yang sama. Daftar nama berbeza, masukkan kod 4-aksara tadi, dan klik **Join Bilik**.
3. Lompat antara Tab Biasa dan Tab Incognito untuk mensimulasikan fasa **Intip Perkataan**, **Perbincangan**, **Undian Suspek**, dan **Paparan Mata Semasa**.

> **Nota Komponen Moden:** Pilihan jumlah maksimum pemain kini menggunakan sistem butang segmen kapsul (bukan lagi dropdown klasik) untuk reka bentuk yang lebih premium dan mesra skrin sentuh.
