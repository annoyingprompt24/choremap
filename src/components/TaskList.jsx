import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { overdueRatio } from '../lib/heatmap'
import * as db from '../lib/db'

const FREQ_LABELS = { daily: 'Daily', weekly: 'Weekly', fortnightly: 'Fortnightly' }

function TaskRow({ task, completions, onComplete, onEdit, onDelete }) {
  const ratio = overdueRatio(task, completions)
  const lastComp = completions
    .filter(c => c.task_id === task.id)
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0]

  const statusColour = ratio === 0 ? 'text-green-600' : ratio < 1 ? 'text-amber-600' : 'text-red-600'
  const statusLabel  = ratio === 0 ? 'On time' : ratio < 1 ? 'Due soon' : 'Overdue'

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 group">
      <button
        onClick={() => onComplete(task.id)}
        className="w-5 h-5 rounded border-2 border-gray-300 hover:border-green-500 flex-shrink-0 transition"
        title="Mark done"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-800">{task.name}</span>
        <span className="ml-2 text-xs text-gray-400">{task.estimated_minutes} min · {FREQ_LABELS[task.frequency]}</span>
      </div>
      <span className={`text-xs font-medium ${statusColour}`}>{statusLabel}</span>
      {lastComp && (
        <span className="text-xs text-gray-400 hidden sm:block">
          {formatDistanceToNow(parseISO(lastComp.completed_at), { addSuffix: true })}
        </span>
      )}
      <div className="hidden group-hover:flex gap-1">
        <button onClick={() => onEdit(task)} className="text-xs px-2 py-0.5 rounded border border-gray-200 hover:bg-white">Edit</button>
        <button onClick={() => onDelete(task.id)} className="text-xs px-2 py-0.5 rounded border border-red-100 text-red-500 hover:bg-red-50">✕</button>
      </div>
    </div>
  )
}

function TaskForm({ itemId, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', estimated_minutes: 15, frequency: 'weekly' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (initial?.id) {
      await db.updateTask(initial.id, form)
    } else {
      await db.createTask({ ...form, item_id: itemId })
    }
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Task name</label>
        <input
          className="border border-gray-300 rounded px-2 py-1 text-sm w-44"
          value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="e.g. Vacuum floor" required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Est. minutes</label>
        <input
          type="number" min={1} max={480}
          className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
          value={form.estimated_minutes} onChange={e => set('estimated_minutes', +e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Frequency</label>
        <select
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          value={form.frequency} onChange={e => set('frequency', e.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Fortnightly</option>
        </select>
      </div>
      <div className="flex gap-2 mb-0.5">
        <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Save</button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-100">Cancel</button>
      </div>
    </form>
  )
}

export function TaskList({ items, tasks, completions, selectedItemId, onReload }) {
  const [addingToItemId, setAddingToItemId] = useState(null)
  const [editingTask, setEditingTask] = useState(null)

  const handleComplete = async (taskId) => {
    await db.completeTask(taskId)
    onReload()
  }

  const handleDelete = async (taskId) => {
    if (!confirm('Delete this task?')) return
    await db.deleteTask(taskId)
    onReload()
  }

  const handleSave = () => {
    setAddingToItemId(null)
    setEditingTask(null)
    onReload()
  }

  const tasksByItem = items.reduce((acc, item) => {
    acc[item.id] = tasks.filter(t => t.item_id === item.id)
    return acc
  }, {})

  const sortedItems = [...items].sort((a, b) => {
    if (a.id === selectedItemId) return -1
    if (b.id === selectedItemId) return 1
    return 0
  })

  return (
    <div className="flex flex-col gap-4">
      {sortedItems.map(item => (
        <div
          key={item.id}
          className={`rounded-xl border transition ${
            item.id === selectedItemId ? 'border-blue-400 shadow-sm' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <h3 className="font-medium text-gray-800 text-sm">{item.name}</h3>
            <button
              onClick={() => setAddingToItemId(item.id)}
              className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded border border-blue-100"
            >
              + Add task
            </button>
          </div>
          <div className="px-2 py-1">
            {tasksByItem[item.id]?.length === 0 && addingToItemId !== item.id && (
              <p className="text-xs text-gray-400 px-2 py-2">No tasks yet</p>
            )}
            {tasksByItem[item.id]?.map(task =>
              editingTask?.id === task.id ? (
                <TaskForm key={task.id} initial={editingTask} onSave={handleSave} onCancel={() => setEditingTask(null)} />
              ) : (
                <TaskRow
                  key={task.id}
                  task={task}
                  completions={completions}
                  onComplete={handleComplete}
                  onEdit={setEditingTask}
                  onDelete={handleDelete}
                />
              )
            )}
            {addingToItemId === item.id && (
              <div className="mt-1">
                <TaskForm itemId={item.id} onSave={handleSave} onCancel={() => setAddingToItemId(null)} />
              </div>
            )}
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">Draw some items on the canvas to get started</p>
      )}
    </div>
  )
}
