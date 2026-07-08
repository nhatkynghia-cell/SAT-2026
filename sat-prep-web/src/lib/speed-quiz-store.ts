import { createAdminClient } from '@/lib/supabase/admin';
import { getCycleKey } from './season';
import { milestonesReached } from './speed-quiz';

/**
 * ============================================================================
 *  SPEED QUIZ STORE (I/O) — session server-side + thưởng mốc idempotent
 * ============================================================================
 *  Ghi qua service-role (RPC SECURITY INVOKER, RLS chỉ SELECT own). Mọi RPC
 *  idempotent/atomic (xem speed_quiz.sql). FAIL-SAFE pre-migration: RPC/bảng
 *  chưa tồn tại (42883/PGRST202/42P01/PGRST205) → trả null → route bỏ qua thưởng
 *  + xếp hạng ("sắp ra mắt"), KHÔNG mở faucet. Mẫu tryConsumePvpFightAtomic.
 *
 *  🔴 CHỐNG GIAN LẬN: correct_count do finalize RPC ĐẾM câu was_correct=true
 *  (issued_questions) tag cho session — KHÔNG tin client khai.
 * ============================================================================
 */

/** RPC/bảng chưa tồn tại (migration chưa chạy) → fail-safe. */
function isMissing(error: { code?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42883' || // undefined_function
    error.code === 'PGRST202' || // function không có trong schema cache
    error.code === '42P01' || // undefined_table
    error.code === 'PGRST205' // bảng không có trong schema cache
  );
}

/**
 * Tạo lượt chơi mới, STAMP cycle keys từ giờ VN (nhất quán season.ts).
 * Trả session id, hoặc null nếu pre-migration / lỗi → route tắt tính năng session.
 */
export async function startSession(userId: string, now: Date = new Date()): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('start_speed_quiz_session', {
    p_user_id: userId,
    p_day_key: getCycleKey(now, 'day'),
    p_week_key: getCycleKey(now, 'week'),
    p_month_key: getCycleKey(now, 'month'),
    p_year_key: getCycleKey(now, 'year'),
  });

  if (error) {
    if (!isMissing(error)) console.error('startSession RPC lỗi:', error.message);
    return null;
  }
  return typeof data === 'string' ? data : null;
}

/**
 * Tag câu vừa phát vào session (chống gian lận đếm). Idempotent, tự bảo vệ
 * quyền sở hữu trong RPC. Không chặn luồng phát câu nếu lỗi (nuốt).
 */
export async function tagQuestion(sessionId: string, userId: string, questionId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc('tag_speed_quiz_question', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_question_id: questionId,
  });
  if (error && !isMissing(error)) console.error('tagQuestion RPC lỗi (bỏ qua):', error.message);
}

export interface FinalizeResult {
  correctCount: number;
  dayKey: string;
  alreadyEnded: boolean;
}

/**
 * Chốt lượt: server ĐẾM câu đúng THẬT, đóng session. Idempotent (đã chốt → trả
 * lại số cũ). Trả null nếu pre-migration / session không thuộc user / lỗi.
 */
export async function finalizeSession(sessionId: string, userId: string): Promise<FinalizeResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('finalize_speed_quiz_session', {
    p_session_id: sessionId,
    p_user_id: userId,
  });

  if (error) {
    if (!isMissing(error)) console.error('finalizeSession RPC lỗi:', error.message);
    return null;
  }
  const r = (data ?? {}) as { ok?: boolean; correctCount?: number; dayKey?: string; alreadyEnded?: boolean };
  if (!r.ok) return null;
  return {
    correctCount: typeof r.correctCount === 'number' ? r.correctCount : 0,
    dayKey: typeof r.dayKey === 'string' ? r.dayKey : '',
    alreadyEnded: r.alreadyEnded === true,
  };
}

export interface MilestoneClaim {
  milestone: number;
  coins: number;
}

export interface ClaimResult {
  totalCoins: number;
  claims: MilestoneClaim[];
  /** false = pre-migration → route trả "sắp ra mắt". */
  available: boolean;
}

/**
 * Cộng xu cho MỌI mốc đã đạt với correctCount, idempotent 1 lần/ngày/mốc.
 * correctCount PHẢI là số server đếm (finalizeSession) — KHÔNG dùng số client.
 * Trả tổng xu VỪA CỘNG (mốc nhận lần đầu hôm nay) + danh sách mốc đó.
 */
export async function claimMilestones(
  userId: string,
  dayKey: string,
  correctCount: number
): Promise<ClaimResult> {
  const reached = milestonesReached(correctCount);
  if (reached.length === 0) return { totalCoins: 0, claims: [], available: true };

  const admin = createAdminClient();
  let totalCoins = 0;
  const claims: MilestoneClaim[] = [];

  for (const m of reached) {
    const { data, error } = await admin.rpc('claim_speed_quiz_milestone', {
      p_user_id: userId,
      p_day_key: dayKey,
      p_milestone: m.correct,
      p_coins: m.coins,
    });
    if (error) {
      if (isMissing(error)) return { totalCoins: 0, claims: [], available: false };
      console.error('claimMilestone RPC lỗi:', error.message);
      continue; // mốc lỗi thì bỏ qua, tiếp mốc khác (không chặn)
    }
    const r = (data ?? {}) as { ok?: boolean; claimed?: boolean };
    if (r.ok && r.claimed) {
      totalCoins += m.coins;
      claims.push({ milestone: m.correct, coins: m.coins });
    }
  }

  return { totalCoins, claims, available: true };
}

/**
 * Chốt thưởng CUỐI KỲ cho 1 user ở 1 kỳ (Pha 4, cron). Idempotent theo
 * (user, cycle_type, cycle_key): chạy lại KHÔNG cộng trùng. Trả:
 *   • true  — vừa phát (lần đầu cho kỳ này).
 *   • false — đã phát trước đó (idempotent) HOẶC input xấu.
 *   • null  — pre-migration (RPC chưa có) → cron dừng an toàn.
 */
export async function settleReward(
  userId: string,
  cycleType: string,
  cycleKey: string,
  rank: number,
  coins: number
): Promise<boolean | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('settle_speed_quiz_reward', {
    p_user_id: userId,
    p_cycle_type: cycleType,
    p_cycle_key: cycleKey,
    p_rank: rank,
    p_coins: coins,
  });

  if (error) {
    if (isMissing(error)) return null;
    console.error('settleReward RPC lỗi:', error.message);
    return false;
  }
  const r = (data ?? {}) as { ok?: boolean; settled?: boolean };
  return !!(r.ok && r.settled);
}
