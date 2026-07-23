-- ============================================================================
--  Bảng user_goals (điểm mục tiêu SAT theo user) — dùng bởi goals-store.ts
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent)
-- ============================================================================
--  Lưu điểm mục tiêu (target_score 400..1600) để Score Prediction hiện "còn cách
--  mục tiêu bao nhiêu điểm" + Journey/Dashboard đặt mục tiêu. 1 dòng/user.
--
--  BẢO MẬT: KHÁC user_subscriptions (quyền lợi trả phí, chỉ service-role ghi),
--  điểm mục tiêu KHÔNG phải quyền lợi — user tự đặt cho mình là hợp lệ. Cho phép
--  authenticated INSERT/UPDATE/SELECT dòng CỦA MÌNH (auth.uid()=user_id). Không
--  có faucet risk (chỉ là con số động viên, không mở khóa gì).
--
--  FAIL-SAFE: bảng chưa có → loadGoal trả null → prediction bỏ phần "còn cách
--  mục tiêu" (không vỡ). saveGoal (admin client) sẽ lỗi tới khi chạy migration này.
-- ============================================================================

create table if not exists public.user_goals (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  target_score integer     not null check (target_score >= 400 and target_score <= 1600),
  updated_at   timestamptz not null default now()
);

alter table public.user_goals enable row level security;

-- User đọc/ghi mục tiêu CỦA MÌNH (không phải quyền lợi → cho ghi an toàn).
create policy "user_goals_select_own" on public.user_goals
  for select to authenticated
  using (auth.uid() = user_id);

create policy "user_goals_insert_own" on public.user_goals
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "user_goals_update_own" on public.user_goals
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
