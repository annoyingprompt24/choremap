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

  const statusColour =
    ratio === 0 ? 'text-green-600 dark:text-green-400'
    : ratio < 1  ? 'text-amber-600 dark:text-amber-400'
                 : 'text-red-600 dark:text-red-400'
  const statusLabel = ratio === 0 ? 'On time' : ratio < 1 ? 'Due soon' : 'Overdue'

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
      <button
        onClick={() => onComplete(task.id)}
        className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 hover:border-green-500 flex-shrink-0 transition"
        title="Mark done"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{task.name}</span>
        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
          {task.estimated_minutes} min · {FREQ_LABELS[task.frequency]}
        </span>
      </div>
      <span className={`text-xs font-medium ${statusColour}`}>{statusLabel}</span>
      {lastComp && (
        <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
          {formatDistanceToNow(parseISO(lastComp.completed_at), { addSuffix: true })}
        </span>
      )}
      <div className="hidden group-hover:flex gap-1">
        <button
          onClick={() => onEdit(task)}
          className="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="text-xs px-2 py-0.5 rounded border border-red-100 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function TaskForm({ itemId, initial, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial || { name: '', estimated_minutes: 15, frequency: 'weekly' }
  )
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

  const inputCls = 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm'

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap gap-2 items-end p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 dark:text-gray-400">Task name</label>
        <input
          className={`${inputCls} w-44`}
          value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="e.g. Vacuum floor" required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 dark:text-gray-400">Est. minutes</label>
        <input
          type="number" min={1} max={480}
          className={`${inputCls} w-20`}
          value={form.estimated_minutes} onChange={e => set('estimated_minutes', +e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 dark:text-gray-400">Frequency</label>
        <select className={inputCls} value={form.frequency} onChange={e => set('frequency', e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Fortnightly</option>
        </select>
      </div>
      <div className="flex gap-2 mb-0.5">
        <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Save</button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
      </div>
    </form>
  )
}

// Rooms are rect items; non-rooms are circle/label items nested under them
function buildHierarchy(items) {
  const rooms = items.filter(i => i.shape_type === 'rect')
  const nonRooms = items.filter(i => i.shape_type !== 'rect')

  // Nest by parent_id if set, otherwise show as ungrouped under a catch-all
  const grouped = rooms.map(room => ({
    room,
    children: nonRooms.filter(i => i.parent_id === room.id),
  }))

  const ungrouped = nonRooms.filter(i => !i.parent_id)

  return { grouped, ungrouped }
}

function ItemTaskSection({ item, tasks, completions, selectedItemId, addingToItemId, setAddingToItemId, editingTask, setEditingTask, onComplete, onDelete, onSave, indent }) {
  const itemTasks = tasks.filter(t => t.item_id === item.id)

  return (
    <div className={indent ? 'ml-4 border-l border-gray-200 dark:border-gray-700 pl-3' : ''}>
      <div className="flex items-center justify-between py-1.5 px-2">
        <span className={`text-sm ${indent ? 'text-gray-600 dark:text-gray-400' : 'font-medium text-gray-800 dark:text-gray-100'}`}>
          {indent ? '○' : '▭'} {item.name}
          {item.id === selectedItemId && (
            <span className="ml-2 text-xs text-blue-500">selected</span>
          )}
        </span>
        <button
          onClick={() => setAddingToItemId(item.id)}
          className="text-xs px-2 py-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded border border-blue-100 dark:border-blue-800"
        >
          + Add task
        </button>
      </div>

      <div className="px-1">
        {itemTasks.length === 0 && addingToItemId !== item.id && (
          <p className="text-xs text-gray-400 dark:text-gray-600 px-2 pb-1">No tasks</p>
        )}
        {itemTasks.map(task =>
          editingTask?.id === task.id ? (
            <TaskForm key={task.id} initial={editingTask} onSave={onSave} onCancel={() => setEditingTask(null)} />
          ) : (
            <TaskRow
              key={task.id}
              task={task}
              completions={completions}
              onComplete={onComplete}
              onEdit={setEditingTask}
              onDelete={onDelete}
            />
          )
        )}
        {addingToItemId === item.id && (
          <div className="mt-1 mb-2">
            <TaskForm itemId={item.id} onSave={onSave} onCancel={() => setAddingToItemId(null)} />
          </div>
        )}
      </div>
    </div>
  )
}

export function TaskList({ items, tasks, completions, selectedItemId, onReload }) {
  const [addingToItemId, setAddingToItemId] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [collapsedRooms, setCollapsedRooms] = useState({})

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

  const toggleRoom = (id) => setCollapsedRooms(c => ({ ...c, [id]: !c[id] }))

  const { grouped, ungrouped } = buildHierarchy(items)

  const sharedProps = { tasks, completions, selectedItemId, addingToItemId, setAddingToItemId, editingTask, setEditingTask, onComplete: handleComplete, onDelete: handleDelete, onSave: handleSave }

  return (
    <div className="flex flex-col gap-3">
      {grouped.map(({ room, children }) => (
        <div key={room.id} className="rounded-xl border border-gray-200 dark:border-gray-700">
          {/* Room header */}
          <button
            onClick={() => toggleRoom(room.id)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-t-xl text-left"
          >
            <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2">
              <span className="text-gray-400 dark:text-gray-500 text-xs">{collapsedRooms[room.id] ? '▶' : '▼'}</span>
              {room.name}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {tasks.filter(t => [room.id, ...children.map(c => c.id)].includes(t.item_id)).length} tasks
            </span>
          </button>

          {!collapsedRooms[room.id] && (
            <div className="p-2">
              {/* Room's own tasks */}
              <ItemTaskSection item={room} indent={false} {...sharedProps} />

              {/* Nested child items */}
              {children.map(child => (
                <ItemTaskSection key={child.id} item={child} indent={true} {...sharedProps} />
              ))}

              {children.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 px-3 pb-2">
                  No items nested under this room
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Ungrouped items (no parent room) */}
      {ungrouped.length > 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Ungrouped items</span>
          </div>
          <div className="p-2">
            {ungrouped.map(item => (
              <ItemTaskSection key={item.id} item={item} indent={false} {...sharedProps} />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
          Draw some rooms on the canvas to get started
        </p>
      )}
    </div>
  )
}