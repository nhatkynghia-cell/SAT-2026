-- ============================================================================
--  EXAM ECONOMY — cộng thưởng thi ATOMIC (đóng outlier cuối của ROOT C)
-- ============================================================================
--  VẤN ĐỀ (audit wf_4e1ca5c7, ROOT C outlier): 2 route thưởng thi
--  (/api/exams/grade + /api/exam-session/submit) làm:
--    loadEconomy (đọc) → applyExamRewardFromDifficulties (tính delta ở app) →
--    saveEconomy (ghi absolute) — KHÔNG khóa dòng. Hai submit ĐỒNG THỜI (retry
--    chồng / hai module nộp sát nhau) cùng đọc coins cũ → mỗi cái ghi
--    coins_cũ + delta_riêng → LAST-WRITE-WINS → UNDER-GRANT (mất xu học sinh đã
--    kiếm). Đây là outlier DUY NHẤT của ROOT C chưa dùng RPC atomic (quest/pvp/
--    vocab đã dùng claim_quest_reward / consume_pvp_fight).
--
--  KHÁC claim_quest_reward: đây KHÔNG phải claim-once. Idempotency (mỗi câu tính
--  thưởng đúng 1 lần) đã do COMPARE-AND-SWAP trên issued_questions.answered lo
--  (gradeAnswer lật false→true; retry → null → correctDifficulties rỗng → delta 0).
--  Nên RPC chỉ cần CỘNG DỒN delta ATOMIC (coins = coins + delta) — Postgres tuần
--  tự hóa các increment đồng thời trên cùng dòng → hết lost-update.
--
--  🔴 ROOT A GIỮ NGUYÊN: delta (p_coins/p_xp) do ROUTE tính server-side từ ĐỘ KHÓ
--  THẬT của các câu ĐÚNG (server chấm) rồi truyền vào — client KHÔNG gửi số. RPC
--  chỉ KHÓA + cộng delta. greatest(0, …) chặn delta âm (không rút xu qua route này).
--
--  🔒 SECURITY INVOKER + p_user_id DEFAULT auth.uid(): khớp convention
--  root_e_step1_rpc.sql. Store gọi qua service-role (admin client) truyền userId
--  tường minh (auth.uid() = NULL dưới service-role). service_role bỏ RLS nên ghi được.
--
--  🔓 FAIL-SAFE: store phát hiện hàm CHƯA tồn tại (42883/PGRST202) → trả null →
--  route FALLBACK về đường loadEconomy+saveEconomy CŨ (race lost-update vẫn hở
--  như hiện tại = 0 REGRESSION). Chạy SQL này xong → tự dùng đường atomic. KHÔNG
--  cần deploy code đồng thời với SQL.
--
--  Yêu cầu dòng user_economy TỒN TẠI trước khi gọi (route gọi ensureEconomyRow —
--  INSERT ON CONFLICT DO NOTHING — trước RPC, y hệt đường vocab). RPC chỉ UPDATE,
--  KHÔNG INSERT → không phải đoán schema cột inventory/last_spin_date. not found
--  → trả no_row (fail-safe; route coi là lỗi, KHÔNG double-write).
--
--  🔐 QUYỀN (QUAN TRỌNG): RPC nhận p_coins/p_xp làm THAM SỐ + SECURITY INVOKER.
--  Nếu authenticated gọi trực tiếp được → POST /rpc/increment_economy p_coins tùy
--  ý = ĐÚC XU (faucet, xu đổi quà thật). PHẢI revoke EXECUTE cho anon+authenticated
--  (Supabase cấp qua ALTER DEFAULT PRIVILEGES — `from public` KHÔNG gỡ được → phải
--  revoke tường minh cả 2 role). CHỈ service_role (admin client) được gọi.
-- ============================================================================

create or replace function public.increment_economy(
  p_user_id uuid default auth.uid(),
  p_coins   int  default 0,
  p_xp      int  default 0
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_coins int;
  v_xp    int;
begin
  -- Khóa dòng user (tuần tự hóa các increment thưởng thi đồng thời trên cùng dòng).
  select coins, xp
    into v_coins, v_xp
    from public.user_economy
    where user_id = p_user_id
    for update;

  if not found then
    -- Route gọi ensureEconomyRow trước → không nên xảy ra. Fail-safe: KHÔNG tạo
    -- dòng ở đây (tránh đoán schema) → route thấy ok=false thì KHÔNG double-write.
    return jsonb_build_object('ok', false, 'reason', 'no_row', 'coins', 0, 'xp', 0);
  end if;

  -- Cộng delta ATOMIC. greatest(0, …) chặn delta âm (route này CHỈ cộng thưởng).
  v_coins := v_coins + greatest(0, coalesce(p_coins, 0));
  v_xp    := v_xp    + greatest(0, coalesce(p_xp, 0));

  update public.user_economy
     set coins = v_coins,
         xp = v_xp
   where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'reason', 'ok', 'coins', v_coins, 'xp', v_xp);
end;
$$;

-- Quyền: CHỈ service-role gọi (store dùng admin client). Khóa EXECUTE cho mọi role
-- client-facing. PHẢI revoke tường minh anon + authenticated (Supabase cấp qua
-- ALTER DEFAULT PRIVILEGES — grant tường minh, `from public` KHÔNG gỡ được).
revoke execute on function public.increment_economy(uuid, int, int) from public;
revoke execute on function public.increment_economy(uuid, int, int) from anon;
revoke execute on function public.increment_economy(uuid, int, int) from authenticated;
grant  execute on function public.increment_economy(uuid, int, int) to service_role;

-- ============================================================================
--  ROLLBACK (nếu cần gỡ hàm — route tự fallback về đường non-atomic cũ):
--    drop function if exists public.increment_economy(uuid, int, int);
-- ============================================================================
