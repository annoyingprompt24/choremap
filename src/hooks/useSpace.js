import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import * as db from '../lib/db'

export function useSpace(spaceId) {
  const [items, setItems] = useState([])
  const [tasks, setTasks] = useState([])
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    if (!spaceId) return
    setLoading(true)

    const { data: itemsData } = await db.getItems(spaceId)
    const itemIds = (itemsData || []).map(i => i.id)

    let tasksData = []
    let compsData = []

    if (itemIds.length) {
      const { data: t } = await db.getTasks(itemIds)
      tasksData = t || []
      const taskIds = tasksData.map(t => t.id)
      if (taskIds.length) {
        const { data: c } = await db.getCompletions(taskIds)
        compsData = c || []
      }
    }

    setItems(itemsData || [])
    setTasks(tasksData)
    setCompletions(compsData)
    setLoading(false)
  }, [spaceId])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (!spaceId) return
    const channel = supabase
      .channel(`space-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, loadAll)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [spaceId, loadAll])

  return { items, tasks, completions, loading, reload: loadAll, setItems, setTasks }
}
