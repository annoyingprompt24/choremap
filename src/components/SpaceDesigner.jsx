import { useEffect, useRef, useState, useCallback } from 'react'
import { fabric } from 'fabric'
import { itemOverdueRatio, ratioToColour } from '../lib/heatmap'
import * as db from '../lib/db'

const GRID_SIZE = 16

const SHAPE_DEFAULTS = {
  rect: {
    width: 160, height: 100,
    fill: 'rgba(200,220,255,0.25)',
    stroke: '#4a80d4', strokeWidth: 1.5,
  },
  circle: {
    radius: 40,
    fill: 'rgba(200,255,220,0.35)',
    stroke: '#4ad48a', strokeWidth: 1.5,
  },
}

function snapVal(v, snap) {
  return snap ? Math.round(v / GRID_SIZE) * GRID_SIZE : v
}

export function SpaceDesigner({
  space, items, tasks, completions,
  onItemsChange, selectedItemId, onSelectItem,
}) {
  const canvasEl = useRef(null)
  const fabricRef = useRef(null)
  const [activeTool, setActiveTool] = useState('select')
  const [snapEnabled, setSnapEnabled] = useState(true)

  // Init canvas
  useEffect(() => {
    const canvas = new fabric.Canvas(canvasEl.current, {
      backgroundColor: 'transparent',
      selection: true,
    })
    fabricRef.current = canvas

    canvas.on('object:moving', (e) => {
      if (!snapEnabled) return
      const obj = e.target
      obj.set({
        left: snapVal(obj.left, true),
        top: snapVal(obj.top, true),
      })
    })

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

  // Draw grid overlay
  const drawGrid = useCallback((canvas) => {
    if (!snapEnabled) return
    const width = canvas.getWidth()
    const height = canvas.getHeight()
    const lines = []
    for (let x = 0; x <= width; x += GRID_SIZE) {
      lines.push(new fabric.Line([x, 0, x, height], {
        stroke: 'rgba(100,120,160,0.12)', strokeWidth: 0.5,
        selectable: false, evented: false, excludeFromExport: true,
        data: { isGrid: true },
      }))
    }
    for (let y = 0; y <= height; y += GRID_SIZE) {
      lines.push(new fabric.Line([0, y, width, y], {
        stroke: 'rgba(100,120,160,0.12)', strokeWidth: 0.5,
        selectable: false, evented: false, excludeFromExport: true,
        data: { isGrid: true },
      }))
    }
    lines.forEach(l => canvas.add(l))
    canvas.sendToBack(...lines)
  }, [snapEnabled])

  // Reload items onto canvas
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    // Remove non-grid objects
    canvas.getObjects().filter(o => !o.data?.isGrid).forEach(o => canvas.remove(o))
    // Remove old grid
    canvas.getObjects().filter(o => o.data?.isGrid).forEach(o => canvas.remove(o))
    if (snapEnabled) drawGrid(canvas)

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
  }, [items, tasks, completions, snapEnabled, drawGrid])

  // Sync snap ref for event handler
  const snapRef = useRef(snapEnabled)
  useEffect(() => { snapRef.current = snapEnabled }, [snapEnabled])

  // Drawing handler
  const handleCanvasClick = useCallback(async (e) => {
    const canvas = fabricRef.current
    const rawPointer = canvas.getPointer(e.e || e)
    const pointer = {
      x: snapVal(rawPointer.x, snapRef.current),
      y: snapVal(rawPointer.y, snapRef.current),
    }

    const name = prompt(`Name this ${activeTool}:`)
    if (!name) return

    let obj
    if (activeTool === 'rect') {
      obj = new fabric.Rect({
        ...SHAPE_DEFAULTS.rect,
        left: pointer.x - SHAPE_DEFAULTS.rect.width / 2,
        top: pointer.y - SHAPE_DEFAULTS.rect.height / 2,
      })
    } else if (activeTool === 'circle') {
      obj = new fabric.Circle({
        ...SHAPE_DEFAULTS.circle,
        left: pointer.x - SHAPE_DEFAULTS.circle.radius,
        top: pointer.y - SHAPE_DEFAULTS.circle.radius,
      })
    } else if (activeTool === 'label') {
      obj = new fabric.IText(name, {
        left: pointer.x, top: pointer.y, fontSize: 14,
        fill: '#555',
      })
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
  }, [activeTool, space.id, onItemsChange])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.off('mouse:down')
    canvas.defaultCursor = activeTool !== 'select' ? 'crosshair' : 'default'
    if (activeTool !== 'select') canvas.on('mouse:down', handleCanvasClick)
  }, [activeTool, handleCanvasClick])

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

  const tools = [
    { id: 'select', label: '↖ Select' },
    { id: 'rect',   label: '▭ Room' },
    { id: 'circle', label: '○ Item' },
    { id: 'label',  label: 'T Label' },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center flex-wrap">
        {tools.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            className={`px-3 py-1.5 rounded text-sm font-medium border transition
              ${activeTool === t.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            {t.label}
          </button>
        ))}

        <button
          onClick={() => setSnapEnabled(s => !s)}
          className={`px-3 py-1.5 rounded text-sm border transition
            ${snapEnabled
              ? 'bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700'
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}
        >
          ⊞ Snap {snapEnabled ? 'on' : 'off'}
        </button>

        <button
          onClick={handleDelete}
          className="ml-auto px-3 py-1.5 rounded text-sm border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
        >
          Delete selected
        </button>
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
        <canvas ref={canvasEl} width={800} height={500} />
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
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