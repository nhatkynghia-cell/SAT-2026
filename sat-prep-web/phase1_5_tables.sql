-- ============================================================================
--  PHASE 1.5 / Nhóm 1.1 — Tạo 4 bảng còn thiếu trên Supabase
--  Chạy trong: Supabase Dashboard → SQL Editor → Run
--  Convention KHỚP bảng cũ user_economy: user_id UUID REFERENCES auth.users(id)
--  + RLS auth.uid() = user_id (user đăng nhập thật).
-- ============================================================================

-- 1) MASTERY — khớp MasteryStore { skills: Record<skillId,{score,attempts,correct,lastSeen}> }
create table if not exists public.user_mastery (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  skills     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) GOALS — khớp GoalData { targetScore, updatedAt }
create table if not exists public.user_goals (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  target_score integer,
  updated_at   timestamptz not null default now()
);

-- 3) AI USAGE — khớp UsageRecord { date, count, tokensIn, tokensOut } (1 dòng/user, reset theo ngày trong code)
create table if not exists public.user_ai_usage (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  date       text    not null default '',
  count      integer not null default 0,
  tokens_in  integer not null default 0,
  tokens_out integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 4) VOCAB SRS — khớp VocabData { words: [...] }
create table if not exists public.user_vocab_srs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  words      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================================
--  RLS — mỗi user chỉ đọc/ghi dữ liệu của chính mình
-- ============================================================================
alter table public.user_mastery   enable row level security;
alter table public.user_goals     enable row level security;
alter table public.user_ai_usage  enable row level security;
alter table public.user_vocab_srs enable row level security;

create policy "own_mastery"   on public.user_mastery   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_goals"     on public.user_goals     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_ai_usage"  on public.user_ai_usage  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_vocab_srs" on public.user_vocab_srs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
--  5) MỞ RỘNG user_mistakes — thêm cột SRS (Leitner) để hợp nhất sổ tay câu sai
--     (bảng đã tồn tại sẵn; chỉ thêm cột, giữ nguyên dữ liệu)
-- ============================================================================
alter table public.user_mistakes add column if not exists box integer not null default 1;
alter table public.user_mistakes add column if not exists next_review text;
