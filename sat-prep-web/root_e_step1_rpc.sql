-- ============================================================================
-- ROOT E — Step 1: Parameterize RPC cho service-role (auth.uid() = NULL)
-- ============================================================================
-- Chạy TRƯỚC khi deploy code mới. Hàm cũ dùng auth.uid() nội bộ → NULL khi
-- service-role gọi. Thêm p_user_id uuid default auth.uid() → code cũ (JWT user)
-- vẫn hoạt động (default), code mới (service-role) truyền userId tường minh.
--
-- QUAN TRỌNG: SECURITY INVOKER (không phải DEFINER) — hàm chạy với quyền
-- của CALLER. Service-role bỏ qua RLS nên ghi được; authenticated vẫn bị
-- RLS chặn (tới khi step2 REVOKE execute).
-- ============================================================================

-- 1. consume_pvp_fight — thêm p_user_id, dùng thay auth.uid() bên trong
CREATE OR REPLACE FUNCTION consume_pvp_fight(
  p_user_id uuid DEFAULT auth.uid(),
  p_target_rank int DEFAULT 11,
  p_won boolean DEFAULT false,
  p_today text DEFAULT '',
  p_max_fights int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_row record;
  v_fights int;
  v_rank int;
BEGIN
  -- Khóa dòng user (SELECT FOR UPDATE)
  SELECT pvp_rank, pvp_fights_today, pvp_last_fight_date
    INTO v_row
    FROM user_economy
   WHERE user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_row', 'pvpRank', 0, 'fightsToday', 0);
  END IF;

  -- Reset ngày mới
  IF v_row.pvp_last_fight_date IS DISTINCT FROM p_today THEN
    v_fights := 0;
  ELSE
    v_fights := COALESCE(v_row.pvp_fights_today, 0);
  END IF;
  v_rank := COALESCE(v_row.pvp_rank, 11);

  -- Kiểm cap
  IF v_fights >= p_max_fights THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cap', 'pvpRank', v_rank, 'fightsToday', v_fights);
  END IF;

  -- Kiểm rank tuần tự (chỉ thách rank kế tiếp hoặc chính rank hiện tại)
  IF p_target_rank < v_rank - 1 OR p_target_rank > v_rank THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_rank', 'pvpRank', v_rank, 'fightsToday', v_fights);
  END IF;

  -- Tăng đếm + leo rank nếu thắng
  v_fights := v_fights + 1;
  IF p_won AND p_target_rank < v_rank THEN
    v_rank := p_target_rank;
  END IF;

  UPDATE user_economy
     SET pvp_fights_today = v_fights,
         pvp_last_fight_date = p_today,
         pvp_rank = v_rank
   WHERE user_id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'reason', 'ok', 'pvpRank', v_rank, 'fightsToday', v_fights);
END;
$$;

-- 2. increment_ai_usage — thêm p_user_id
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id uuid DEFAULT auth.uid(),
  p_date text DEFAULT '',
  p_tokens_in int DEFAULT 0,
  p_tokens_out int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  INSERT INTO user_ai_usage (user_id, date, count, tokens_in, tokens_out, updated_at)
  VALUES (p_user_id, p_date, 1, p_tokens_in, p_tokens_out, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    count = CASE WHEN user_ai_usage.date = p_date THEN user_ai_usage.count + 1 ELSE 1 END,
    tokens_in = CASE WHEN user_ai_usage.date = p_date THEN user_ai_usage.tokens_in + p_tokens_in ELSE p_tokens_in END,
    tokens_out = CASE WHEN user_ai_usage.date = p_date THEN user_ai_usage.tokens_out + p_tokens_out ELSE p_tokens_out END,
    date = p_date,
    updated_at = now();
END;
$$;

-- 3. increment_ai_cost_ledger — không cần user_id (bảng dùng chung, không RLS per-user)
-- Giữ nguyên signature (không có p_user_id) vì bảng này KHÔNG scope user.
CREATE OR REPLACE FUNCTION increment_ai_cost_ledger(
  p_date text DEFAULT '',
  p_tokens_in int DEFAULT 0,
  p_tokens_out int DEFAULT 0,
  p_cost_usd numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  INSERT INTO ai_cost_ledger (ledger_date, calls, tokens_in, tokens_out, cost_usd)
  VALUES (p_date, 1, p_tokens_in, p_tokens_out, p_cost_usd)
  ON CONFLICT (ledger_date)
  DO UPDATE SET
    calls = ai_cost_ledger.calls + 1,
    tokens_in = ai_cost_ledger.tokens_in + p_tokens_in,
    tokens_out = ai_cost_ledger.tokens_out + p_tokens_out,
    cost_usd = ai_cost_ledger.cost_usd + p_cost_usd;
END;
$$;

-- Grant execute cho service_role (mặc định đã có, nhưng tường minh)
GRANT EXECUTE ON FUNCTION consume_pvp_fight(uuid, int, boolean, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION increment_ai_usage(uuid, text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION increment_ai_cost_ledger(text, int, int, numeric) TO service_role;

-- GIỮ grant cho authenticated (code cũ vẫn gọi được tới khi step2 REVOKE)
GRANT EXECUTE ON FUNCTION consume_pvp_fight(uuid, int, boolean, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ai_usage(uuid, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ai_cost_ledger(text, int, int, numeric) TO authenticated;
