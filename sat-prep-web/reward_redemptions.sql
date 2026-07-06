-- ============================================================================
--  PHASE 2 — Bước 3: REWARD-TO-REAL (xu → quà THẬT)
--  Bảng reward_redemptions + RPC atomic redeem_reward
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent, chạy lại an toàn)
-- ============================================================================
--  Cho phép user đổi xu tích lũy lấy quà THẬT (voucher lệ phí thi, tài liệu, gói
--  AI VIP). Mỗi lần đổi: TRỪ xu + tạo 1 PHIẾU (redemption) trạng thái 'pending'
--  để admin thực hiện thủ công (cấp mã voucher / gửi tài liệu / bật gói).
--
--  🔴 BẢO MẬT — 2 chốt:
--    1. RLS CHỈ SELECT (giống user_subscriptions): user đọc phiếu CỦA MÌNH,
--       KHÔNG insert/update/delete. Ghi CHỈ qua service-role (RPC gọi bởi
--       /api/redeem sau khi xác thực). → user KHÔNG tự tạo phiếu "đã đổi" mà
--       không trừ xu, cũng KHÔNG tự đánh dấu 'fulfilled'.
--    2. RPC redeem_reward ATOMIC (khóa dòng user_economy FOR UPDATE): kiểm số
--       dư → trừ xu → ghi phiếu trong CÙNG 1 transaction. Chống:
--         • RACE: 2 request đồng thời cùng đọc coins cũ → đổi 2 quà bằng 1 lần xu.
--         • HALF-WRITE: trừ xu xong mà không ghi phiếu (mất xu) — hoặc ngược lại
--           (ghi phiếu mà không trừ xu = quà free). Transaction đảm bảo all-or-nothing.
--       GIÁ (p_cost) do SERVER truyền từ REWARDS (rewards.ts) — client KHÔNG gửi.
--
--  ⚠️ FAIL-CLOSED (KHÁC PvP fail-safe): redemption là tiền-RA + phiếu quà thật.
--    Nếu RPC chưa tồn tại, store TS KHÔNG fallback đường non-atomic (sẽ hở race/
--    half-write) mà TỪ CHỐI đổi ('redeem_unavailable'). Thà chặn còn hơn phát quà sai.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1) BẢNG reward_redemptions — mỗi dòng = 1 lần đổi quà (hàng đợi admin fulfil)
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.reward_redemptions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  reward_id    text        not null,                       -- rw_1 / rw_2 / rw_3
  reward_name  text        not null,                       -- snapshot tên lúc đổi
  cost_coins   integer     not null check (cost_coins > 0),
  status       text        not null default 'pending'
                           check (status in ('pending', 'fulfilled', 'cancelled')),
  created_at   timestamptz not null default now(),
  fulfilled_at timestamptz
);

-- Liệt kê phiếu của user (mới nhất trước) + lọc hàng đợi 'pending' cho admin.
create index if not exists reward_redemptions_user_created_idx
  on public.reward_redemptions (user_id, created_at desc);
create index if not exists reward_redemptions_status_idx
  on public.reward_redemptions (status)
  where status = 'pending';

alter table public.reward_redemptions enable row level security;

-- 🔓 CHỈ SELECT dòng của mình. KHÔNG có policy insert/update/delete →
-- authenticated KHÔNG ghi được; chỉ service-role (bypass RLS) ghi qua RPC.
drop policy if exists "reward_redemptions_select_own" on public.reward_redemptions;
create policy "reward_redemptions_select_own" on public.reward_redemptions
  for select to authenticated
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────
-- 2) RPC redeem_reward — ĐỔI QUÀ ATOMIC (khóa dòng, trừ xu + ghi phiếu)
--    Theo mẫu ROOT E: p_user_id default auth.uid() → service-role truyền tường
--    minh (auth.uid()=NULL khi service-role gọi). SECURITY INVOKER → service-role
--    bypass RLS ghi được; authenticated (không được grant) không gọi trực tiếp.
--    Trả jsonb {ok, reason, coins (số dư MỚI), redemptionId}.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.redeem_reward(
  p_user_id     uuid    default auth.uid(),
  p_reward_id   text    default '',
  p_reward_name text    default '',
  p_cost        integer default 0
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_coins  integer;
  v_new_id uuid;
begin
  -- Giá phải hợp lệ (server truyền từ REWARDS; chốt phòng thủ).
  if p_cost is null or p_cost <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_cost');
  end if;

  -- Khóa dòng economy của CHÍNH user → tuần tự hóa request đồng thời (hết race).
  select coins into v_coins
    from public.user_economy
    where user_id = p_user_id
    for update;

  if not found then
    -- Chưa có bản ghi economy (user mới, số dư mặc định app = 100) → không đủ để
    -- đổi bất kỳ quà nào (đều >= 10000). Coi như thiếu xu.
    return jsonb_build_object('ok', false, 'reason', 'no_row', 'coins', 0);
  end if;

  if v_coins < p_cost then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'coins', v_coins);
  end if;

  -- Trừ xu + ghi phiếu trong cùng transaction (all-or-nothing).
  update public.user_economy
    set coins = coins - p_cost
    where user_id = p_user_id;

  insert into public.reward_redemptions (user_id, reward_id, reward_name, cost_coins, status)
    values (p_user_id, p_reward_id, p_reward_name, p_cost, 'pending')
    returning id into v_new_id;

  return jsonb_build_object(
    'ok', true,
    'reason', 'ok',
    'coins', v_coins - p_cost,
    'redemptionId', v_new_id
  );
end;
$$;

-- CHỈ grant service_role (đường ghi qua /api/redeem dùng admin client). KHÔNG
-- grant authenticated: client tuyệt đối không gọi RPC tiền-ra này trực tiếp.
revoke all on function public.redeem_reward(uuid, text, text, integer) from public;
revoke all on function public.redeem_reward(uuid, text, text, integer) from authenticated;
grant execute on function public.redeem_reward(uuid, text, text, integer) to service_role;

-- ────────────────────────────────────────────────────────────────────────
-- 3) RPC fulfill_redemption — ADMIN đánh dấu phiếu ĐÃ GIAO (pending→fulfilled)
--    Admin đã xác thực bằng shared-secret ở route (admin-auth.ts) trước khi gọi.
--    KHÔNG hoàn xu (quà đã cấp). Idempotent: phiếu đã fulfilled → 'already'.
--    Trả jsonb {ok, reason, status}.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.fulfill_redemption(
  p_redemption_id uuid
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_status text;
begin
  -- Khóa dòng phiếu → tuần tự hóa nếu admin bấm 2 lần / 2 admin cùng lúc.
  select status into v_status
    from public.reward_redemptions
    where id = p_redemption_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Đã fulfilled → idempotent (KHÔNG lỗi, KHÔNG đổi gì).
  if v_status = 'fulfilled' then
    return jsonb_build_object('ok', true, 'reason', 'already', 'status', 'fulfilled');
  end if;

  -- Chỉ lật được từ 'pending' (cancelled → không thể giao).
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'bad_status', 'status', v_status);
  end if;

  update public.reward_redemptions
    set status = 'fulfilled', fulfilled_at = now()
    where id = p_redemption_id;

  return jsonb_build_object('ok', true, 'reason', 'ok', 'status', 'fulfilled');
end;
$$;

revoke all on function public.fulfill_redemption(uuid) from public;
revoke all on function public.fulfill_redemption(uuid) from authenticated;
grant execute on function public.fulfill_redemption(uuid) to service_role;

-- ────────────────────────────────────────────────────────────────────────
-- 4) RPC cancel_redemption — ADMIN hủy phiếu + HOÀN xu (pending→cancelled)
--    Dùng khi admin KHÔNG giao được quà. ATOMIC (khóa cả phiếu lẫn dòng
--    user_economy): cộng lại xu + đổi status trong 1 transaction. Idempotent:
--    phiếu đã cancelled → 'already', KHÔNG hoàn xu lần 2 (chống double-refund
--    = faucet xu). Phiếu đã fulfilled → bad_status (quà đã giao, không hoàn).
--    Trả jsonb {ok, reason, status, coins (số dư MỚI)}.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.cancel_redemption(
  p_redemption_id uuid
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_status  text;
  v_user_id uuid;
  v_cost    integer;
  v_coins   integer;
begin
  -- Khóa dòng phiếu trước → chống 2 lần hủy đồng thời double-refund.
  select status, user_id, cost_coins into v_status, v_user_id, v_cost
    from public.reward_redemptions
    where id = p_redemption_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Đã cancelled → idempotent, KHÔNG hoàn xu lần 2.
  if v_status = 'cancelled' then
    return jsonb_build_object('ok', true, 'reason', 'already', 'status', 'cancelled');
  end if;

  -- Đã fulfilled → không hủy được (quà thật đã trao).
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'bad_status', 'status', v_status);
  end if;

  -- Hoàn xu + đổi status trong CÙNG transaction (all-or-nothing).
  update public.user_economy
    set coins = coins + v_cost
    where user_id = v_user_id
    returning coins into v_coins;

  update public.reward_redemptions
    set status = 'cancelled'
    where id = p_redemption_id;

  return jsonb_build_object(
    'ok', true,
    'reason', 'ok',
    'status', 'cancelled',
    'coins', v_coins
  );
end;
$$;

revoke all on function public.cancel_redemption(uuid) from public;
revoke all on function public.cancel_redemption(uuid) from authenticated;
grant execute on function public.cancel_redemption(uuid) to service_role;

-- ============================================================================
--  XONG. Store TS (redemption-store.ts) gọi redeem_reward qua admin client;
--  admin-fulfillment-store.ts gọi fulfill_redemption / cancel_redemption.
--  Nếu RPC chưa chạy → store nhận 42883/PGRST202 → TỪ CHỐI (fail-closed).
-- ============================================================================
