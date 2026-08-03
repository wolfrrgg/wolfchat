# WOLFCHAT — Private 2-Person Chat

Prototype website yang benar-benar dapat dijalankan dengan Node.js.

## Fitur
- Maksimal 2 koneksi per room
- Chat realtime via WebSocket
- Pesan dienkripsi di browser memakai AES-GCM sebelum dikirim ke server
- Pesan disimpan hanya sementara di RAM server
- Auto-delete 30 detik sampai 7 hari
- Hapus semua chat untuk kedua pengguna
- Opening screen bertema serigala
- Tema hitam/ungu + animasi DELETED
- Tidak memakai database

## Jalankan
1. Install Node.js 20+
2. Jalankan `npm install`
3. Jalankan `npm start`
4. Buka `http://localhost:3000`
5. Buat room, lalu bagikan URL yang memuat `#kode-room` kepada orang kedua.

## Catatan keamanan penting
Ini adalah fondasi/prototype, bukan audit keamanan profesional. Server tetap melihat metadata koneksi dan ciphertext. Tidak ada website yang dapat menjamin 100% pencegahan screenshot pada semua perangkat; iPhone/browser dapat membatasi kemampuan aplikasi web. Untuk produksi sebaiknya tambahkan HTTPS, rate limiting, origin checks, CSP, logging minimal, dan audit keamanan independen.
