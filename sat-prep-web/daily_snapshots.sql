-- ============================================================================
--  PARENT DASHBOARD — Bảng daily_snapshots (time-series tiến độ theo ngày)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (hoặc direct pg)
-- ============================================================================
--  App CHỈ có snapshot mastery hiện tại (không lịch sử). Báo cáo tuần cho phụ
--  huynh cần time-series → bảng này lưu 1 ảnh chụp/ngày/user.
--
--  Cơ chế ghi = LAZY snapshot: mỗi khi học sinh nộp câu (/api/grade) →
--  recordDailySnapshot upsert theo (user_id, snapshot_date VN). Không cần cron.
--  Ngày không học → không có row ngày đó (chấp nhận được — trend bỏ qua ngày trống).
--
--  🔴 BẢO MẬT — RLS: user SELECT dòng CỦA MÌNH (dashboard cá nhân). Ghi chỉ qua
--  service-role (recordDailySnapshot dùng admin client). Phụ huynh đọc snapshot
--  của con qua service-role trong /api/parent/report (bypass RLS, đã resolve mã).
--  FAIL-SAFE: bảng chưa có → store bỏ qua ghi (fire-and-forget) + trend rỗng.
-- ============================================================================

create table if not exists public.daily_snapshots (
  user_id         uuid        not null references auth.users(id) on delete cascade,
  snapshot_date   date        not null,
  overall         integer     not null default 0,
  math_section    integer     not null default 0,
  reading_section integer     not null default 0,
  total_score     integer     not null default 0,
  total_attempts  integer     not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (user_id, snapshot_date)
);

-- Tra dải snapshot của 1 user theo ngày (báo cáo tuần: since >= today-7).
create index if not exists daily_snapshots_user_date_idx
  on public.daily_snapshots (user_id, snapshot_date desc);

alter table public.daily_snapshots enable row level security;

-- User đọc time-series CỦA MÌNH (dashboard cá nhân "xu hướng tuần").
create policy "daily_snapshots_select_own" on public.daily_snapshots
  for select to authenticated
  using (auth.uid() = user_id);
