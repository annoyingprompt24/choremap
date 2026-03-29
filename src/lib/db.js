import { supabase } from './supabase'

// ── Spaces ──────────────────────────────────────────────
export const getSpaces = () =>
  supabase.from('spaces').select('*').order('created_at')

export const createSpace = (name) =>
  supabase.from('spaces').insert({ name }).select().single()

// ── Items ────────────────────────────────────────────────
export const getItems = (spaceId) =>
  supabase.from('items').select('*').eq('space_id', spaceId).order('created_at')

export const upsertItem = (item) =>
  supabase.from('items').upsert(item).select().single()

export const deleteItem = (id) =>
  supabase.from('items').delete().eq('id', id)

// ── Tasks ────────────────────────────────────────────────
export const getTasks = (itemIds) =>
  supabase.from('tasks').select('*').in('item_id', itemIds).order('created_at')

export const createTask = (task) =>
  supabase.from('tasks').insert(task).select().single()

export const updateTask = (id, updates) =>
  supabase.from('tasks').update(updates).eq('id', id).select().single()

export const deleteTask = (id) =>
  supabase.from('tasks').delete().eq('id', id)

// ── Completions ──────────────────────────────────────────
export const getCompletions = (taskIds) =>
  supabase
    .from('task_completions')
    .select('*')
    .in('task_id', taskIds)
    .order('completed_at', { ascending: false })

export const completeTask = (taskId) =>
  supabase
    .from('task_completions')
    .insert({ task_id: taskId })
    .select()
    .single()
