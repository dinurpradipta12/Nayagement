-- Nayagement: editor invoice A4, logo/tanda tangan PNG, detail layanan, dan status pembayaran.
-- Jalankan sekali di Supabase SQL Editor. Aman dijalankan ulang.

alter table public.invoices
  add column if not exists document_title text not null default 'Invoice',
  add column if not exists brand_color text not null default '#30343b',
  add column if not exists logo_path text,
  add column if not exists signature_path text,
  add column if not exists recipient_name text,
  add column if not exists recipient_company text,
  add column if not exists recipient_email text,
  add column if not exists recipient_whatsapp text,
  add column if not exists sender_name text,
  add column if not exists sender_email text,
  add column if not exists sender_phone text,
  add column if not exists sender_address text,
  add column if not exists terms text,
  add column if not exists footer_note text;

alter table public.invoice_items
  add column if not exists detail text;

alter table public.invoices
  drop constraint if exists invoices_brand_color_format;

alter table public.invoices
  add constraint invoices_brand_color_format
  check (brand_color ~ '^#[0-9A-Fa-f]{6}$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice-logos',
  'invoice-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists invoice_logo_upload on storage.objects;
create policy invoice_logo_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'invoice-logos'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists invoice_logo_update on storage.objects;
create policy invoice_logo_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'invoice-logos'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
)
with check (
  bucket_id = 'invoice-logos'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists invoice_logo_delete on storage.objects;
create policy invoice_logo_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'invoice-logos'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

notify pgrst, 'reload schema';
