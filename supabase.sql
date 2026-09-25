-- ===== English Workspace · schema for Supabase =====
-- Виконати один раз: Supabase → SQL Editor → New query → вставити все → Run.

-- 1. Таблиця прогресу: галочки домашки, вивчені слова, відповіді в аркушах уроків.
create table if not exists public.progress (
  student_id text not null,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (student_id, key)
);

-- 2. Таблиця подій: кожне проходження квізу окремим рядком.
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  student_id text not null,
  kind       text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_student_created_idx
  on public.events (student_id, created_at desc);

-- 3. Row Level Security.
-- Сайт ходить у базу публічним anon-ключем, тому права даємо мінімальні:
-- писати й читати прогрес можна, видаляти — ні. Історію квізів не можна навіть
-- переписати заднім числом.
alter table public.progress enable row level security;
alter table public.events   enable row level security;

drop policy if exists progress_rw     on public.progress;
drop policy if exists progress_select on public.progress;
drop policy if exists progress_insert on public.progress;
drop policy if exists progress_update on public.progress;

create policy progress_select on public.progress for select to anon using (true);
create policy progress_insert on public.progress for insert to anon with check (true);
create policy progress_update on public.progress for update to anon using (true) with check (true);

drop policy if exists events_insert on public.events;
drop policy if exists events_select on public.events;

create policy events_insert on public.events for insert to anon with check (true);
create policy events_select on public.events for select to anon using (true);

-- Готово. Далі: Project Settings → API → скопіювати Project URL і anon public key
-- у data/config.json. НІКОЛИ не копіювати service_role key — він дає повний доступ.
