# Arunika 1:1 booking sync

Deploy `functions/arunika-booking-sync` after the Arunika receiver and its SQL
migration are live:

```sh
supabase functions deploy arunika-booking-sync --project-ref mkydicbdotvqvbzbeeqv
supabase secrets set \
  ARUNIKA_BOOKING_SYNC_URL="https://drezwxfgykkdnnwjrnnt.supabase.co/functions/v1/nayagement-booking-sync" \
  ARUNIKA_SYNC_SECRET="the-same-random-secret-configured-in-Arunika" \
  --project-ref mkydicbdotvqvbzbeeqv
```

`ARUNIKA_SYNC_SECRET` must match Arunika's `NAYAGEMENT_SYNC_SECRET`; keep both
values only in Supabase Edge Function secrets. The sender authorizes the caller
with their Nayagement session and requires the workspace role `owner` or
`admin`, so it is safe to expose the **Sync ke Arunika** action in the admin UI.

Before syncing a booking, copy the Workspace ID shown in **Booking konsultasi →
Pengaturan & jadwal**, then save it in Arunika's **1:1 Mentorship → Integrasi**.
