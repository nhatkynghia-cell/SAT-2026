import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
  const admin = createAdminClient();

  const { error } = await admin
    .from('user_economy')
    .upsert({
      user_id: userId,
      coins: state.coins,
      xp: state.xp,
      inventory: state.inventory,
      last_spin_date: state.lastSpinDate,
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Lỗi khi lưu economy lên Supabase:', error);
  }
}

/**
 * Đảm bảo user_economy CÓ dòng cho user (INSERT ON CONFLICT DO NOTHING — KHÔNG ghi
 * đè coins/xp sẵn có). Dùng TRƯỚC khi gọi claim_quest_reward / increment_economy
 * RPC: RPC khóa dòng bằng SELECT ... FOR UPDATE, chỉ tuần tự hóa được khi dòng
 * TỒN TẠI. Nếu user mới chưa có dòng → RPC trả no_row → phải rơi xuống đường
 * non-atomic (không ghi claim → 2 POST đồng thời double-grant). Tạo dòng trước →
 * RPC luôn claim-once đúng.
 *
 * 🔴 Seed = DEFAULT_ECONOMY (KHÔNG phải 0): loadEconomy trả DEFAULT_ECONOMY.coins
 * (100 xu chào mừng) cho user CHƯA có dòng. Nếu seed 0 rồi RPC cộng delta → user
 * mới mà hành động cộng-xu ĐẦU TIÊN là ôn từ/thi sẽ MẤT 100 xu chào mừng (row tạo
 * ở 0 thay vì 100). Seed đúng DEFAULT_ECONOMY → nhất quán với loadEconomy. Row đã
 * tồn tại KHÔNG bị đụng (ignoreDuplicates = ON CONFLICT DO NOTHING).
 */
export async function ensureEconomyRow(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('user_economy')
    .upsert(
      {
        user_id: userId,
        coins: DEFAULT_ECONOMY.coins,
        xp: DEFAULT_ECONOMY.xp,
        inventory: DEFAULT_ECONOMY.inventory,
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );
  if (error) console.error('ensureEconomyRow error:', error.message);
}

/**
 * ============================================================================
 *  QUEST CLAIMS — chống double-claim (ROOT B, audit 2026-07-03)
 * ============================================================================
 *  Cột `quest_claims jsonb` trong user_economy: { "2026-07-03": ["q1","q3"] }
 *  Lưu danh sách questId đã claim THEO NGÀY (quest reset hằng ngày ở client).
 *  loadQuestClaims trả mảng questId đã claim hôm nay; saveQuestClaim ghi thêm 1.
 * ============================================================================
 */

export async function loadQuestClaims(userId: string, today: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_economy')
    .select('quest_claims')
    .eq('user_id', userId)
    .single();

  if (error || !data?.quest_claims) return [];
  const claims = data.quest_claims as Record<string, string[]>;
  return Array.isArray(claims[today]) ? claims[today] : [];
}

export async function saveQuestClaim(userId: string, today: string, questId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_economy')
    .select('quest_claims')
    .eq('user_id', userId)
    .single();

  const claims = (data?.quest_claims ?? {}) as Record<string, string[]>;
  if (!Array.isArray(claims[today])) claims[today] = [];
  claims[today].push(questId);

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_economy')
    .update({ quest_claims: claims })
    .eq('user_id', userId);

  if (error) console.error('saveQuestClaim error:', error.message);
}

export interface IncrementResult {
  ok: boolean;
  reason: string;
  coins: number;
  xp: number;
}

/**
 * ============================================================================
 *  CỘNG THƯỞNG THI — ATOMIC INCREMENT (đóng outlier cuối ROOT C — exam economy)
 * ============================================================================
 *  Vấn đề cũ: /api/exams/grade + /api/exam-session/submit làm loadEconomy →
 *  applyExamRewardFromDifficulties → saveEconomy (ghi ABSOLUTE) KHÔNG khóa dòng.
 *  2 submit ĐỒNG THỜI (retry chồng / 2 module sát nhau) cùng đọc coins cũ → mỗi
 *  cái ghi coins_cũ+delta_riêng → last-write-wins → UNDER-GRANT (mất xu đã kiếm).
 *
 *  KHÁC claim_quest_reward: KHÔNG phải claim-once — idempotency (mỗi câu thưởng 1
 *  lần) đã do compare-and-swap trên issued_questions.answered lo (gradeAnswer lật
 *  false→true; retry → null → delta 0). RPC increment_economy chỉ CỘNG DỒN delta
 *  ATOMIC (coins = coins + delta, khóa dòng FOR UPDATE) → Postgres tuần tự hóa các
 *  increment đồng thời → hết lost-update.
 *
 *  🔴 ROOT A: delta do ROUTE tính từ độ khó câu ĐÚNG (server chấm), client KHÔNG
 *  gửi số. RPC greatest(0,…) chặn delta âm.
 *
 *  Yêu cầu dòng user_economy TỒN TẠI trước (route gọi ensureEconomyRow trước RPC —
 *  y hệt đường vocab). RPC chỉ UPDATE (không đoán schema cột khác).
 *
 *  Trả:
 *    • IncrementResult — RPC chạy được (ok=true đã cộng, coins/xp = TỔNG mới;
 *      ok=false 'no_row' chưa có dòng / 'rpc_error').
 *    • null — hàm CHƯA tồn tại (pre-migration 42883/PGRST202) → route FALLBACK về
 *      loadEconomy+saveEconomy cũ (0 regression; race vẫn hở tới khi chạy
 *      migration_exam_economy_atomic.sql).
 * ============================================================================
 */
export async function tryIncrementEconomyAtomic(
  userId: string,
  coins: number,
  xp: number
): Promise<IncrementResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('increment_economy', {
    p_user_id: userId,
    p_coins: coins,
    p_xp: xp,
  });

  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      return null; // pre-migration: fallback to non-atomic path
    }
    console.error('increment_economy RPC lỗi (fail-closed, KHÔNG fallback):', error.message);
    return { ok: false, reason: 'rpc_error', coins: 0, xp: 0 };
  }

  const r = (data ?? {}) as Partial<IncrementResult>;
  return {
    ok: !!r.ok,
    reason: typeof r.reason === 'string' ? r.reason : 'unknown',
    coins: typeof r.coins === 'number' ? r.coins : 0,
    xp: typeof r.xp === 'number' ? r.xp : 0,
  };
}

export interface QuestClaimResult {
  ok: boolean;
  reason: string;
  coins: number;
  xp: number;
}

/**
 * ============================================================================
 *  NHẬN THƯỞNG QUEST — ATOMIC (đóng nốt race của ROOT C, cùng họ consume_pvp_fight)
 * ============================================================================
 *  Vấn đề cũ: route làm loadQuestClaims (đọc) → check → applyQuestReward →
 *  saveQuestClaim + saveEconomy (ghi) KHÔNG khóa dòng → 2 request 'quest' cùng
 *  questId đồng thời cùng đọc "chưa claim" → CỘNG XU 2 LẦN (faucet, xu đổi quà thật).
 *
 *  Vá: RPC `claim_quest_reward` khóa dòng (SELECT ... FOR UPDATE) rồi trong CÙNG
 *  transaction: kiểm questId đã có trong mảng ngày chưa → nếu có trả
 *  already_claimed (KHÔNG cộng), nếu chưa cộng coins/xp + ghi questId. 2 request
 *  đồng thời bị tuần tự hóa → request thứ 2 bị chặn. Idempotent tuyệt đối.
 *
 *  🔴 ROOT A: số thưởng (coins/xp) do ROUTE tính từ QUEST_REWARD rồi truyền vào —
 *  client KHÔNG gửi số. RPC chỉ KHÓA + kiểm trùng + cộng delta server cấp.
 *
 *  Trả:
 *    • QuestClaimResult — RPC chạy được (ok=true đã cộng + ghi claim; ok=false:
 *      'already_claimed' đã nhận / 'no_row' chưa có economy row).
 *    • null — hàm CHƯA tồn tại (pre-migration 42883/PGRST202) → route FALLBACK
 *      về đường loadQuestClaims + saveQuestClaim + saveEconomy cũ (0 regression,
 *      race vẫn hở như trước tới khi user chạy quest_claim_atomic.sql).
 * ============================================================================
 */
export async function tryClaimQuestRewardAtomic(
  userId: string,
  questId: string,
  today: string,
  coins: number,
  xp: number
): Promise<QuestClaimResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_quest_reward', {
    p_user_id: userId,
    p_quest_id: questId,
    p_today: today,
    p_coins: coins,
    p_xp: xp,
  });

  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      return null; // pre-migration: fallback to non-atomic path
    }
    console.error('claim_quest_reward RPC lỗi (fail-closed, KHÔNG fallback):', error.message);
    return { ok: false, reason: 'rpc_error', coins: 0, xp: 0 };
  }

  const r = (data ?? {}) as Partial<QuestClaimResult>;
  return {
    ok: !!r.ok,
    reason: typeof r.reason === 'string' ? r.reason : 'unknown',
    coins: typeof r.coins === 'number' ? r.coins : 0,
    xp: typeof r.xp === 'number' ? r.xp : 0,
  };
}

/**
 * Claim-once ATOMIC tổng quát — tái dùng RPC claim_quest_reward như một primitive
 * "cộng coins/xp đúng 1 lần cho cặp (bucketKey, itemId)". RPC khóa dòng + kiểm
 * itemId đã có trong mảng dưới key bucketKey chưa → idempotent chống race.
 *
 * Dùng cho các mặt phẳng cộng xu idempotent KHÁC quest (cùng cột quest_claims,
 * cùng lỗ race ROOT C nếu để read-check-write):
 *   • dailyLogin: bucketKey = DAILY_LOGIN_KEY, itemId = ngày VN.
 *   • streak milestone: bucketKey = STREAK_CLAIM_KEY, itemId = số mốc.
 *
 * Ánh xạ: RPC p_today = bucketKey (khóa jsonb top-level), p_quest_id = itemId
 * (phần tử trong mảng). Trả null pre-migration (route fallback đường cũ).
 */
export async function tryClaimOnceAtomic(
  userId: string,
  bucketKey: string,
  itemId: string,
  coins: number,
  xp: number
): Promise<QuestClaimResult | null> {
  return tryClaimQuestRewardAtomic(userId, itemId, bucketKey, coins, xp);
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
  const admin = createAdminClient();
  const { error } = await admin
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
  userId: string,
  targetRank: number,
  won: boolean,
  today: string,
  maxFights: number
): Promise<PvpConsumeResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('consume_pvp_fight', {
    p_user_id: userId,
    p_target_rank: targetRank,
    p_won: won,
    p_today: today,
    p_max_fights: maxFights,
  });

  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      return null; // pre-migration: fallback to non-atomic path
    }
    console.error('consume_pvp_fight RPC lỗi (fail-closed, KHÔNG fallback):', error.message);
    return { ok: false, reason: 'rpc_error', pvpRank: 0, fightsToday: 0 };
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

/**
 * ============================================================================
 *  ANSWER STREAK — chuỗi câu ĐÚNG liên tiếp SERVER-AUTHORITATIVE (combo faucet-safe)
 * ============================================================================
 *  /api/grade trước đây hardcode streak=0 (combo tắt) vì không tin streak client.
 *  RPC `bump_answer_streak` khóa dòng user_answer_streak (FOR UPDATE) rồi TRONG
 *  CÙNG transaction: đúng → streak+1, sai → 0; trả streak MỚI. Nhờ đó combo tính
 *  từ streak SERVER, mỗi câu chỉ bump 1 lần (grade CAS answered:false→true trước
 *  khi gọi) → không farm được.
 *
 *  🔴 Chỉ ĐẾM chuỗi — KHÔNG đụng coins/xp. Route tính comboMultiplier từ streak
 *  trả về rồi mới cộng thưởng. Tách bảng riêng để 0 ảnh hưởng money-path khi
 *  migration chưa chạy.
 *
 *  Trả:
 *    • số streak MỚI (>=0) — RPC chạy được.
 *    • null — hàm CHƯA tồn tại (pre-migration 42883/PGRST202) → route dùng
 *      streak=0 (combo tắt = hành vi hiện tại, 0 regression).
 */
export async function tryBumpAnswerStreakAtomic(
  userId: string,
  isCorrect: boolean
): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('bump_answer_streak', {
    p_user_id: userId,
    p_correct: isCorrect,
  });

  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      return null; // pre-migration: combo tắt (streak=0), không vỡ đường tiền
    }
    // Lỗi khác (vd bảng lỗi tạm) → fail-SAFE: coi như không có combo (streak 0),
    // KHÔNG chặn chấm điểm (combo là phần thưởng phụ, không phải nguồn sự thật).
    console.error('bump_answer_streak RPC lỗi (fail-safe → combo tắt):', error.message);
    return null;
  }

  // data là jsonb { streak } hoặc số thuần — chuẩn hoá về số >=0.
  const raw = data && typeof data === 'object' ? (data as { streak?: unknown }).streak : data;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
