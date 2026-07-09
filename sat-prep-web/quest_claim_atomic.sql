-- ============================================================================
--  QUEST CLAIM — nhận thưởng nhiệm vụ ATOMIC (đóng nốt race của ROOT C)
-- ============================================================================
--  VẤN ĐỀ (cùng họ ROOT C với consume_pvp_fight): action 'quest' ở
--  /api/economy làm loadQuestClaims (đọc) → check chưa claim → applyQuestReward
--  → saveQuestClaim + saveEconomy (ghi) KHÔNG khóa dòng. 2 request 'quest' cùng
--  questId gửi ĐỒNG THỜI cùng đọc quest_claims chưa có questId hôm nay → cả hai
--  qua check → CỘNG XU 2 LẦN = faucet (xu đổi quà thật → gian lận tiền).
--
--  CÁCH VÁ (y khuôn consume_pvp_fight): 1 hàm SQL khóa dòng user_economy
--  (SELECT ... FOR UPDATE) rồi TRONG CÙNG transaction: đọc mảng questId hôm nay
--  → nếu đã có → trả already_claimed (KHÔNG cộng); nếu chưa → cộng coins/xp +
--  thêm questId vào mảng ngày. 2 request đồng thời bị tuần tự hóa trên dòng →
--  request thứ 2 thấy questId đã có → chặn. Idempotent tuyệt đối.
--
--  🔴 ROOT A GIỮ NGUYÊN: số thưởng (p_coins/p_xp) do ROUTE tính server-side từ
--  QUEST_REWARD[questId] rồi truyền vào — client CHỈ gửi questId, KHÔNG gửi số.
--  RPC chỉ làm nhiệm vụ KHÓA + kiểm trùng + cộng delta, không tự quyết số.
--
--  🔒 SECURITY INVOKER + p_user_id DEFAULT auth.uid(): khớp convention
--  root_e_step1_rpc.sql. Store gọi qua service-role (admin client) truyền userId
--  tường minh. service_role bỏ qua RLS nên ghi được.
--
--  🔓 FAIL-SAFE: store phát hiện hàm CHƯA tồn tại (42883/PGRST202) → fallback
--  đường load-check-save CŨ (race vẫn hở như hiện tại = 0 regression). Chạy SQL
--  này xong → tự dùng đường atomic. KHÔNG cần deploy code đồng thời với SQL.
--
--  🔐 QUYỀN (QUAN TRỌNG): RPC nhận p_coins/p_xp làm THAM SỐ + SECURITY INVOKER.
--  Nếu authenticated gọi trực tiếp được → POST /rpc/claim_quest_reward với p_coins
--  tùy ý = ĐÚC XU (faucet, xu đổi quà thật). PHẢI khóa EXECUTE cho anon+authenticated.
--  ⚠️ `revoke from public` là CHƯA ĐỦ: Supabase cấp EXECUTE cho anon/authenticated
--  qua ALTER DEFAULT PRIVILEGES (grant TƯỜNG MINH, không qua PUBLIC) → phải revoke
--  tường minh cả 2 role. Chỉ service_role (admin client) được gọi. Hàm này cũng đã
--  được thêm vào root_e_step2_revoke.sql cho nhất quán (dù đã khóa ngay tại đây).
-- ============================================================================

create or replace function public.claim_quest_reward(
  p_user_id  uuid default auth.uid(),
  p_quest_id text default '',
  p_today    text default '',
  p_coins    int  default 0,
  p_xp       int  default 0
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_coins    int;
  v_xp       int;
  v_claims   jsonb;
  v_today    jsonb;
begin
  -- Khóa dòng user (tuần tự hóa các request 'quest' đồng thời trên cùng dòng).
  select coins, xp, coalesce(quest_claims, '{}'::jsonb)
    into v_coins, v_xp, v_claims
    from public.user_economy
    where user_id = p_user_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_row', 'coins', 0, 'xp', 0);
  end if;

  -- Mảng questId đã nhận HÔM NAY (theo p_today, giờ VN do route cấp).
  v_today := coalesce(v_claims -> p_today, '[]'::jsonb);

  -- Đã nhận questId này hôm nay → chặn, KHÔNG cộng (idempotent).
  if v_today @> to_jsonb(p_quest_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed',
                              'coins', v_coins, 'xp', v_xp);
  end if;

  -- Cộng thưởng + thêm questId vào mảng ngày (tạo key nếu thiếu — createIfMissing).
  v_coins := v_coins + greatest(0, coalesce(p_coins, 0));
  v_xp    := v_xp    + greatest(0, coalesce(p_xp, 0));
  v_today := v_today || to_jsonb(p_quest_id);
  v_claims := jsonb_set(v_claims, array[p_today], v_today, true);

  update public.user_economy
     set coins = v_coins,
         xp = v_xp,
         quest_claims = v_claims
   where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'reason', 'ok', 'coins', v_coins, 'xp', v_xp);
end;
$$;

-- Quyền: CHỈ service-role gọi (store dùng admin client). Khóa EXECUTE cho mọi
-- role client-facing. PHẢI revoke tường minh anon + authenticated (Supabase cấp
-- qua ALTER DEFAULT PRIVILEGES — grant tường minh, `from public` KHÔNG gỡ được).
revoke execute on function public.claim_quest_reward(uuid, text, text, int, int) from public;
revoke execute on function public.claim_quest_reward(uuid, text, text, int, int) from anon;
revoke execute on function public.claim_quest_reward(uuid, text, text, int, int) from authenticated;
grant  execute on function public.claim_quest_reward(uuid, text, text, int, int) to service_role;

-- ============================================================================
--  ROLLBACK (nếu cần gỡ hàm — route tự fallback về đường non-atomic cũ):
--    drop function if exists public.claim_quest_reward(uuid, text, text, int, int);
-- ============================================================================
