import { useEffect, useRef, useState } from 'react'
import { fabric } from 'fabric'
import { itemOverdueRatio, ratioToColour } from '../lib/heatmap'
import * as db from '../lib/db'

const SHAPE_DEFAULTS = {
  rect:   { width: 120, height: 80, fill: 'rgba(200,220,255,0.4)', stroke: '#4a80d4', strokeWidth: 1.5 },
  circle: { radius: 50,             fill: 'rgba(200,255,220,0.4)', stroke: '#4ad48a', strokeWidth: 1.5 },
}

export function SpaceDesigner({ space, items, tasks, completions, onItemsChange, selectedItemId, onSelectItem }) {
  const canvasEl = useRef(null)
  const fabricRef = useRef(null)
  const [activeTool, setActiveTool] = useState('select')

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasEl.current, {
      backgroundColor: '#f8f9fa',
      selection: true,
    })
    fabricRef.current = canvas

    canvas.on('object:modified', async (e) => {
      const obj = e.target
      if (!obj?.itemId) return
      await db.upsertItem({
        id: obj.itemId,
        space_id: space.id,
        name: obj.itemName || 'Unnamed',
        shape_type: obj.shapeType,
        canvas_data: obj.toObject(['itemId', 'itemName', 'shapeType']),
      })
      onItemsChange?.()
    })

    canvas.on('selection:created', (e) => {
      onSelectItem?.(e.selected?.[0]?.itemId || null)
    })
    canvas.on('selection:cleared', () => onSelectItem?.(null))

    return () => canvas.dispose()
  }, [space.id]) // eslint-disable-line

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.clear()
    canvas.backgroundColor = '#f8f9fa'

    items.forEach(item => {
      const ratio = itemOverdueRatio(item, tasks, completions)
      const heatColour = ratioToColour(ratio)

      fabric.util.enlivenObjects([item.canvas_data], ([obj]) => {
        if (!obj) return
        obj.set({ itemId: item.id, itemName: item.name, shapeType: item.shape_type })
        if (heatColour !== 'rgba(0,0,0,0)') obj.set('fill', heatColour)
        canvas.add(obj)
        canvas.renderAll()
      })
    })
  }, [items, tasks, completions])

  const handleCanvasClick = async (e) => {
    if (activeTool === 'select') return
    const canvas = fabricRef.current
    const pointer = canvas.getPointer(e.e || e)

    const name = prompt(`Name this ${activeTool}:`)
    if (!name) return

    let obj
    if (activeTool === 'rect') {
      obj = new fabric.Rect({ ...SHAPE_DEFAULTS.rect, left: pointer.x - 60, top: pointer.y - 40 })
    } else if (activeTool === 'circle') {
      obj = new fabric.Circle({ ...SHAPE_DEFAULTS.circle, left: pointer.x - 50, top: pointer.y - 50 })
    } else if (activeTool === 'label') {
      obj = new fabric.IText(name, { left: pointer.x, top: pointer.y, fontSize: 14, fill: '#333' })
    }
    if (!obj) return

    const shapeType = activeTool === 'label' ? 'label' : activeTool
    const { data: newItem } = await db.upsertItem({
      space_id: space.id,
      name,
      shape_type: shapeType,
      canvas_data: obj.toObject(),
    })

    if (newItem) {
      obj.set({ itemId: newItem.id, itemName: name, shapeType })
      canvas.add(obj)
      canvas.setActiveObject(obj)
      canvas.renderAll()
      onItemsChange?.()
    }
    setActiveTool('select')
  }

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.off('mouse:down')
    if (activeTool !== 'select') {
      canvas.defaultCursor = 'crosshair'
      canvas.on('mouse:down', handleCanvasClick)
    } else {
      canvas.defaultCursor = 'default'
    }
  }, [activeTool]) // eslint-disable-line

  const handleDelete = async () => {
    const canvas = fabricRef.current
    const active = canvas?.getActiveObject()
    if (!active?.itemId) return
    if (!confirm(`Delete "${active.itemName}" and all its tasks?`)) return
    await db.deleteItem(active.itemId)
    canvas.remove(active)
    canvas.renderAll()
    onItemsChange?.()
    onSelectItem?.(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        {['select','rect','circle','label'].map(tool => (
          <button
            key={tool}
            onClick={() => setActiveTool(tool)}
            className={`px-3 py-1.5 rounded text-sm font-medium border transition
              ${activeTool === tool
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {tool === 'select' ? '↖ Select' : tool === 'rect' ? '▭ Room' : tool === 'circle' ? '○ Item' : 'T Label'}
          </button>
        ))}
        <button onClick={handleDelete} className="ml-auto px-3 py-1.5 rounded text-sm border border-red-200 text-red-600 hover:bg-red-50">
          Delete selected
        </button>
      </div>
      <canvas ref={canvasEl} width={800} height={500} className="border border-gray-200 rounded-lg shadow-sm" />
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>Heatmap:</span>
        {[['bg-green-400','On time'],['bg-amber-400','Due soon'],['bg-red-400','Overdue']].map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-full ${cls}`} />
            {label}
          </span>
        ))}
        <span className="ml-2 text-gray-400">Items with no tasks have no colour</span>
      </div>
    </div>
  )
}
