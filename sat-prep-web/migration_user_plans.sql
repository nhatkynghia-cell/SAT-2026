-- ============================================================================
--  MIGRATION — bảng public.user_plans (Cụm A2 — LỘ TRÌNH CÁ NHÂN / journey)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run. Idempotent (chạy lại an toàn).
--  Convention KHỚP user_goals/user_mastery: user_id UUID REFERENCES auth.users(id)
--  + RLS auth.uid() = user_id (mỗi user chỉ đọc/ghi lộ trình của chính mình).
-- ============================================================================

-- PLAN — lưu cả WeeklyPlan (JSON) do buildWeeklyPlan sinh ra. 1 dòng/user.
-- Lộ trình được sinh từ mastery + điểm mục tiêu hiện tại rồi cache tại đây;
-- nút "Tạo lại lộ trình" (POST /api/journey) sẽ upsert đè bản mới.
create table if not exists public.user_plans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  plan       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================================
--  RLS — mỗi user chỉ đọc/ghi lộ trình của chính mình (CLONE mẫu own_goals)
-- ============================================================================
alter table public.user_plans enable row level security;

-- Idempotent: bỏ policy cũ trước khi tạo lại (create policy không có "if not exists").
drop policy if exists "own_plans" on public.user_plans;
create policy "own_plans" on public.user_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
