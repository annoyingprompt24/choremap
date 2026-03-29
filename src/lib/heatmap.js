import { differenceInDays, parseISO } from 'date-fns'

const FREQUENCY_DAYS = {
  daily: 1,
  weekly: 7,
  fortnightly: 14,
}

/**
 * Given a task and its completions, return an overdue ratio (0 = on time, 1+ = overdue).
 */
export function overdueRatio(task, completions) {
  const period = FREQUENCY_DAYS[task.frequency]
  if (!period) return 0

  const relevantCompletions = completions
    .filter(c => c.task_id === task.id)
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))

  const lastDone = relevantCompletions[0]?.completed_at
  const daysSince = lastDone
    ? differenceInDays(new Date(), parseISO(lastDone))
    : period * 2 // Never done = treat as double overdue

  return daysSince / period
}

/**
 * For an item, return the worst (highest) overdue ratio across all its tasks.
 */
export function itemOverdueRatio(item, tasks, completions) {
  const itemTasks = tasks.filter(t => t.item_id === item.id)
  if (itemTasks.length === 0) return null

  const ratios = itemTasks.map(t => overdueRatio(t, completions))
  return Math.max(...ratios)
}

/**
 * Convert a ratio to a CSS rgba colour string for canvas overlay.
 * 0   → transparent green
 * 0.5 → amber
 * 1+  → red
 */
export function ratioToColour(ratio) {
  if (ratio === null) return 'rgba(0,0,0,0)'
  if (ratio <= 0.5) {
    const t = ratio * 2
    const r = Math.round(34 + (245 - 34) * t)
    const g = Math.round(197 + (158 - 197) * t)
    const b = Math.round(94 + (11 - 94) * t)
    return `rgba(${r},${g},${b},0.45)`
  }
  const t = Math.min((ratio - 0.5) * 2, 1)
  const r = Math.round(245 + (220 - 245) * t)
  const g = Math.round(158 + (38 - 158) * t)
  const b = Math.round(11 + (38 - 11) * t)
  return `rgba(${r},${g},${b},0.55)`
}
