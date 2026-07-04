-- ============================================================================
--  PHASE 2 — Bước 2: CỔNG THANH TOÁN (VNPay + MoMo)
--  Bảng payment_transactions + RPC atomic confirm_payment
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent, chạy lại an toàn)
-- ============================================================================
--  Lưu mỗi giao dịch thanh toán (1 lần user bấm "nâng gói" = 1 order). Đường đi:
--    /api/payment/create → INSERT 1 row status='pending' (server tra PLANS lấy giá)
--    → redirect user tới cổng → user trả tiền → cổng gọi IPN (server-to-server)
--    → /api/payment/{vnpay-ipn|momo-ipn} verify chữ ký → confirm_payment (CAS)
--    → nếu lật pending→paid THÀNH CÔNG (chưa từng paid) → grantSubscription().
--
--  🔴 BẢO MẬT — 2 chốt (giống user_subscriptions / reward_redemptions):
--    1. RLS CHỈ SELECT dòng của mình. GHI chỉ service-role (IPN handler). User
--       KHÔNG tự chèn/sửa giao dịch → không tự đánh dấu "đã trả tiền".
--    2. RPC confirm_payment ATOMIC (khóa dòng FOR UPDATE theo order_id):
--         • chống DOUBLE-GRANT: cổng có thể gọi IPN NHIỀU LẦN (retry) hoặc đua
--           đồng thời → chỉ request lật được pending→paid mới cấp gói; các lần sau
--           thấy đã 'paid' → trả alreadyConfirmed=true (KHÔNG cấp lại).
--         • chống SAI SỐ TIỀN: so amount cổng báo với amount_vnd đã chốt lúc create
--           (p_amount lệch → reason 'amount_mismatch', KHÔNG cấp).
--       p_amount = 0 nghĩa "bỏ qua kiểm tiền" (một số cổng không gửi lại amount ở
--       IPN — khi đó dựa vào chữ ký + order_id đã đủ; truyền số dương để bật kiểm).
--
--  ⚠️ FAIL-CLOSED: RPC chưa tồn tại → store TS trả 'confirm_unavailable' (KHÔNG
--    fallback đọc-sửa-ghi) → IPN trả lỗi tạm để cổng retry sau khi đã chạy SQL.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1) BẢNG payment_transactions
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_transactions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  order_id       text        not null unique,              -- vnp_TxnRef / MoMo orderId (khóa idempotency)
  gateway        text        not null check (gateway in ('vnpay', 'momo')),
  tier           text        not null check (tier in ('premium', 'ultimate')),
  period         text        not null check (period in ('monthly', 'yearly')),
  amount_vnd     integer     not null check (amount_vnd > 0),
  status         text        not null default 'pending'
                             check (status in ('pending', 'paid', 'failed', 'expired')),
  gateway_txn_id text,                                     -- mã giao dịch phía cổng (đối soát)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  paid_at        timestamptz
);

-- Liệt kê giao dịch của user (mới nhất trước).
create index if not exists payment_transactions_user_created_idx
  on public.payment_transactions (user_id, created_at desc);

alter table public.payment_transactions enable row level security;

-- 🔓 CHỈ SELECT dòng của mình. KHÔNG có policy insert/update/delete →
-- authenticated KHÔNG ghi được; chỉ service-role (bypass RLS) ghi qua RPC/store.
drop policy if exists "payment_transactions_select_own" on public.payment_transactions;
create policy "payment_transactions_select_own" on public.payment_transactions
  for select to authenticated
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────
-- 2) RPC confirm_payment — XÁC NHẬN THANH TOÁN ATOMIC (chống double-grant)
--    Gọi bởi IPN handler SAU khi đã verify chữ ký cổng. Khóa dòng theo order_id,
--    kiểm tiền, lật pending→paid CHỈ MỘT LẦN. Trả jsonb cho route quyết cấp gói.
--    Theo mẫu ROOT E: p_user_id KHÔNG cần (order_id đã unique + chứa user); trả
--    user_id ra để route gọi grantSubscription đúng người.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.confirm_payment(
  p_order_id       text,
  p_gateway_txn_id text default '',
  p_amount         integer default 0
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_status  text;
  v_amount  integer;
  v_user    uuid;
  v_tier    text;
  v_period  text;
begin
  -- Khóa dòng giao dịch → tuần tự hóa IPN đồng thời/retry trên cùng order.
  select status, amount_vnd, user_id, tier, period
    into v_status, v_amount, v_user, v_tier, v_period
    from public.payment_transactions
    where order_id = p_order_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Kiểm số tiền (khi p_amount > 0). Cổng báo tiền khác lúc create → từ chối.
  if p_amount > 0 and p_amount <> v_amount then
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch',
                              'userId', v_user, 'tier', v_tier, 'period', v_period);
  end if;

  -- Đã 'paid' rồi → idempotent: KHÔNG cấp lại, báo alreadyConfirmed.
  if v_status = 'paid' then
    return jsonb_build_object('ok', true, 'alreadyConfirmed', true,
                              'userId', v_user, 'tier', v_tier, 'period', v_period);
  end if;

  -- Chỉ lật từ 'pending' (không cho 'failed'/'expired' → 'paid').
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'bad_status',
                              'userId', v_user, 'tier', v_tier, 'period', v_period);
  end if;

  update public.payment_transactions
    set status         = 'paid',
        gateway_txn_id = nullif(p_gateway_txn_id, ''),
        paid_at        = now(),
        updated_at     = now()
    where order_id = p_order_id;

  -- ok + KHÔNG alreadyConfirmed → route gọi grantSubscription lần đầu duy nhất.
  return jsonb_build_object('ok', true, 'alreadyConfirmed', false,
                            'userId', v_user, 'tier', v_tier, 'period', v_period);
end;
$$;

-- Chỉ grant service_role (IPN handler dùng admin client). Client KHÔNG gọi trực tiếp.
revoke all on function public.confirm_payment(text, text, integer) from public;
revoke all on function public.confirm_payment(text, text, integer) from authenticated;
grant execute on function public.confirm_payment(text, text, integer) to service_role;

-- ============================================================================
--  XONG. Store TS (payment-store.ts) gọi confirm_payment qua admin client.
--  Bảng INERT tới khi IPN thật gọi (chưa route nào tự grant) → an toàn áp prod sớm.
-- ============================================================================
