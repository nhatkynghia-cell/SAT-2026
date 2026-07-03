import { createClient } from '@/lib/supabase/server';
import { DEFAULT_ECONOMY, type EconomyState } from './economy';

/**
 * ============================================================================
 *  ECONOMY STORE (Supabase Postgres)
 * ============================================================================
 *  Đọc/ghi EconomyState của user từ bảng `user_economy` trên Supabase.
 *  Sử dụng RLS của Supabase để bảo mật thay vì dùng HMAC file cục bộ.
 * ============================================================================
 */

export async function loadEconomy(userId: string): Promise<EconomyState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_economy')
    .select('coins, xp, inventory, last_spin_date')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Nếu chưa có record thì trả về mặc định
    return { ...DEFAULT_ECONOMY };
  }

  return {
    coins: data.coins,
    xp: data.xp,
    inventory: data.inventory || [],
    lastSpinDate: data.last_spin_date,
  };
}

export async function saveEconomy(userId: string, state: EconomyState): Promise<void> {
  const supabase = await createClient();

  // Upsert dữ liệu kinh tế (nếu chưa có thì insert, có rồi thì update)
  const { error } = await supabase
    .from('user_economy')
    .upsert({
      user_id: userId,
      coins: state.coins,
      xp: state.xp,
      inventory: state.inventory,
      last_spin_date: state.lastSpinDate,
      // Không ghi đè các cột gamification phụ nếu chúng đã có
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Lỗi khi lưu economy lên Supabase:', error);
  }
}

/**
 * ============================================================================
 *  PvP STATE (server-authoritative, tách RIÊNG khỏi coins) — anti-faucet
 * ============================================================================
 *  Rank + bộ đếm trận/ngày sống ở cột `user_economy.pvp_*` (migration
 *  phase1_5_pvp_mistakes.sql). TÁCH khỏi loadEconomy/saveEconomy để:
 *    (1) đường ghi coins KHÔNG bị đụng (an toàn tuyệt đối), và
 *    (2) FAIL-SAFE khi migration CHƯA chạy: loadPvpState trả null → route
 *        đóng PvP ("đang nâng cấp") thay vì mở faucet.
 *  Phân biệt: KHÔNG có row (user mới) → default rank 11; LỖI KHÁC (thiếu cột)
 *  → null (tắt PvP), KHÔNG coi là user mới.
 * ============================================================================
 */

export interface PvpState {
  pvpRank: number;
  fightsToday: number;
  lastFightDate: string;
}

/** Mặc định cho user chưa có bản ghi PvP (khớp client pvpRank: 11). */
const DEFAULT_PVP: PvpState = { pvpRank: 11, fightsToday: 0, lastFightDate: '' };

/**
 * Đọc PvP state. Trả:
 *   • PvpState — bình thường (hoặc default nếu chưa có row).
 *   • null — nếu cột pvp_* CHƯA tồn tại (migration chưa chạy) → route tắt PvP.
 */
export async function loadPvpState(userId: string): Promise<PvpState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_economy')
    .select('pvp_rank, pvp_fights_today, pvp_last_fight_date')
    .eq('user_id', userId)
    .single();

  if (error) {
    // PGRST116 = không có row → user mới, dùng default (KHÔNG phải lỗi schema).
    if (error.code === 'PGRST116') return { ...DEFAULT_PVP };
    // Lỗi khác (thường là thiếu cột pvp_* vì migration chưa chạy) → tắt PvP an toàn.
    console.error('loadPvpState: cột PvP chưa sẵn sàng (migration chưa chạy?)', error.message);
    return null;
  }

  return {
    pvpRank: data.pvp_rank ?? DEFAULT_PVP.pvpRank,
    fightsToday: data.pvp_fights_today ?? 0,
    lastFightDate: data.pvp_last_fight_date ?? '',
  };
}

/**
 * Ghi PvP state — CHỈ cập nhật cột pvp_*, KHÔNG đụng coins/xp/inventory.
 * Dùng update (không upsert) vì row economy chắc chắn đã tồn tại khi user đã
 * từng nhận coins; nếu chưa có row thì PvP cũng chưa có gì để leo.
 * Trả false nếu ghi lỗi (route sẽ không leo rank ảo).
 */
export async function savePvpState(userId: string, pvp: PvpState): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_economy')
    .update({
      pvp_rank: pvp.pvpRank,
      pvp_fights_today: pvp.fightsToday,
      pvp_last_fight_date: pvp.lastFightDate,
    })
    .eq('user_id', userId);

  if (error) {
    console.error('savePvpState: lỗi ghi PvP state:', error.message);
    return false;
  }
  return true;
}

export interface PvpConsumeResult {
  ok: boolean;
  reason: string;
  pvpRank: number;
  fightsToday: number;
}

/**
 * ============================================================================
 *  TIÊU 1 SUẤT TRẬN PvP — ATOMIC (audit 2026-07-03, ROOT C — chốt chống FAUCET)
 * ============================================================================
 *  Vấn đề cũ: route làm checkPvpAttempt (đọc) → resolve → bumpPvpCounter →
 *  savePvpState (ghi) KHÔNG khóa dòng → 10 request `pvp` đồng thời cùng đọc
 *  fights_today=0 → tất cả qua cap → vượt trần 10 trận/ngày = faucet xu thật.
 *
 *  Vá: hàm SQL `consume_pvp_fight` khóa dòng (SELECT ... FOR UPDATE) rồi trong
 *  CÙNG transaction: reset ngày mới → kiểm rank tuần tự → kiểm cap → +1 trận +
 *  leo rank nếu thắng. 2 request đồng thời bị tuần tự hóa trên dòng → hết race.
 *
 *  Gọi hàm này SAU khi app đã qua CỔNG NĂNG LỰC (power gate) + đã có kết quả
 *  won (RNG ở app, dựa combatPower từ mastery). Route CHỈ cộng xu khi ok=true.
 *
 *  Trả:
 *    • PvpConsumeResult — RPC chạy được (ok=true đã tiêu suất + leo rank;
 *      ok=false bị chặn: 'cap' hết lượt / 'bad_rank' sai tuần tự / 'no_row').
 *    • null — hàm CHƯA tồn tại (pre-migration 42883/PGRST202) hoặc lỗi khác →
 *      route FALLBACK về đường checkPvpAttempt + bumpPvpCounter + savePvpState
 *      cũ (0 regression; race vẫn hở như trước tới khi user chạy SQL).
 * ============================================================================
 */
export async function tryConsumePvpFightAtomic(
  targetRank: number,
  won: boolean,
  today: string,
  maxFights: number
): Promise<PvpConsumeResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('consume_pvp_fight', {
    p_target_rank: targetRank,
    p_won: won,
    p_today: today,
    p_max_fights: maxFights,
  });

  if (error) {
    if (error.code !== '42883' && error.code !== 'PGRST202') {
      console.error('consume_pvp_fight RPC lỗi (fallback non-atomic):', error.message);
    }
    return null; // pre-migration hoặc lỗi → route fallback
  }

  // data là jsonb {ok, reason, pvpRank, fightsToday}
  const r = (data ?? {}) as Partial<PvpConsumeResult>;
  return {
    ok: !!r.ok,
    reason: typeof r.reason === 'string' ? r.reason : 'unknown',
    pvpRank: typeof r.pvpRank === 'number' ? r.pvpRank : 0,
    fightsToday: typeof r.fightsToday === 'number' ? r.fightsToday : 0,
  };
}
