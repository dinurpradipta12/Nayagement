import { requireSupabase } from '../lib/supabase'
import type { PersonalFinanceBudget, PersonalFinanceCategory, PersonalFinanceKind, PersonalFinanceScope, PersonalFinanceSnapshot, PersonalFinanceTransaction, PersonalSavingsGoal, PersonalWishlistItem, PersonalWishlistPriority } from '../types'

const defaultCategories = [
  { name: 'Pemasukan bisnis', kind: 'income', color: '#2f6fdf' },
  { name: 'Gaji & pendapatan', kind: 'income', color: '#48aa8b' },
  { name: 'Bonus & lainnya', kind: 'income', color: '#8a72db' },
  { name: 'Kebutuhan rumah', kind: 'expense', color: '#ed9a62' },
  { name: 'Makanan', kind: 'expense', color: '#e57194' },
  { name: 'Transportasi', kind: 'expense', color: '#6396e8' },
  { name: 'Tagihan', kind: 'expense', color: '#9d78d9' },
  { name: 'Pendidikan', kind: 'expense', color: '#56ad8d' },
  { name: 'Kesehatan', kind: 'expense', color: '#e66f6f' },
  { name: 'Hiburan', kind: 'expense', color: '#6f87c9' },
] as const

function kind(value: unknown): PersonalFinanceKind {
  return value === 'income' ? 'Income' : 'Expense'
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function setupError(error: { message?: string } | null) {
  if (!error) return null
  if (/personal_finance_|personal_savings_goals|relation .* does not exist|schema cache/i.test(error.message ?? '')) {
    return new Error('Keuangan pribadi belum disiapkan. Jalankan SQL pembaruan Keuangan Pribadi terlebih dahulu.')
  }
  return new Error(error.message || 'Data keuangan pribadi tidak dapat dimuat.')
}

async function ensureCategories(workspaceId: string) {
  const client = requireSupabase()
  const { data, error } = await client.from('personal_finance_categories').select('id').eq('workspace_id', workspaceId).limit(1)
  const mapped = setupError(error)
  if (mapped) throw mapped
  if (data?.length) return
  const { error: insertError } = await client.from('personal_finance_categories').insert(defaultCategories.map((category) => ({ ...category, workspace_id: workspaceId, is_system: true })))
  const insertMapped = setupError(insertError)
  if (insertMapped) throw insertMapped
}

export async function loadPersonalFinanceSnapshot(workspaceId: string): Promise<PersonalFinanceSnapshot> {
  await ensureCategories(workspaceId)
  const client = requireSupabase()
  const [categoryResult, transactionResult, budgetResult, goalResult, wishlistResult] = await Promise.all([
    client.from('personal_finance_categories').select('id, name, kind, color, is_system').eq('workspace_id', workspaceId).order('kind').order('name'),
    client.from('personal_finance_transactions').select('id, category_id, title, kind, amount, occurred_on, payment_method, notes, scope, family_member, is_recurring').eq('workspace_id', workspaceId).order('occurred_on', { ascending: false }).limit(500),
    client.from('personal_finance_budgets').select('id, category_id, budget_month, kind, planned_amount').eq('workspace_id', workspaceId).order('budget_month', { ascending: false }),
    client.from('personal_savings_goals').select('id, name, target_amount, current_amount, target_date, color, notes').eq('workspace_id', workspaceId).order('created_at'),
    client.from('personal_finance_wishlist').select('id, category_id, name, estimated_amount, actual_amount, priority, target_date, purchased_at, notes, status, transaction_id').eq('workspace_id', workspaceId).order('status').order('priority', { ascending: false }).order('target_date', { ascending: true, nullsFirst: false }),
  ])
  const error = categoryResult.error || transactionResult.error || budgetResult.error || goalResult.error || wishlistResult.error
  const mapped = setupError(error)
  if (mapped) throw mapped
  return {
    categories: (categoryResult.data ?? []).map<PersonalFinanceCategory>((row) => ({ id: row.id, name: row.name, kind: kind(row.kind), color: row.color, isSystem: Boolean(row.is_system) })),
    transactions: (transactionResult.data ?? []).map<PersonalFinanceTransaction>((row) => ({
      id: row.id, categoryId: row.category_id ?? undefined, title: row.title, kind: kind(row.kind), amount: numberValue(row.amount), occurredOn: row.occurred_on,
      paymentMethod: row.payment_method ?? '', notes: row.notes ?? '', scope: row.scope === 'family' ? 'Family' : 'Personal', familyMember: row.family_member ?? '', isRecurring: Boolean(row.is_recurring), source: 'Manual',
    })),
    budgets: (budgetResult.data ?? []).map<PersonalFinanceBudget>((row) => ({ id: row.id, categoryId: row.category_id, month: row.budget_month.slice(0, 7), kind: kind(row.kind), plannedAmount: numberValue(row.planned_amount) })),
    savingsGoals: (goalResult.data ?? []).map<PersonalSavingsGoal>((row) => ({ id: row.id, name: row.name, targetAmount: numberValue(row.target_amount), currentAmount: numberValue(row.current_amount), targetDate: row.target_date ?? undefined, color: row.color, notes: row.notes ?? '' })),
    wishlist: (wishlistResult.data ?? []).map<PersonalWishlistItem>((row) => ({
      id: row.id, categoryId: row.category_id ?? undefined, name: row.name, estimatedAmount: numberValue(row.estimated_amount), actualAmount: row.actual_amount == null ? undefined : numberValue(row.actual_amount),
      priority: row.priority === 'high' ? 'High' : row.priority === 'low' ? 'Low' : 'Medium', targetDate: row.target_date ?? undefined, purchasedAt: row.purchased_at ?? undefined,
      notes: row.notes ?? '', status: row.status === 'purchased' ? 'Purchased' : 'Planned', transactionId: row.transaction_id ?? undefined,
    })),
  }
}

export async function createPersonalFinanceCategory(workspaceId: string, input: { name: string; kind: PersonalFinanceKind; color: string }) {
  const client = requireSupabase()
  const { data, error } = await client.from('personal_finance_categories').insert({ workspace_id: workspaceId, name: input.name.trim(), kind: input.kind.toLowerCase(), color: input.color, is_system: false }).select('id, name, kind, color, is_system').single()
  const mapped = setupError(error)
  if (mapped) throw mapped
  if (!data) throw new Error('Kategori keuangan tidak dapat dibuat.')
  return { id: data.id, name: data.name, kind: kind(data.kind), color: data.color, isSystem: Boolean(data.is_system) } as PersonalFinanceCategory
}

export async function savePersonalFinanceTransaction(workspaceId: string, input: Omit<PersonalFinanceTransaction, 'id' | 'source' | 'sourceId'> & { id?: string }) {
  const client = requireSupabase()
  const payload = {
    workspace_id: workspaceId, category_id: input.categoryId || null, title: input.title.trim(), kind: input.kind.toLowerCase(), amount: Math.round(input.amount), occurred_on: input.occurredOn,
    payment_method: input.paymentMethod.trim() || null, notes: input.notes.trim() || null, scope: input.scope.toLowerCase(), family_member: input.scope === 'Family' ? input.familyMember.trim() || null : null, is_recurring: input.isRecurring,
  }
  const query = input.id
    ? client.from('personal_finance_transactions').update(payload).eq('workspace_id', workspaceId).eq('id', input.id)
    : client.from('personal_finance_transactions').insert(payload)
  const { error } = await query
  const mapped = setupError(error)
  if (mapped) throw mapped
}

export async function deletePersonalFinanceTransaction(workspaceId: string, id: string) {
  const { error } = await requireSupabase().from('personal_finance_transactions').delete().eq('workspace_id', workspaceId).eq('id', id)
  const mapped = setupError(error)
  if (mapped) throw mapped
}

export async function savePersonalFinanceBudget(workspaceId: string, input: { categoryId: string; month: string; kind: PersonalFinanceKind; plannedAmount: number }) {
  const { error } = await requireSupabase().from('personal_finance_budgets').upsert({
    workspace_id: workspaceId, category_id: input.categoryId, budget_month: `${input.month}-01`, kind: input.kind.toLowerCase(), planned_amount: Math.round(input.plannedAmount),
  }, { onConflict: 'workspace_id,category_id,budget_month' })
  const mapped = setupError(error)
  if (mapped) throw mapped
}

export async function deletePersonalFinanceBudget(workspaceId: string, id: string) {
  const { error } = await requireSupabase().from('personal_finance_budgets').delete().eq('workspace_id', workspaceId).eq('id', id)
  const mapped = setupError(error)
  if (mapped) throw mapped
}

export async function savePersonalSavingsGoal(workspaceId: string, input: Omit<PersonalSavingsGoal, 'id'> & { id?: string }) {
  const client = requireSupabase()
  const payload = { workspace_id: workspaceId, name: input.name.trim(), target_amount: Math.round(input.targetAmount), current_amount: Math.round(input.currentAmount), target_date: input.targetDate || null, color: input.color, notes: input.notes.trim() || null }
  const query = input.id
    ? client.from('personal_savings_goals').update(payload).eq('workspace_id', workspaceId).eq('id', input.id)
    : client.from('personal_savings_goals').insert(payload)
  const { error } = await query
  const mapped = setupError(error)
  if (mapped) throw mapped
}

export async function deletePersonalSavingsGoal(workspaceId: string, id: string) {
  const { error } = await requireSupabase().from('personal_savings_goals').delete().eq('workspace_id', workspaceId).eq('id', id)
  const mapped = setupError(error)
  if (mapped) throw mapped
}

export async function savePersonalWishlistItem(workspaceId: string, input: { id?: string; categoryId?: string; name: string; estimatedAmount: number; priority: PersonalWishlistPriority; targetDate?: string; notes: string }) {
  const client = requireSupabase()
  const payload = {
    workspace_id: workspaceId,
    category_id: input.categoryId || null,
    name: input.name.trim(),
    estimated_amount: Math.round(input.estimatedAmount),
    priority: input.priority.toLowerCase(),
    target_date: input.targetDate || null,
    notes: input.notes.trim() || null,
  }
  const query = input.id
    ? client.from('personal_finance_wishlist').update(payload).eq('workspace_id', workspaceId).eq('id', input.id).eq('status', 'planned')
    : client.from('personal_finance_wishlist').insert(payload)
  const { error } = await query
  const mapped = setupError(error)
  if (mapped) throw mapped
}

export async function deletePersonalWishlistItem(workspaceId: string, id: string) {
  const { error } = await requireSupabase().from('personal_finance_wishlist').delete().eq('workspace_id', workspaceId).eq('id', id)
  const mapped = setupError(error)
  if (mapped) throw mapped
}

export async function purchasePersonalWishlistItem(workspaceId: string, input: { itemId: string; amount: number; purchasedOn: string; paymentMethod: string }) {
  const { error } = await requireSupabase().rpc('purchase_personal_wishlist', {
    p_workspace_id: workspaceId,
    p_item_id: input.itemId,
    p_amount: Math.round(input.amount),
    p_purchased_on: input.purchasedOn,
    p_payment_method: input.paymentMethod,
  })
  const mapped = setupError(error)
  if (mapped) throw mapped
}

export type PersonalTransactionInput = {
  id?: string
  categoryId?: string
  title: string
  kind: PersonalFinanceKind
  amount: number
  occurredOn: string
  paymentMethod: string
  notes: string
  scope: PersonalFinanceScope
  familyMember: string
  isRecurring: boolean
}
