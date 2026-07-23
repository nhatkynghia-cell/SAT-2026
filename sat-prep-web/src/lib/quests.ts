/**
 * ============================================================================
 *  QUESTS (pure) — nhiệm vụ ngày XOAY VÒNG theo ngày, unit-test được
 * ============================================================================
 *  Trước đây chỉ 3 quest CỐ ĐỊNH (q1/q2/q3) → học sinh quay lại mỗi ngày thấy y
 *  hệt → chán. Nay mỗi quest thuộc 1 TRACK (answer/vocab/exam — đúng 3 loại hook
 *  tiến độ mà client theo dõi được), mỗi track có POOL biến thể. Mỗi ngày chọn 1
 *  biến thể/track theo hàm băm DETERMINISTIC từ dayKey → cùng 1 ngày mọi lần load
 *  ra CÙNG bộ quest (ổn định), sang ngày mới → bộ khác (tươi mới).
 *
 *  🔴 MONEY-PATH: QUEST_REWARD_MAP DẪN XUẤT từ pool (mọi biến thể) → server tra
 *  thưởng theo questId như cũ, KHÔNG cần bảng tay riêng (đóng luôn drift-risk khi
 *  thêm quest mà quên cập nhật reward). Biến thể ĐẦU mỗi track giữ id q1/q2/q3 để
 *  tương thích ngược (economy tests + DEFAULT_STATE load-data).
 * ============================================================================
 */

/** Loại hook tiến độ client theo dõi được (khớp updateQuestProgress call-sites). */
export type QuestTrack = 'answer' | 'vocab' | 'exam';

/**
 * Loại HOÀN THÀNH server-side cho "learning contract" quest (RPG 60/40):
 * thay vì tin progress client, server đối chiếu SỰ KIỆN HỌC THẬT.
 *   • 'answer-correct'  : đếm câu ĐÚNG hôm nay (issued_questions was_correct + ngày).
 *   • 'vocab-reviewed'  : đếm từ vựng ôn hôm nay (vocab SRS advance).
 *   • 'exam-completed'  : đếm bài thi hoàn thành hôm nay.
 * Mỗi track gắn 1 metric + target. Pure: nhận metricValue + target → done?
 */
export type QuestCompletionMetric = 'answer-correct' | 'vocab-reviewed' | 'exam-completed';

export interface QuestVariant {
  id: string;
  track: QuestTrack;
  name: string;
  desc: string;
  target: number;
  xp: number;
  coins: number;
  /**
   * Metric server-side đối chiếu hoàn thành (learning contract). Optional:
   * quest cũ (q1/q2/q3...) không có → vẫn dùng progress client (tương thích).
   * Quest mới có metric → route quest kiểm metric THẬT trước khi cấp thưởng.
   */
  metric?: QuestCompletionMetric;
}

/**
 * POOL biến thể theo track. Reward giữ cùng TẦM mỗi track (nỗ lực ~ nhau) để
 * xoay vòng không tạo lệch cày cuốc. Biến thể đầu = q1/q2/q3 (tương thích ngược).
 */
export const QUEST_POOL: Record<QuestTrack, QuestVariant[]> = {
  answer: [
    { id: 'q1', track: 'answer', name: 'Khởi động ngày mới', desc: 'Làm đúng 5 câu hỏi', target: 5, xp: 50, coins: 10, metric: 'answer-correct' },
    { id: 'q1b', track: 'answer', name: 'Chiến binh chăm chỉ', desc: 'Làm đúng 8 câu hỏi', target: 8, xp: 50, coins: 10, metric: 'answer-correct' },
    { id: 'q1c', track: 'answer', name: 'Bứt tốc trí tuệ', desc: 'Làm đúng 6 câu hỏi liên tục', target: 6, xp: 50, coins: 10, metric: 'answer-correct' },
  ],
  vocab: [
    { id: 'q2', track: 'vocab', name: 'Chúa tể ngôn từ', desc: 'Học 10 từ vựng mới', target: 10, xp: 100, coins: 20, metric: 'vocab-reviewed' },
    { id: 'q2b', track: 'vocab', name: 'Thợ săn từ vựng', desc: 'Học 15 từ vựng mới', target: 15, xp: 100, coins: 20, metric: 'vocab-reviewed' },
    { id: 'q2c', track: 'vocab', name: 'Nhà sưu tầm chữ nghĩa', desc: 'Học 8 từ vựng mới', target: 8, xp: 100, coins: 20, metric: 'vocab-reviewed' },
  ],
  exam: [
    { id: 'q3', track: 'exam', name: 'Kẻ hủy diệt Practice Test', desc: 'Hoàn thành 1 bài thi thử', target: 1, xp: 500, coins: 100, metric: 'exam-completed' },
    { id: 'q3b', track: 'exam', name: 'Thử thách bản lĩnh', desc: 'Hoàn thành 1 bài thi thử', target: 1, xp: 500, coins: 100, metric: 'exam-completed' },
    { id: 'q3c', track: 'exam', name: 'Vượt vũ môn', desc: 'Hoàn thành 1 bài thi thử', target: 1, xp: 500, coins: 100, metric: 'exam-completed' },
  ],
};

const TRACK_ORDER: QuestTrack[] = ['answer', 'vocab', 'exam'];

/** Bảng thưởng dẫn xuất từ MỌI biến thể — nguồn DUY NHẤT cho server tra reward. */
export const QUEST_REWARD_MAP: Record<string, { coins: number; xp: number }> = Object.fromEntries(
  TRACK_ORDER.flatMap((t) => QUEST_POOL[t]).map((q) => [q.id, { coins: q.coins, xp: q.xp }])
);

/** Bảng metric theo questId — server tra để đối chiếu hoàn thành học thật. */
export const QUEST_METRIC_MAP: Record<string, QuestCompletionMetric | undefined> = Object.fromEntries(
  TRACK_ORDER.flatMap((t) => QUEST_POOL[t]).map((q) => [q.id, q.metric])
);

/** Bảng track theo questId — dùng dẫn xuất KHÓA CLAIM theo track (chống multi-variant). */
export const QUEST_TRACK_MAP: Record<string, QuestTrack> = Object.fromEntries(
  TRACK_ORDER.flatMap((t) => QUEST_POOL[t]).map((q) => [q.id, q.track])
);

/**
 * KHÓA CLAIM cho quest — theo TRACK, KHÔNG theo questId. Mỗi track (answer/vocab/
 * exam) chỉ phát 1 biến thể/ngày (pickDailyQuests) và mọi biến thể cùng track có
 * CÙNG reward + CÙNG metric → nếu khóa theo questId thì client script claim cả 3
 * biến thể (q3/q3b/q3c) trên 1 hoạt động thật → 3× thưởng (faucet, adversarial
 * review 2026-07-23). Khóa theo track → track đã nhận hôm nay thì mọi biến thể
 * khác 409. Prefix 'qtrack:' tránh đụng các sentinel bucket khác trong quest_claims.
 * questId lạ (không thuộc track nào) → trả chính questId (giữ hành vi cũ, an toàn
 * vì applyQuestReward đã chặn reward 0 cho questId lạ trước khi tới đây).
 */
export function questClaimKey(questId: string): string {
  const track = QUEST_TRACK_MAP[questId];
  return track ? `qtrack:${track}` : questId;
}

/**
 * Kiểm "learning contract" hoàn thành THUẦN: quest có metric → so metricValue
 * (server đếm hôm nay) với target. Quest KHÔNG có metric (dữ liệu cũ/quest lạ)
 * → trả 'unknown' để route GIỮ hành vi cũ (tin progress client / cấp như cũ),
 * KHÔNG chặn (0 regression). Trả 'done' | 'not-done' | 'unknown'.
 */
export function checkQuestCompletion(
  questId: string,
  metricValue: number | undefined
): 'done' | 'not-done' | 'unknown' {
  const metric = QUEST_METRIC_MAP[questId];
  if (!metric) return 'unknown';
  // Tìm quest variant để lấy target (mọi biến thể cùng track cùng target tầm).
  const variant = TRACK_ORDER.flatMap((t) => QUEST_POOL[t]).find((q) => q.id === questId);
  if (!variant) return 'unknown';
  if (typeof metricValue !== 'number' || Number.isNaN(metricValue)) return 'unknown';
  return metricValue >= variant.target ? 'done' : 'not-done';
}

/** Băm chuỗi → uint32 (djb2). Deterministic, không phụ thuộc thời điểm chạy. */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

export interface DailyQuest extends QuestVariant {
  progress: number;
  claimed: boolean;
}

/**
 * Bộ quest ngày cho `dayKey` ('YYYY-MM-DD'): mỗi track chọn 1 biến thể theo hàm
 * băm (dayKey + track) → ổn định trong ngày, xoay vòng theo ngày. progress 0.
 */
export function pickDailyQuests(dayKey: string): DailyQuest[] {
  return TRACK_ORDER.map((track) => {
    const pool = QUEST_POOL[track];
    const variant = pool[hashStr(`${dayKey}:${track}`) % pool.length];
    return { ...variant, progress: 0, claimed: false };
  });
}

/**
 * Giải quyết bộ quest ngày khi load: cùng ngày → GIỮ nguyên (bảo toàn progress/
 * claimed); ngày mới (hoặc chưa có dấu ngày) → bộ MỚI cho hôm nay (progress 0).
 * Thay cho rolloverDailyQuests cũ (chỉ reset, không xoay biến thể).
 */
export function resolveDailyQuests<T extends { id: string; progress: number; claimed?: boolean }>(
  savedDaily: T[],
  savedDate: string | null | undefined,
  today: string
): { daily: DailyQuest[] | T[]; changed: boolean } {
  if (savedDate === today && savedDaily.length > 0) {
    return { daily: savedDaily, changed: false };
  }
  return { daily: pickDailyQuests(today), changed: true };
}
