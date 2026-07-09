-- ============================================================================
-- ROOT E — Step 2: REVOKE quyền ghi của authenticated trên bảng server-authoritative
-- ============================================================================
-- ⚠️ CHỈ CHẠY SAU KHI:
--   (1) Code mới (dùng service-role admin client) đã deploy THÀNH CÔNG.
--   (2) Soak 24–48h xác nhận app ghi bình thường qua service-role.
--   (3) Log KHÔNG có lỗi "permission denied" / fallback.
--
-- SAU KHI CHẠY: browser PATCH thẳng DB → 403/42501. App vẫn ghi qua API
-- (service-role bỏ qua RLS+grant). Rollback: re-GRANT bên dưới.
-- ============================================================================

-- Khóa ghi trực tiếp của role authenticated trên các bảng server-authoritative
REVOKE INSERT, UPDATE, DELETE ON user_economy FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON user_mastery FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON user_ai_usage FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON ai_cost_ledger FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON user_progress FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON user_goals FROM authenticated;

-- Khóa RPC nhạy cảm (client không được gọi trực tiếp)
-- ⚠️ PHẢI revoke CẢ authenticated LẪN public: Postgres mặc định grant EXECUTE
-- cho PUBLIC khi tạo function → chỉ revoke authenticated là CHƯA ĐỦ (authenticated
-- vẫn thừa hưởng EXECUTE qua PUBLIC). service_role có grant tường minh (step1) nên
-- KHÔNG bị ảnh hưởng. (Dù 3 RPC là SECURITY INVOKER nên đã "defanged" — lệnh ghi
-- bên trong chạy dưới quyền caller đã bị revoke — vẫn khóa EXECUTE cho sạch/rõ ý định.)
REVOKE EXECUTE ON FUNCTION consume_pvp_fight(uuid, int, boolean, text, int) FROM authenticated;
REVOKE EXECUTE ON FUNCTION increment_ai_usage(uuid, text, int, int) FROM authenticated;
REVOKE EXECUTE ON FUNCTION increment_ai_cost_ledger(text, int, int, numeric) FROM authenticated;
REVOKE EXECUTE ON FUNCTION consume_pvp_fight(uuid, int, boolean, text, int) FROM public;
REVOKE EXECUTE ON FUNCTION increment_ai_usage(uuid, text, int, int) FROM public;
REVOKE EXECUTE ON FUNCTION increment_ai_cost_ledger(text, int, int, numeric) FROM public;

-- claim_quest_reward (2026-07-09): RPC quest atomic nhận p_coins/p_xp làm tham số
-- → authenticated gọi trực tiếp = ĐÚC XU. ĐÃ revoke tường minh anon+authenticated
-- ngay trong quest_claim_atomic.sql + chạy prod (không đợi soak — faucet trực tiếp).
-- Liệt kê ở đây để nhất quán (REVOKE idempotent — chạy lại vô hại).
REVOKE EXECUTE ON FUNCTION claim_quest_reward(uuid, text, text, int, int) FROM public;
REVOKE EXECUTE ON FUNCTION claim_quest_reward(uuid, text, text, int, int) FROM anon;
REVOKE EXECUTE ON FUNCTION claim_quest_reward(uuid, text, text, int, int) FROM authenticated;

-- GIỮ SELECT cho authenticated (client cần đọc số dư/mastery/progress)
-- (Đã có sẵn từ RLS policy using(auth.uid()=user_id) — chỉ cần KHÔNG revoke SELECT)

-- ============================================================================
-- ROLLBACK (nếu cần khôi phục quyền ghi cho authenticated — quay về trước step2)
-- ============================================================================
-- GRANT INSERT, UPDATE, DELETE ON user_economy TO authenticated;
-- GRANT INSERT, UPDATE, DELETE ON user_mastery TO authenticated;
-- GRANT INSERT, UPDATE, DELETE ON user_ai_usage TO authenticated;
-- GRANT INSERT, UPDATE, DELETE ON ai_cost_ledger TO authenticated;
-- GRANT INSERT, UPDATE, DELETE ON user_progress TO authenticated;
-- GRANT INSERT, UPDATE, DELETE ON user_goals TO authenticated;
-- GRANT EXECUTE ON FUNCTION consume_pvp_fight(uuid, int, boolean, text, int) TO authenticated;
-- GRANT EXECUTE ON FUNCTION increment_ai_usage(uuid, text, int, int) TO authenticated;
-- GRANT EXECUTE ON FUNCTION increment_ai_cost_ledger(text, int, int, numeric) TO authenticated;
