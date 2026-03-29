import { useState, useEffect } from 'react'
import { SpaceDesigner } from './components/SpaceDesigner'
import { TaskList } from './components/TaskList'
import { useSpace } from './hooks/useSpace'
import * as db from './lib/db'

export default function App() {
  const [spaces, setSpaces] = useState([])
  const [activeSpaceId, setActiveSpaceId] = useState(null)
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [view, setView] = useState('designer')

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900">Choremap</h1>
        <div className="flex items-center gap-2">
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm"
            value={activeSpaceId || ''}
            onChange={e => setActiveSpaceId(e.target.value)}
          >
            {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={handleCreateSpace} className="text-sm text-blue-600 hover:underline">+ New space</button>
        </div>
        <div className="ml-auto flex border border-gray-200 rounded overflow-hidden">
          {['designer','tasks'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm capitalize ${
                view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v === 'designer' ? '🗺 Designer' : '✅ Tasks'}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 p-4">
        {!activeSpace ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="text-center">
              <p className="mb-3">No spaces yet</p>
              <button onClick={handleCreateSpace} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Create your first space
              </button>
            </div>
          </div>
        ) : loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
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
