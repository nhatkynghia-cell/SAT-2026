-- ============================================================================
--  MIGRATION — DAILY ACTIVITY COUNTER (quest vocab/exam completion server-side)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent)
-- ============================================================================
--  Đóng gap fail-open: quest 'vocab-reviewed' / 'exam-completed' trước đây
--  checkQuestCompletion trả 'unknown' (không đo được) → cho claim tự do. Nay
--  server đếm hoạt động THẬT theo ngày VN trong bảng này qua RPC atomic
--  bump_daily_activity → quest route đối chiếu như 'answer-correct'.
--
--  🔴 KHÔNG đụng coins/xp — chỉ counter. Route tiền (vocab/exam) tăng đếm
--  fire-and-forget; quest route đọc để gate. Client KHÔNG ghi (chỉ RPC service).
--
--  FAIL-SAFE: chưa chạy migration → count trả NULL → quest route FAIL-OPEN
--  (giữ hành vi cũ, 0 regression). bump lỗi → nuốt (không vỡ đường thưởng).
-- ============================================================================

create table if not exists public.user_daily_activity (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  activity_date date        not null,
  kind          text        not null check (kind in ('vocab_review', 'exam_complete')),
  count         integer     not null default 0 check (count >= 0),
  updated_at    timestamptz not null default now(),
  primary key (user_id, activity_date, kind)
);

alter table public.user_daily_activity enable row level security;

-- CHỈ SELECT own (UI có thể đọc). GHI chỉ qua RPC service-role (SECURITY DEFINER).
drop policy if exists "user_daily_activity_select_own" on public.user_daily_activity;
create policy "user_daily_activity_select_own" on public.user_daily_activity
  for select to authenticated using (auth.uid() = user_id);

-- ── RPC atomic: cộng dồn counter (khóa dòng qua upsert ON CONFLICT). ──────────
create or replace function public.bump_daily_activity(
  p_user_id uuid,
  p_date    date,
  p_kind    text,
  p_delta   integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_kind not in ('vocab_review', 'exam_complete') then
    return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;

  insert into public.user_daily_activity (user_id, activity_date, kind, count)
  values (p_user_id, p_date, p_kind, greatest(0, coalesce(p_delta, 1)))
  on conflict (user_id, activity_date, kind)
  do update set count = public.user_daily_activity.count + greatest(0, coalesce(p_delta, 1)),
               updated_at = now()
  returning count into v_count;

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

revoke all on function public.bump_daily_activity(uuid, date, text, integer) from public;
revoke all on function public.bump_daily_activity(uuid, date, text, integer) from authenticated;
grant execute on function public.bump_daily_activity(uuid, date, text, integer) to service_role;

-- ============================================================================
--  XONG. Quest vocab/exam giờ đối chiếu hoạt động THẬT hôm nay.
--  Chưa chạy → fail-open (quest vocab/exam claim như cũ), KHÔNG vỡ.
-- ============================================================================
