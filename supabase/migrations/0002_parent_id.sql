alter table items add column if not exists parent_id uuid references items(id) on delete set null;
create index if not exists on items(parent_id);