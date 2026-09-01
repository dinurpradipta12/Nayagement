import { requireSupabase } from '../lib/supabase'
import type { ContentPlanPlatform, ContentPlanSheet, ContentPlanSheetInput } from '../types'

const contentPlanLogoBucket = 'content-plan-assets'
const allowedLogoTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxLogoBytes = 2 * 1024 * 1024

interface ContentPlanRow {
  id: string
  workspace_id: string
  client_id: string | null
  client_name: string
  title: string
  sheet_url: string
  embed_url: string | null
  platform: string | null
  status: string | null
  logo_url: string | null
  created_by: string
  created_at: string
  updated_at: string
}

const platformValues: ContentPlanPlatform[] = [
  'Instagram & TikTok',
  'Instagram Reels',
  'LinkedIn & Article',
  'All Social Channels',
]

function mapPlatform(value: string | null): ContentPlanPlatform {
  return platformValues.includes(value as ContentPlanPlatform)
    ? value as ContentPlanPlatform
    : 'All Social Channels'
}

export function googleSheetId(value: string) {
  try {
    const url = new URL(value)
    if (url.hostname !== 'docs.google.com') return null
    return url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1] ?? null
  } catch {
    return null
  }
}

export function googleSheetEmbedUrl(value: string) {
  const id = googleSheetId(value)
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit?rm=minimal` : value
}

export function isGoogleSheetUrl(value: string) {
  return Boolean(googleSheetId(value.trim()))
}

function mapRow(row: ContentPlanRow): ContentPlanSheet {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name,
    title: row.title,
    sheetUrl: row.sheet_url,
    embedUrl: row.embed_url || googleSheetEmbedUrl(row.sheet_url),
    platform: mapPlatform(row.platform),
    status: row.status === 'archived' ? 'archived' : 'active',
    logoUrl: row.logo_url ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const sheetSelect = 'id, workspace_id, client_id, client_name, title, sheet_url, embed_url, platform, status, logo_url, created_by, created_at, updated_at'

function contentPlanError(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return new Error(fallback)
  if (/42P01|PGRST20[045]/i.test(error.code ?? '') || /content_plan_sheets/i.test(error.message ?? '') && /not find|does not exist|schema cache/i.test(error.message ?? '')) {
    return new Error('Content Plan Hub belum disiapkan di database. Jalankan SQL content-plan-sheets.sql terlebih dahulu.')
  }
  if (error.code === '23505') return new Error('Google Sheet tersebut sudah terhubung ke workspace ini.')
  return new Error(error.message || fallback)
}

export async function loadContentPlanSheets(workspaceId: string) {
  const { data, error } = await requireSupabase()
    .from('content_plan_sheets')
    .select(sheetSelect)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
  if (error) throw contentPlanError(error, 'Content plan tidak dapat dimuat.')
  return ((data ?? []) as unknown as ContentPlanRow[]).map(mapRow)
}

export async function saveContentPlanSheet(workspaceId: string, input: ContentPlanSheetInput, sheetId?: string) {
  const client = requireSupabase()
  const payload = {
    workspace_id: workspaceId,
    client_id: input.clientId || null,
    client_name: input.clientName.trim(),
    title: input.title.trim() || `Content Plan ${input.clientName.trim()}`,
    sheet_url: input.sheetUrl.trim(),
    embed_url: googleSheetEmbedUrl(input.sheetUrl.trim()),
    platform: input.platform,
    logo_url: input.logoUrl?.trim() || null,
    status: 'active',
  }

  if (sheetId) {
    const { data, error } = await client
      .from('content_plan_sheets')
      .update(payload)
      .eq('workspace_id', workspaceId)
      .eq('id', sheetId)
      .select(sheetSelect)
      .single()
    if (error) throw contentPlanError(error, 'Content plan tidak dapat diperbarui.')
    return mapRow(data as unknown as ContentPlanRow)
  }

  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) throw new Error('Sesi Anda tidak ditemukan. Silakan masuk kembali.')
  const { data, error } = await client
    .from('content_plan_sheets')
    .insert({ ...payload, created_by: authData.user.id })
    .select(sheetSelect)
    .single()
  if (error) throw contentPlanError(error, 'Content plan tidak dapat ditambahkan.')
  return mapRow(data as unknown as ContentPlanRow)
}

export async function deleteContentPlanSheet(workspaceId: string, sheetId: string) {
  const { data, error } = await requireSupabase()
    .from('content_plan_sheets')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', sheetId)
    .select('id')
    .maybeSingle()
  if (error) throw contentPlanError(error, 'Content plan tidak dapat dihapus.')
  if (!data) throw new Error('Content plan tidak ditemukan atau Anda tidak memiliki izin untuk menghapusnya.')
}

function logoExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export async function uploadContentPlanLogo(workspaceId: string, file: File) {
  if (!allowedLogoTypes.has(file.type)) throw new Error('Logo harus berupa JPG, PNG, atau WebP.')
  if (file.size > maxLogoBytes) throw new Error('Ukuran logo maksimal 2 MB.')
  const client = requireSupabase()
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const path = `${workspaceId}/${uniqueId}.${logoExtension(file)}`
  const { error } = await client.storage.from(contentPlanLogoBucket).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  })
  if (error) {
    if (/bucket.*(?:not found|does not exist)|(?:not found|does not exist).*bucket/i.test(error.message)) {
      throw new Error('Storage logo Content Plan belum aktif. Jalankan SQL content-plan-sheets.sql terlebih dahulu.')
    }
    throw new Error(error.message)
  }
  const publicUrl = client.storage.from(contentPlanLogoBucket).getPublicUrl(path).data.publicUrl
  if (!publicUrl) throw new Error('URL logo tidak dapat dibuat.')
  return publicUrl
}
