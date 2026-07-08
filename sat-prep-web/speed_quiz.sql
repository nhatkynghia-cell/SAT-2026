-- ============================================================================
--  TRẢ LỜI NHANH (Speed Quiz) — bảng + RPC (Pha 2/3/4)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent, chạy lại an toàn)
-- ============================================================================
--  Mini-game tốc độ: mỗi câu 15s, sai 2 câu liên tiếp = hết lượt. Có:
--    • THƯỞNG THEO MỐC trong lượt (10/20/30 câu đúng → +100/250/500 xu), nhận
--      ĐÚNG 1 LẦN/ngày/mốc (idempotent).
--    • BẢNG XẾP HẠNG ngày/tuần/tháng/năm theo "lượt tốt nhất" (max correct_count).
--    • THƯỞNG CUỐI KỲ theo thứ hạng (cron chốt, Pha 4).
--
--  🔴 CHỐNG GIAN LẬN (server-authoritative, KHÔNG tin client khai số câu đúng):
--    Câu phát cho Speed Quiz được TAG vào session ngay lúc phát (speed_quiz_issued).
--    Kết thúc lượt, server ĐẾM câu was_correct=true (issued_questions — do /api/grade
--    CAS chấm) thuộc session → correct_count THẬT. Client chỉ hiển thị số cục bộ,
--    KHÔNG quyết thưởng. Mỗi câu tag 1 lần/session (PK) → không nhồi trùng.
--
--  🔴 ANTI-FAUCET: grant mốc + grant cuối kỳ đều INSERT ON CONFLICT DO NOTHING +
--    cộng xu CHỈ khi chèn được dòng mới → chạy lại/đua nhau không phát trùng.
--
--  ⚠️ FAIL-SAFE pre-migration: store TS bắt 42P01/42883/PGRST202/PGRST205 → tắt
--    thưởng + bảng xếp hạng ("sắp ra mắt"), gameplay vẫn chơi được. KHÔNG mở faucet.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1) BẢNG speed_quiz_sessions — mỗi dòng = 1 lượt chơi
--    cycle keys (day/week/month/year) STAMP lúc tạo từ giờ VN (server) → xếp
--    hạng theo kỳ mà KHÔNG cần cron tính key. correct_count do server điền lúc
--    kết thúc (finalize) — KHÔNG cho client ghi.
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.speed_quiz_sessions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  correct_count integer     not null default 0,
  day_key       text        not null,
  week_key      text        not null,
  month_key     text        not null,
  year_key      text        not null,
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
);

-- Xếp hạng theo từng kỳ: lấy MAX(correct_count) mỗi user trong kỳ. Index phục
-- vụ group/scan theo cycle key (chỉ tính lượt đã kết thúc).
create index if not exists sqs_day_idx   on public.speed_quiz_sessions (day_key,   correct_count desc) where ended_at is not null;
create index if not exists sqs_week_idx  on public.speed_quiz_sessions (week_key,  correct_count desc) where ended_at is not null;
create index if not exists sqs_month_idx on public.speed_quiz_sessions (month_key, correct_count desc) where ended_at is not null;
create index if not exists sqs_year_idx  on public.speed_quiz_sessions (year_key,  correct_count desc) where ended_at is not null;

alter table public.speed_quiz_sessions enable row level security;

-- 🔓 CHỈ SELECT dòng của mình (xem lịch sử). Ghi CHỈ qua service-role (RPC).
drop policy if exists "sqs_select_own" on public.speed_quiz_sessions;
create policy "sqs_select_own" on public.speed_quiz_sessions
  for select to authenticated
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────
-- 2) BẢNG speed_quiz_issued — TAG câu phát cho từng session (chống gian lận)
--    Ghi lúc /api/speed-quiz/question phát câu. PK(session_id, question_id) →
--    mỗi câu tag đúng 1 lần. Lúc finalize, ĐẾM câu was_correct=true thuộc đây.
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.speed_quiz_issued (
  session_id  uuid not null references public.speed_quiz_sessions(id) on delete cascade,
  question_id uuid not null,
  primary key (session_id, question_id)
);

alter table public.speed_quiz_issued enable row level security;
-- KHÔNG policy nào cho authenticated → chỉ service-role ghi/đọc (bypass RLS).

-- ────────────────────────────────────────────────────────────────────────
-- 3) BẢNG speed_quiz_claims — mốc đã nhận thưởng (idempotent 1 lần/ngày/mốc)
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.speed_quiz_claims (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  day_key    text        not null,
  milestone  integer     not null,        -- 10 / 20 / 30 (số câu đúng)
  coins      integer     not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, day_key, milestone)
);

alter table public.speed_quiz_claims enable row level security;
drop policy if exists "sqc_select_own" on public.speed_quiz_claims;
create policy "sqc_select_own" on public.speed_quiz_claims
  for select to authenticated
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────
-- 4) BẢNG speed_quiz_rewards — thưởng CUỐI KỲ theo thứ hạng (Pha 4, cron chốt)
--    PK(user_id, cycle_type, cycle_key) → 1 kỳ chỉ phát 1 lần cho mỗi user.
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.speed_quiz_rewards (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  cycle_type text        not null,        -- 'day' / 'week' / 'month' / 'year'
  cycle_key  text        not null,        -- vd '2026-07-08' / '2026-W28' / '2026-07' / '2026'
  rank       integer     not null,
  coins      integer     not null,
  settled_at timestamptz not null default now(),
  primary key (user_id, cycle_type, cycle_key)
);

alter table public.speed_quiz_rewards enable row level security;
drop policy if exists "sqr_select_own" on public.speed_quiz_rewards;
create policy "sqr_select_own" on public.speed_quiz_rewards
  for select to authenticated
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────
-- 5) RPC start_speed_quiz_session — tạo lượt mới, STAMP cycle keys (server)
--    Trả session id. p_user_id default auth.uid() (mẫu ROOT E, service-role
--    truyền tường minh). Cycle keys do TS tính từ giờ VN rồi truyền vào (nhất
--    quán với season.ts, tránh lệch timezone của DB).
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.start_speed_quiz_session(
  p_user_id   uuid default auth.uid(),
  p_day_key   text default '',
  p_week_key  text default '',
  p_month_key text default '',
  p_year_key  text default ''
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  insert into public.speed_quiz_sessions (user_id, day_key, week_key, month_key, year_key)
    values (p_user_id, p_day_key, p_week_key, p_month_key, p_year_key)
    returning id into v_id;
  return v_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 6) RPC tag_speed_quiz_question — gắn câu vừa phát vào session (chống gian lận)
--    Chỉ tag nếu session thuộc user + còn active. Idempotent (ON CONFLICT).
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.tag_speed_quiz_question(
  p_session_id  uuid,
  p_user_id     uuid default auth.uid(),
  p_question_id uuid default null
)
returns void
language plpgsql
security invoker
as $$
begin
  -- Bảo vệ: session phải thuộc user và chưa kết thúc.
  if not exists (
    select 1 from public.speed_quiz_sessions
     where id = p_session_id and user_id = p_user_id and ended_at is null
  ) then
    return; -- lặng lẽ bỏ qua (không phát câu lạ vào session người khác)
  end if;

  if p_question_id is null then
    return;
  end if;

  insert into public.speed_quiz_issued (session_id, question_id)
    values (p_session_id, p_question_id)
    on conflict do nothing;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 7) RPC finalize_speed_quiz_session — chốt lượt, ĐẾM câu đúng THẬT (server)
--    correct_count = số câu was_correct=true (issued_questions) thuộc session.
--    Khóa dòng session; idempotent: đã kết thúc → trả lại correct_count cũ.
--    Trả jsonb {ok, correctCount, dayKey}.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.finalize_speed_quiz_session(
  p_session_id uuid,
  p_user_id    uuid default auth.uid()
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_ended  timestamptz;
  v_day    text;
  v_count  integer;
begin
  select ended_at, day_key into v_ended, v_day
    from public.speed_quiz_sessions
    where id = p_session_id and user_id = p_user_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Đã chốt rồi → idempotent, trả correct_count đã lưu (không tính lại/không cộng thưởng lại).
  if v_ended is not null then
    select correct_count into v_count from public.speed_quiz_sessions where id = p_session_id;
    return jsonb_build_object('ok', true, 'reason', 'already', 'correctCount', v_count, 'dayKey', v_day, 'alreadyEnded', true);
  end if;

  -- ĐẾM câu đúng THẬT: câu tag cho session này VÀ was_correct=true (server đã chấm).
  select count(*) into v_count
    from public.speed_quiz_issued j
    join public.issued_questions q on q.id = j.question_id
    where j.session_id = p_session_id and q.was_correct = true;

  update public.speed_quiz_sessions
    set correct_count = v_count, ended_at = now()
    where id = p_session_id;

  return jsonb_build_object('ok', true, 'reason', 'ok', 'correctCount', v_count, 'dayKey', v_day, 'alreadyEnded', false);
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 8) RPC claim_speed_quiz_milestone — cộng xu mốc, idempotent 1 lần/ngày/mốc
--    Trả jsonb {ok, claimed (bool), coins (số dư MỚI nếu claimed)}.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.claim_speed_quiz_milestone(
  p_user_id   uuid    default auth.uid(),
  p_day_key   text    default '',
  p_milestone integer default 0,
  p_coins     integer default 0
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_inserted integer;
  v_coins    integer;
begin
  if p_coins <= 0 or p_milestone <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_input');
  end if;

  -- Ghi dấu đã nhận (idempotent). Chỉ cộng xu khi CHÈN ĐƯỢC dòng mới (lần đầu).
  insert into public.speed_quiz_claims (user_id, day_key, milestone, coins)
    values (p_user_id, p_day_key, p_milestone, p_coins)
    on conflict (user_id, day_key, milestone) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return jsonb_build_object('ok', true, 'claimed', false); -- đã nhận trước đó
  end if;

  update public.user_economy
    set coins = coins + p_coins
    where user_id = p_user_id
    returning coins into v_coins;

  -- Không có dòng economy (hiếm: chưa từng nhận xu) → vẫn giữ dấu claim, coins null.
  return jsonb_build_object('ok', true, 'claimed', true, 'coins', coalesce(v_coins, 0));
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 9) RPC settle_speed_quiz_reward — thưởng CUỐI KỲ theo hạng (Pha 4, cron)
--    Idempotent theo (user, cycle_type, cycle_key). Cộng xu chỉ khi chèn được.
--    Trả jsonb {ok, settled (bool), coins}.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.settle_speed_quiz_reward(
  p_user_id    uuid    default auth.uid(),
  p_cycle_type text    default '',
  p_cycle_key  text    default '',
  p_rank       integer default 0,
  p_coins      integer default 0
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_inserted integer;
  v_coins    integer;
begin
  if p_coins <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_input');
  end if;

  insert into public.speed_quiz_rewards (user_id, cycle_type, cycle_key, rank, coins)
    values (p_user_id, p_cycle_type, p_cycle_key, p_rank, p_coins)
    on conflict (user_id, cycle_type, cycle_key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return jsonb_build_object('ok', true, 'settled', false); -- kỳ này đã phát
  end if;

  update public.user_economy
    set coins = coins + p_coins
    where user_id = p_user_id
    returning coins into v_coins;

  return jsonb_build_object('ok', true, 'settled', true, 'coins', coalesce(v_coins, 0));
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 10) GRANT — chỉ service_role (đường ghi qua API dùng admin client). KHÔNG
--     grant authenticated: client tuyệt đối không gọi trực tiếp các RPC này.
-- ────────────────────────────────────────────────────────────────────────
revoke all on function public.start_speed_quiz_session(uuid, text, text, text, text) from public, authenticated;
revoke all on function public.tag_speed_quiz_question(uuid, uuid, uuid) from public, authenticated;
revoke all on function public.finalize_speed_quiz_session(uuid, uuid) from public, authenticated;
revoke all on function public.claim_speed_quiz_milestone(uuid, text, integer, integer) from public, authenticated;
revoke all on function public.settle_speed_quiz_reward(uuid, text, text, integer, integer) from public, authenticated;

grant execute on function public.start_speed_quiz_session(uuid, text, text, text, text) to service_role;
grant execute on function public.tag_speed_quiz_question(uuid, uuid, uuid) to service_role;
grant execute on function public.finalize_speed_quiz_session(uuid, uuid) to service_role;
grant execute on function public.claim_speed_quiz_milestone(uuid, text, integer, integer) to service_role;
grant execute on function public.settle_speed_quiz_reward(uuid, text, text, integer, integer) to service_role;

-- ============================================================================
--  XONG. Store TS: speed-quiz-store.ts + speed-quiz-leaderboard-store.ts gọi
--  các RPC/bảng trên qua admin client. Pre-migration → fail-safe "sắp ra mắt".
-- ============================================================================
