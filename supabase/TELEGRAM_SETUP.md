# Aktivasi Telegram Bot Nayagement

Integrasi Telegram berjalan melalui Edge Function. Token bot tidak pernah boleh
dimasukkan ke `.env`, source React, SQL, atau variabel `VITE_*`.

## 1. Ganti token yang sudah pernah dibagikan

Buka BotFather, gunakan `/revoke` untuk bot terkait, lalu buat token baru. Simpan
token baru hanya untuk perintah secret pada langkah 3.

## 2. Siapkan tabel dan worker database

Buka Supabase SQL Editor pada project `mkydicbdotvqvbzbeeqv`, lalu jalankan seluruh
isi `telegram-bot-integration.sql` sebagai satu query.

## 3. Simpan secret fungsi

Jalankan dari folder project dengan akun Supabase yang memiliki akses Owner atau
Developer ke project:

```bash
read -s "TELEGRAM_TOKEN?Token Telegram baru: "
TELEGRAM_SECRET=$(openssl rand -hex 24)
supabase secrets set \
  TELEGRAM_BOT_TOKEN="$TELEGRAM_TOKEN" \
  TELEGRAM_WEBHOOK_SECRET="$TELEGRAM_SECRET" \
  --project-ref mkydicbdotvqvbzbeeqv
unset TELEGRAM_TOKEN TELEGRAM_SECRET
```

## 4. Deploy fungsi

```bash
supabase functions deploy telegram-bot \
  --project-ref mkydicbdotvqvbzbeeqv \
  --no-verify-jwt
```

Worker database berjalan setiap menit. Saat worker pertama berhasil, fungsi akan
memasang webhook Telegram dan daftar command bot secara otomatis.

## 5. Hubungkan chat

1. Buka **Settings → Notifications → Telegram bot**.
2. Isi alamat aplikasi publik dengan domain deployment, bukan localhost.
3. Simpan perubahan.
4. Salin perintah `/start KODE-KONEKSI` dan kirim ke bot.
5. Kembali ke Settings, muat ulang halaman, lalu tekan **Kirim tes**.

## Verifikasi SQL

```sql
select workspace_id, chat_id, chat_username, bot_username, is_enabled,
       reminder_morning, reminder_noon, reminder_evening, timezone
from public.telegram_integrations;

select status, count(*)
from public.telegram_outbox
group by status
order by status;

select jobname, schedule, active
from cron.job
where jobname = 'nayagement-telegram-dispatch';
```

Jika deploy CLI memberikan HTTP 403, login ulang memakai akun Supabase yang
menjadi Owner atau Developer pada project tersebut. Build lokal tidak dapat
menggantikan izin deployment ini.
