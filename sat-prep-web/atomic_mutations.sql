-- ============================================================================
--  ATOMIC MUTATIONS — đóng ROOT C của SECURITY_AUDIT_2026-07-03.md
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent, chạy lại an toàn)
-- ============================================================================
--  VẤN ĐỀ (audit 2026-07-03, ROOT C): mọi mutation kinh tế đang là
--  load() → compute (ở app) → save() KHÔNG khóa dòng → 2 request song song đọc
--  cùng giá trị cũ → vượt trần / mất cập nhật:
--    • PvP daily cap: 10 request `pvp` đồng thời cùng đọc fights_today=0 → tất cả
--      qua cap → vượt 10 trận/ngày = FAUCET XU (xu đổi quà thật → gian lận tiền).
--    • Cost ledger: concurrent AI calls cùng đọc cost cũ → ghi đè → VƯỢT TRẦN
--      ngân sách ngày (kill-switch mất tác dụng dưới tải).
--    • Quota /ngày: tương tự → vượt 5 lượt free.
--
--  CÁCH VÁ: chuyển phép "đọc-sửa-ghi" thành 1 câu lệnh ATOMIC ở DB
--  (upsert `x = x + n`, hoặc SELECT ... FOR UPDATE khóa dòng rồi update).
--  Postgres đảm bảo 2 request đồng thời tuần tự hóa trên cùng dòng → hết race.
--
--  🔒 SECURITY INVOKER: hàm chạy DƯỚI QUYỀN người gọi → RLS vẫn áp dụng, và
--  auth.uid() trả đúng user đang đăng nhập. Hàm CHỈ đụng dòng của chính user
--  (hoặc sổ cái chung mà authenticated được ghi) → không leo thang quyền.
--
--  🔓 FAIL-SAFE: TRƯỚC khi chạy SQL này, store phát hiện hàm CHƯA tồn tại
--  (mã lỗi 42883 / PGRST202) → tự fallback về đường đọc-sửa-ghi CŨ (hành vi
--  hiện tại = 0 regression). Sau khi chạy → tự dùng đường atomic. KHÔNG cần
--  deploy code đồng thời với SQL.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1) COST LEDGER — cộng dồn atomic (sổ cái CHUNG, 1 dòng/ngày)
--    Thay recordCost() đọc-rồi-upsert bằng 1 upsert `x = x + excluded.x`.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.increment_ai_cost_ledger(
  p_date       text,
  p_tokens_in  bigint,
  p_tokens_out bigint,
  p_cost_usd   numeric
)
returns void
language sql
security invoker
as $$
  insert into public.ai_cost_ledger (ledger_date, calls, tokens_in, tokens_out, cost_usd, updated_at)
  values (p_date, 1, p_tokens_in, p_tokens_out, p_cost_usd, now())
  on conflict (ledger_date) do update
    set calls      = ai_cost_ledger.calls      + 1,
        tokens_in  = ai_cost_ledger.tokens_in  + excluded.tokens_in,
        tokens_out = ai_cost_ledger.tokens_out + excluded.tokens_out,
        cost_usd   = ai_cost_ledger.cost_usd   + excluded.cost_usd,
        updated_at = now();
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 2) AI USAGE (quota /user /ngày) — tăng atomic kèm reset sang ngày mới
--    Reset: nếu date đã lưu != hôm nay → count về 1 (ngày mới); nếu bằng → +1.
--    Trả về count MỚI (route có thể dùng, hiện store bỏ qua = vẫn void ở TS).
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.increment_ai_usage(
  p_date       text,
  p_tokens_in  integer,
  p_tokens_out integer
)
returns integer
language plpgsql
security invoker
as $$
declare
  v_new_count integer;
begin
  insert into public.user_ai_usage (user_id, date, count, tokens_in, tokens_out, updated_at)
  values (auth.uid(), p_date, 1, p_tokens_in, p_tokens_out, now())
  on conflict (user_id) do update
    set count      = case when user_ai_usage.date = excluded.date
                          then user_ai_usage.count + 1 else 1 end,
        tokens_in  = case when user_ai_usage.date = excluded.date
                          then user_ai_usage.tokens_in + excluded.tokens_in else excluded.tokens_in end,
        tokens_out = case when user_ai_usage.date = excluded.date
                          then user_ai_usage.tokens_out + excluded.tokens_out else excluded.tokens_out end,
        date       = excluded.date,
        updated_at = now()
  returning count into v_new_count;
  return v_new_count;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 3) PvP FIGHT — tiêu 1 suất trận/ngày ATOMIC (khóa dòng)
--    Đây là chốt chống FAUCET quan trọng nhất. Gọi SAU khi app đã qua cổng
--    năng lực (power gate) + RNG quyết won. Hàm khóa dòng user_economy rồi:
--      • reset fights_today về 0 nếu sang ngày mới,
--      • KIỂM tuần tự rank: target_rank phải = pvp_rank - 1 (leo tuần tự),
--      • KIỂM cap: fights_today < p_max_fights,
--      • nếu ĐẠT: +1 fights_today, set last_fight_date, leo rank nếu won.
--    Trả jsonb {ok, reason, pvpRank, fightsToday}. ok=false → route KHÔNG
--    trao thưởng (một request thua trong đua đồng thời sẽ bị chặn ở đây).
--    Việc CỘNG XU (khi won) vẫn do route làm qua saveEconomy CHỈ KHI ok=true.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.consume_pvp_fight(
  p_target_rank integer,
  p_won         boolean,
  p_today       text,
  p_max_fights  integer
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_rank            integer;
  v_fights          integer;
  v_date            text;
  v_effective       integer;
  v_new_rank        integer;
begin
  -- Khóa dòng của CHÍNH user (RLS + auth.uid() → chỉ dòng mình). FOR UPDATE
  -- tuần tự hóa các request đồng thời trên cùng dòng → hết race đếm trận.
  select pvp_rank, pvp_fights_today, pvp_last_fight_date
    into v_rank, v_fights, v_date
    from public.user_economy
    where user_id = auth.uid()
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_row');
  end if;

  -- reset bộ đếm nếu sang ngày mới
  v_effective := case when v_date = p_today then coalesce(v_fights, 0) else 0 end;

  -- tuần tự rank: chỉ đánh đối thủ KẾ TRÊN
  if p_target_rank is null or p_target_rank < 1 or p_target_rank <> v_rank - 1 then
    return jsonb_build_object('ok', false, 'reason', 'bad_rank',
                              'pvpRank', v_rank, 'fightsToday', v_effective);
  end if;

  -- cap trận/ngày
  if v_effective >= p_max_fights then
    return jsonb_build_object('ok', false, 'reason', 'cap',
                              'pvpRank', v_rank, 'fightsToday', v_effective);
  end if;

  -- tiêu suất: +1 trận, cập nhật ngày, leo rank nếu thắng (sàn 1)
  v_new_rank := case when p_won then greatest(1, v_rank - 1) else v_rank end;
  update public.user_economy
    set pvp_fights_today    = v_effective + 1,
        pvp_last_fight_date = p_today,
        pvp_rank            = v_new_rank
    where user_id = auth.uid();

  return jsonb_build_object('ok', true, 'reason', 'ok',
                            'pvpRank', v_new_rank, 'fightsToday', v_effective + 1);
end;
$$;

-- ============================================================================
--  XONG. 3 hàm atomic sẵn sàng. Store TS tự phát hiện & dùng (fail-safe fallback
--  khi hàm chưa có). KHÔNG cần policy mới — hàm SECURITY INVOKER dùng lại RLS
--  sẵn có của ai_cost_ledger / user_ai_usage / user_economy.
-- ============================================================================
