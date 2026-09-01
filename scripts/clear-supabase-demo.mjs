import { createClient } from '@supabase/supabase-js'

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} belum diisi.`)
  return value
}

const supabase = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
})
const label = process.env.NAYA_DEMO_SEED_LABEL || 'initial-ui-demo'

try {
  const { data: batches, error } = await supabase
    .from('demo_seed_batches')
    .select('id, workspace_id')
    .eq('label', label)
  if (error) throw new Error(error.message)
  let deleted = 0
  for (const batch of batches ?? []) {
    const { error: clearError } = await supabase.rpc('clear_demo_seed', { p_seed_id: batch.id })
    if (clearError) throw new Error(clearError.message)
    deleted += 1
  }
  console.log(JSON.stringify({ ok: true, label, deletedBatches: deleted }, null, 2))
} catch (error) {
  console.error(`Penghapusan demo gagal: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
}
