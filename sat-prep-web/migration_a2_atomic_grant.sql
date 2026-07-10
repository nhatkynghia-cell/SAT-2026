-- ============================================================================
--  MIGRATION A2 — CẤP GÓI NGUYÊN TỬ trong confirm_payment (vá lỗ TIỀN money-in)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent, chạy lại an toàn)
-- ============================================================================
--  🔴 LỖ TIỀN ĐANG VÁ (A2): trước đây IPN handler làm 2 bước KHÔNG nguyên tử —
--    (1) confirm_payment lật pending→paid, RỒI (2) grantSubscription INSERT gói.
--    Nếu (2) fail sau khi (1) đã commit → user MẤT TIỀN (đơn đã 'paid') nhưng
--    KHÔNG có gói; IPN retry thấy alreadyConfirmed nên KHÔNG cấp lại → kẹt vĩnh
--    viễn, retry vô hiệu.
--
--  CÁCH VÁ (hướng a): GỘP INSERT user_subscriptions VÀO confirm_payment → cùng
--    MỘT transaction với UPDATE status='paid'. Lật-paid và cấp-gói cùng commit
--    hoặc cùng rollback → không còn khe hở. IPN handler GỠ lời gọi grantSubscription
--    (xem vnpay-ipn/route.ts + momo-ipn/route.ts).
--
--  🔴 BẤT BIẾN BẢO MẬT GIỮ NGUYÊN (giống payment_transactions.sql gốc):
--    • CHỐNG DOUBLE-GRANT: INSERT CHỈ nằm trên nhánh lật pending→paid THÀNH CÔNG.
--      Đã 'paid' (alreadyConfirmed) → return sớm TRƯỚC insert → KHÔNG cấp lần 2.
--    • CHỐNG SAI SỐ TIỀN: kiểm amount TRƯỚC; mismatch → return, KHÔNG insert.
--    • CHỈ service_role execute (client KHÔNG gọi trực tiếp).
--    • GIỮ NGUYÊN signature (text, text, integer) → KHÔNG tạo overload mới.
--
--  GIA HẠN: mỗi order = 1 lần lật paid = 1 dòng user_subscriptions. Order MỚI
--    (gia hạn) → confirm mới → dòng mới; getActiveSubscription lấy expires_at MỚI
--    NHẤT nên nhiều dòng/user là ĐÚNG. KHÔNG thêm unique constraint.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1) Cột duration_days trên payment_transactions
--    Server ghi lúc CREATE đơn (tra PLANS.durationDays). NULLABLE để tương thích
--    đơn CŨ (pre-migration); đơn MỚI luôn có giá trị. RPC chỉ cấp gói khi cột này
--    NOT NULL (đơn cũ null → vẫn flip paid nhưng KHÔNG insert — giữ tương thích).
-- ────────────────────────────────────────────────────────────────────────
alter table public.payment_transactions
  add column if not exists duration_days integer;

-- ────────────────────────────────────────────────────────────────────────
-- 2) confirm_payment (bản A2) — copy NGUYÊN logic cũ + INSERT gói nguyên tử
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
  v_status    text;
  v_amount    integer;
  v_user      uuid;
  v_tier      text;
  v_period    text;
  v_duration  integer;
begin
  -- Khóa dòng giao dịch → tuần tự hóa IPN đồng thời/retry trên cùng order.
  -- Đọc THÊM duration_days vào v_duration ngay trong SELECT ... FOR UPDATE.
  select status, amount_vnd, user_id, tier, period, duration_days
    into v_status, v_amount, v_user, v_tier, v_period, v_duration
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

  -- Đã 'paid' rồi → idempotent: KHÔNG cấp lại, báo alreadyConfirmed (return TRƯỚC
  -- khi tới insert → chống double-grant).
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

  -- 🔴 A2: CẤP GÓI NGUYÊN TỬ — cùng transaction với UPDATE trên (cùng commit /
  -- cùng rollback). Chỉ chạy trên nhánh lật pending→paid THÀNH CÔNG (KHÔNG phải
  -- alreadyConfirmed → return đã chặn) → cấp ĐÚNG 1 lần/order, không double-grant.
  -- Đơn CŨ chưa có duration_days (null) → BỎ QUA insert nhưng vẫn flip paid (giữ
  -- tương thích; đơn mới sau migration luôn có duration_days nên luôn được cấp).
  if v_duration is not null and v_duration > 0 then
    insert into public.user_subscriptions (user_id, tier, period, started_at, expires_at)
    values (v_user, v_tier, v_period, now(), now() + (v_duration || ' days')::interval);
  end if;

  -- ok + KHÔNG alreadyConfirmed. Route KHÔNG cần grant nữa (đã cấp nguyên tử ở trên).
  return jsonb_build_object('ok', true, 'alreadyConfirmed', false,
                            'userId', v_user, 'tier', v_tier, 'period', v_period);
end;
$$;

-- Chỉ grant service_role (IPN handler dùng admin client). Client KHÔNG gọi trực tiếp.
revoke all on function public.confirm_payment(text, text, integer) from public;
revoke all on function public.confirm_payment(text, text, integer) from authenticated;
grant execute on function public.confirm_payment(text, text, integer) to service_role;

-- ============================================================================
--  XONG. Sau khi chạy: confirm_payment tự cấp gói nguyên tử; IPN handler đã gỡ
--  grantSubscription. Đơn tạo TỪ SAU migration luôn có duration_days → luôn cấp.
-- ============================================================================
