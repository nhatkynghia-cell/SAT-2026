-- ============================================================================
--  MIGRATION A3 — GIA HẠN CỘNG DỒN thời gian còn lại (extend-from-active-expiry)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent, chạy lại an toàn)
-- ============================================================================
--  🔴 VẤN ĐỀ ĐANG VÁ: confirm_payment (A2) luôn INSERT gói với
--     expires_at = now() + duration. Nếu user CÒN gói hạn (vd còn 200 ngày) mà
--     gia hạn SỚM → dòng mới expires_at = now()+365 → MẤT 200 ngày còn lại.
--     getActiveSubscription lấy expires_at MỚI NHẤT nên user vẫn có gói, nhưng
--     ngắn hơn đáng lẽ (mất tiền đã trả cho phần chồng lấn).
--
--  CÁCH VÁ: khi cấp gói, tính mốc bắt đầu = GREATEST(now(), max expires_at của
--     gói CÙNG TIER còn hạn của user). expires_at = mốc đó + duration → cộng dồn
--     thời gian còn lại. Cross-tier (đổi premium↔ultimate) → KHÔNG cộng dồn
--     (extend từ now()) để không lẫn quyền lợi 2 gói — giữ hành vi cũ cho case đó.
--
--  🔴 BẤT BIẾN GIỮ NGUYÊN (A2): atomic (cùng transaction lật paid + insert),
--     chống double-grant (chỉ insert trên nhánh pending→paid), amount check,
--     chỉ service_role execute, signature (text,text,integer) KHÔNG đổi.
-- ============================================================================

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
  v_status       text;
  v_amount       integer;
  v_user         uuid;
  v_tier         text;
  v_period       text;
  v_duration     integer;
  v_base_start   timestamptz;
begin
  -- Khóa dòng giao dịch → tuần tự hóa IPN đồng thời/retry trên cùng order.
  select status, amount_vnd, user_id, tier, period, duration_days
    into v_status, v_amount, v_user, v_tier, v_period, v_duration
    from public.payment_transactions
    where order_id = p_order_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if p_amount > 0 and p_amount <> v_amount then
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch',
                              'userId', v_user, 'tier', v_tier, 'period', v_period);
  end if;

  if v_status = 'paid' then
    return jsonb_build_object('ok', true, 'alreadyConfirmed', true,
                              'userId', v_user, 'tier', v_tier, 'period', v_period);
  end if;

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

  -- 🔴 A3: CẤP GÓI NGUYÊN TỬ + CỘNG DỒN. Mốc bắt đầu = GREATEST(now(), gói CÙNG
  -- TIER còn hạn mới nhất). Đơn CŨ chưa có duration_days (null) → BỎ QUA insert
  -- nhưng vẫn flip paid (giữ tương thích A2).
  if v_duration is not null and v_duration > 0 then
    select greatest(now(), coalesce(max(expires_at), now()))
      into v_base_start
      from public.user_subscriptions
      where user_id = v_user
        and tier = v_tier
        and expires_at > now();

    insert into public.user_subscriptions (user_id, tier, period, started_at, expires_at)
    values (v_user, v_tier, v_period, now(), v_base_start + (v_duration || ' days')::interval);
  end if;

  return jsonb_build_object('ok', true, 'alreadyConfirmed', false,
                            'userId', v_user, 'tier', v_tier, 'period', v_period);
end;
$$;

revoke all on function public.confirm_payment(text, text, integer) from public;
revoke all on function public.confirm_payment(text, text, integer) from authenticated;
grant execute on function public.confirm_payment(text, text, integer) to service_role;

-- ============================================================================
--  XONG. Gia hạn CÙNG TIER trước khi hết hạn nay cộng dồn thời gian còn lại.
--  Chưa chạy migration này → vẫn dùng A2 (extend từ now()), KHÔNG vỡ (chỉ là
--  user mất phần chồng lấn khi gia hạn sớm — bug cũ, không phải regression mới).
-- ============================================================================
