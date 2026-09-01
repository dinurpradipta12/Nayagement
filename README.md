# Nayagement

Nayagement adalah command center untuk freelancer, studio kreatif, dan agency kecil: proyek, deadline, klien, invoice, finance, order form, dan client portal dalam satu ruang kerja yang tenang.

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka `http://127.0.0.1:5173/`.

## Konfigurasi Supabase

Frontend hanya membaca key yang aman untuk browser dari `.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
# VITE_SUPABASE_ANON_KEY dapat dipakai sebagai fallback legacy.
```

Key service role disimpan terpisah di `supabase/.env.local`, yang sudah diabaikan Git. Salin format dari [supabase/.env.local.example](supabase/.env.local.example). Jangan pernah memakai prefix `VITE_` untuk service-role key.

### Menyiapkan database dan data contoh

1. Masuk ke Supabase Dashboard project yang dituju.
2. Buka SQL Editor dan jalankan seluruh [supabase/schema.sql](supabase/schema.sql). Skema ini membuat RLS, workspace, tabel aplikasi, serta fungsi penghapusan batch demo.
3. Seed akun workspace dan seluruh data contoh:

   ```bash
   npm run seed:supabase
   ```

   Skrip ini membuat akun Auth berdasarkan `NAYA_ADMIN_USERNAME` dan `NAYA_ADMIN_PASSWORD` pada `supabase/.env.local`, lalu mengisi clients, project types, projects, tasks, timeline, portal token, invoices/payments, notifications, calendar events, order form, dan submission contoh.
4. Masuk di aplikasi dengan username dan password yang sama dari file lokal tersebut.

Semua data contoh diberi batch `initial-ui-demo` melalui tabel `demo_seed_batches`. Untuk menghapus data demo sebelum deploy:

```bash
npm run clear:demo
```

Perintah itu hanya menghapus record yang ditandai batch demo beserta child records-nya; data baru yang dibuat setelahnya tidak ikut dihapus. Atur label lain lewat `NAYA_DEMO_SEED_LABEL` bila ingin memiliki batch demo terpisah.

## Data yang dibaca aplikasi

Saat sesi Supabase aktif, halaman workspace memuat Projects, Tasks, Clients, Invoices, Notifications, dan Timeline langsung dari database. Pembuatan proyek, penyelesaian tugas, serta status notifikasi juga disimpan kembali ke Supabase. Mode demo lokal tetap tersedia hanya bila konfigurasi Supabase belum ada.

## Keamanan dan production

- RLS aktif pada semua tabel internal dan membatasi data pada anggota workspace.
- Client portal dan public order form menggunakan RPC dengan token, bukan akses tabel anonymous langsung.
- Service-role key hanya dipakai oleh skrip seed lokal atau server tepercaya.
- Sebelum production, ganti password akun awal, review RLS, dan uji login/logout, portal publik, serta form order.

## Validasi

```bash
npm run lint
npm run build
```

Untuk production, host folder `dist/` di static host dengan SPA fallback ke `index.html`. Hash route seperti `#/client/project/<token>` dan `#/order/<token>` tetap dilayani oleh file SPA yang sama.
