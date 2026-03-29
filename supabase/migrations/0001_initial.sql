-- Spaces (named floor plans)
create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Items (shapes on the canvas)
create table items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade not null,
  name text not null,
  shape_type text not null check (shape_type in ('rect','circle','label')),
  canvas_data jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Tasks (chores assigned to items)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade not null,
  name text not null,
  estimated_minutes integer not null default 15,
  frequency text not null check (frequency in ('daily','weekly','fortnightly')),
  created_at timestamptz default now()
);

-- Task completions (history log)
create table task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  completed_at timestamptz default now()
);

-- Indexes for common queries
create index on items(space_id);
create index on tasks(item_id);
create index on task_completions(task_id);
create index on task_completions(completed_at);

-- Enable realtime on tasks and completions
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_completions;
