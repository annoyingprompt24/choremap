import { useState, useEffect } from 'react'
import { SpaceDesigner } from './components/SpaceDesigner'
import { TaskList } from './components/TaskList'
import { useSpace } from './hooks/useSpace'
import * as db from './lib/db'

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('choremap-dark')
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('choremap-dark', dark)
  }, [dark])

  return [dark, setDark]
}

export default function App() {
  const [spaces, setSpaces] = useState([])
  const [activeSpaceId, setActiveSpaceId] = useState(null)
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [view, setView] = useState('designer')
  const [dark, setDark] = useDarkMode()

  const { items, tasks, completions, loading, reload } = useSpace(activeSpaceId)

  useEffect(() => {
    db.getSpaces().then(({ data }) => {
      setSpaces(data || [])
      if (data?.length) setActiveSpaceId(data[0].id)
    })
  }, [])

  const handleCreateSpace = async () => {
    const name = prompt('Space name (e.g. "Ground floor"):')
    if (!name) return
    const { data } = await db.createSpace(name)
    if (data) {
      setSpaces(s => [...s, data])
      setActiveSpaceId(data.id)
    }
  }

  const activeSpace = spaces.find(s => s.id === activeSpaceId)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Choremap</h1>

        <div className="flex items-center gap-2">
          <select
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm"
            value={activeSpaceId || ''}
            onChange={e => setActiveSpaceId(e.target.value)}
          >
            {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={handleCreateSpace} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            + New space
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Dark mode toggle */}
          <button
            onClick={() => setDark(d => !d)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? '☀' : '☾'}
          </button>

          {/* View toggle */}
          <div className="flex border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
            {['designer', 'tasks'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm transition ${
                  view === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {v === 'designer' ? '🗺 Designer' : '✅ Tasks'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4">
        {!activeSpace ? (
          <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <p className="mb-3">No spaces yet</p>
              <button
                onClick={handleCreateSpace}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create your first space
              </button>
            </div>
          </div>
        ) : loading ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm">Loading…</p>
        ) : view === 'designer' ? (
          <SpaceDesigner
            space={activeSpace}
            items={items}
            tasks={tasks}
            completions={completions}
            onItemsChange={reload}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
          />
        ) : (
          <div className="max-w-2xl">
            <TaskList
              items={items}
              tasks={tasks}
              completions={completions}
              selectedItemId={selectedItemId}
              onReload={reload}
            />
          </div>
        )}
      </main>
    </div>
  )
}