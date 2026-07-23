-- ============================================================================
--  MIGRATION — ANSWER STREAK (combo server-authoritative)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent)
-- ============================================================================
--  Bật lại COMBO ở /api/grade một cách AN TOÀN. Trước đây route hardcode streak=0
--  (combo tắt) vì không tin streak client (client POST streak lớn để nhân xu).
--  Nay server đếm chuỗi câu ĐÚNG liên tiếp trong bảng này qua RPC atomic
--  bump_answer_streak → comboMultiplier (economy.ts) tính từ streak SERVER.
--
--  🔴 An toàn faucet: RPC CHỈ đếm chuỗi, KHÔNG đụng coins/xp. /api/grade gọi RPC
--  SAU khi gradeAnswer CAS answered:false→true (mỗi câu chấm đúng 1 lần) → mỗi
--  câu chỉ bump streak 1 lần → combo trần ×1.75 chỉ đạt khi đúng LIÊN TIẾP 15+
--  câu THẬT. Client KHÔNG ghi bảng này (chỉ service-role qua RPC).
--
--  FAIL-SAFE: chưa chạy migration → RPC 42883/PGRST202 → store trả null →
--  grade dùng streak=0 (combo tắt = hành vi hiện tại, 0 regression).
-- ============================================================================

create table if not exists public.user_answer_streak (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  streak     integer     not null default 0 check (streak >= 0),
  updated_at timestamptz not null default now()
);

alter table public.user_answer_streak enable row level security;

-- CHỈ SELECT own (UI có thể đọc để hiển thị chuỗi). GHI chỉ qua service-role/RPC
-- (SECURITY DEFINER) — không có policy insert/update cho authenticated → user
-- KHÔNG tự set streak cho mình (chống bơm combo).
drop policy if exists "user_answer_streak_select_own" on public.user_answer_streak;
create policy "user_answer_streak_select_own" on public.user_answer_streak
  for select to authenticated using (auth.uid() = user_id);

-- ── RPC atomic: đúng → streak+1, sai → 0. Trả jsonb {streak} MỚI. ─────────────
create or replace function public.bump_answer_streak(
  p_user_id uuid,
  p_correct boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_streak integer;
begin
  -- Upsert khóa dòng: tạo nếu chưa có, rồi khóa FOR UPDATE để tuần tự hoá.
  insert into public.user_answer_streak (user_id, streak)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select streak into v_streak
    from public.user_answer_streak
    where user_id = p_user_id
    for update;

  if p_correct then
    v_streak := greatest(0, coalesce(v_streak, 0)) + 1;
  else
    v_streak := 0;
  end if;

  update public.user_answer_streak
    set streak = v_streak, updated_at = now()
    where user_id = p_user_id;

  return jsonb_build_object('streak', v_streak);
end;
$$;

revoke all on function public.bump_answer_streak(uuid, boolean) from public;
revoke all on function public.bump_answer_streak(uuid, boolean) from authenticated;
grant execute on function public.bump_answer_streak(uuid, boolean) to service_role;

-- ============================================================================
--  XONG. Combo bật lại: đúng liên tiếp 5/10/15 câu → ×1.25/×1.5/×1.75 xu+XP.
--  Chưa chạy → combo tắt (streak=0), KHÔNG vỡ đường chấm điểm.
-- ============================================================================
