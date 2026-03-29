# Choremap — Claude Code context

## Project overview
A home chore tracker with a visual space designer (canvas-based floor plan) and a task list.
Tasks are assigned to items placed on the canvas. The canvas acts as a heatmap showing
which areas are overdue based on task frequency.

## Stack
- Frontend: React 18 + Vite, TailwindCSS v4, Fabric.js (canvas), date-fns
- Backend: Supabase (Postgres + Realtime)
- Hosting: Railway (frontend static), Supabase (managed backend)
- Repo: GitHub, auto-deploy to Railway on push to main

## Key concepts
- **Space**: a named floor plan (e.g. "Ground floor"). Contains Items.
- **Item**: a shape on the canvas (rect/circle/label). Has a name, position/size, colour.
- **Task**: belongs to an Item. Has name, estimated_minutes, frequency (daily/weekly/fortnightly).
- **TaskCompletion**: log of when a task was marked done. Used to compute overdue status.
- **Heatmap**: each Item's canvas shape is tinted green→amber→red based on how overdue
  its most-overdue task is. Computed client-side from task_completions.

## File conventions
- Components in `src/components/`
- Supabase client singleton in `src/lib/supabase.js`
- Custom hooks in `src/hooks/`
- Heatmap logic in `src/lib/heatmap.js`
- DB types/helpers in `src/lib/db.js`
- Env vars via `.env.local` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

## Database schema (in supabase/migrations/)
See `supabase/migrations/0001_initial.sql`

## Commands
- `npm run dev` — local dev
- `npm run build` — production build (Railway runs this)
- `npm run preview` — preview production build

## Recent changes (snap grid, shapes, dark mode, nested tasks)
- Snap-to-grid added to SpaceDesigner (16px grid, toggle button in toolbar)
- Shape tool renamed: 'rect' draws rooms, 'circle' draws circular items; both already existed — no schema change needed
- Dark mode: Tailwind CSS class-based dark mode (`darkMode: 'class'` in config, toggle button in App.jsx header sets `dark` class on `<html>`)
- Task view hierarchy: Rooms (shape_type='rect') are top-level groups; Items (shape_type='circle' or 'label') nested underneath their parent room. Parent room is determined by spatial containment stored in a new optional `parent_id` column on `items`