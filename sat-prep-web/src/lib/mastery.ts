import { loadMastery, saveMastery } from './mastery-store';
import { ALL_SKILLS, isValidSkill, getDomainOfSkill, SKILL_TREE, type Subject } from './skill-taxonomy';
import { bumpDomainGateProgress } from './gate-exam';
import { todayStr } from './leitner';

/**
 * ============================================================================
 *  MASTERY ENGINE — đo % thành thạo từng skill (implementation_plan.md §10.A.3)
 * ============================================================================
 *  NỀN MÓNG TRUNG TÂM: dữ liệu mastery nuôi Skill Tree (#17), Score Prediction
 *  (#11), Adaptive (#12), Base Stats (#18), Boss = assessment (#19).
 *
 *  Mô hình (giữ đơn giản, robust — IRT/theta để dành task #12):
 *    • Mỗi skill có điểm mastery 0..100.
 *    • Mỗi câu trả lời cập nhật theo EWMA (trung bình trượt mũ): hiệu suất gần
 *      đây có sức nặng hơn. Câu khó đúng → tăng nhiều; câu dễ sai → giảm nhiều.
 *    • attempts đủ lớn mới coi là "đáng tin" (phục vụ gating Skill Tree sau này).
 *
 *  Server-authoritative: mastery CHỈ được cập nhật ở server từ kết quả trả lời
 *  đã xác thực (nhất quán với §9.1) — client không ghi thẳng điểm mastery.
 * ============================================================================
 */

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface SkillMastery {
  score: number;       // 0..100, mức thành thạo hiện tại
  attempts: number;    // số câu đã làm cho skill này
  correct: number;     // số câu đúng
  lastSeen: string;    // ISO timestamp lần cập nhật gần nhất
  /**
   * Độ tin cậy của mastery (0..1). Tăng theo số câu đã làm + độ tươi (ôn gần
   * đây), giảm khi lâu không ôn. Optional (dữ liệu cũ pre-migration không có →
   * derive = attempts/RELIABLE_ATTEMPTS). Dùng cho RPG 60/40: chỉ tin mastery
   * có confidence cao làm nền "đo tiến bộ bản thân" + gate boss/PvP chặt hơn.
   */
  confidence?: number;
  /**
   * Ngày (YYYY-MM-DD VN) của lần ĐÚNG đầu tiên — dùng kiểm "retention": để coi
   * là đã TINH THÔNG bền vững cần thêm 1 lần đúng ở lần ôn cách ≥1 ngày sau đó.
   * Optional (dữ liệu cũ → undefined → retention chưa đạt, nhưng KHÔNG tụt
   * mastered đã đạt để tránh khóa Skill Tree — pattern gate permanent).
   */
  firstCorrectDay?: string;
}

export interface MasteryStore {
  skills: Record<string, SkillMastery>;
}

/** Trọng số học theo độ khó: câu khó tác động mạnh hơn câu dễ. */
const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  Easy: 0.10,
  Medium: 0.18,
  Hard: 0.28,
};

/** Số câu tối thiểu để mastery của 1 skill được coi là "đáng tin". */
export const RELIABLE_ATTEMPTS = 5;

/** Ngưỡng % để coi là đã "làm chủ" skill (dùng cho Skill Tree gating). */
export const MASTERED_THRESHOLD = 80;

/**
 * Số ngày tối thiểu giữa lần đúng đầu tiên và một lần ôn đúng sau đó để coi
 * mastery là "bền vững" (retention). Phục vụ RPG 60/40: "mastered" giờ phản
 * ánh học bền vững, không phải burst ngắn hạn. Số ngày dùng trục VN khớp
 * `todayStr` (leitner.ts). attempts/score vẫn giữ (tương thích gate hiện có).
 */
export const RETENTION_GAP_DAYS = 1;

/**
 * Confidence tươi giảm một nửa sau bao nhiêu ngày không ôn (half-life). Dùng
 * trục VN ngày. Mastery cũ không ôn dài → confidence tụt → RPG không tin vào
 * mastery "ngốn" lâu ngày, ép user ôn duy trì (cải thiện "đo tiến bộ bản thân").
 */
export const CONFIDENCE_HALF_LIFE_DAYS = 30;

function emptySkill(): SkillMastery {
  return { score: 0, attempts: 0, correct: 0, lastSeen: '', confidence: 0, firstCorrectDay: undefined };
}

/**
 * Confidence (0..1) của 1 skill: kết hợp "độ tin theo số câu" + "độ tươi theo
 * ngày cuối ôn". Pure: nhận attempts + lastSeen (ISO) + `nowMs` tiêm để test.
 *   • attemptsPart = min(1, attempts / RELIABLE_ATTEMPTS) — 5+ câu mới tin đầy.
 *   • freshPart = 0.5^(daysSinceLastSeen / CONFIDENCE_HALF_LIFE_DAYS) — tụt
 *     một nỗi mỗi 30 ngày không ôn. Không có lastSeen → freshPart=0.
 *   • confidence = attemptsPart * freshPart (cả hai phải tốt).
 * Trả về số trong [0..1]. Dùng cho UI/RPG hiển thị "độ tin" + gate boss/PvP.
 */
export function computeConfidence(
  attempts: number,
  lastSeen: string,
  nowMs: number = Date.now()
): number {
  const attemptsPart = Math.min(1, attempts / RELIABLE_ATTEMPTS);
  if (!lastSeen) return 0;
  const lastMs = new Date(lastSeen).getTime();
  if (Number.isNaN(lastMs)) return 0;
  const daysSince = Math.max(0, (nowMs - lastMs) / 86_400_000);
  const freshPart = Math.pow(0.5, daysSince / CONFIDENCE_HALF_LIFE_DAYS);
  return Math.max(0, Math.min(1, attemptsPart * freshPart));
}

/**
 * Có đạt "retention" không: cần có lần đúng ĐẦU TIÊN (firstCorrectDay) AND một
 * lần ĐÚNG ở ngày KHÁC, cách firstCorrectDay ít nhất RETENTION_GAP_DAYS ngày.
 * Pure: nhận firstCorrectDay + lastCorrectDay (VN YYYY-MM-DD). Thiếu dữ liệu
 * (dữ liệu cũ) → false (chưa chứng minh bền vững), nhưng KHÔNG dùng để TỤT
 * mastered đã đạt ở nơi gate permanent (Skill Tree) — chỉ dùng cho gate "mới"
 * (boss/PvP/level bền vững) để không vỡ tương thích ngược.
 */
export function hasRetention(
  firstCorrectDay: string | undefined,
  lastCorrectDay: string | undefined
): boolean {
  if (!firstCorrectDay || !lastCorrectDay) return false;
  if (firstCorrectDay === lastCorrectDay) return false;
  const firstMs = new Date(firstCorrectDay + 'T00:00:00Z').getTime();
  const lastMs = new Date(lastCorrectDay + 'T00:00:00Z').getTime();
  if (Number.isNaN(firstMs) || Number.isNaN(lastMs)) return false;
  const gapDays = (lastMs - firstMs) / 86_400_000;
  return gapDays >= RETENTION_GAP_DAYS;
}

/**
 * Cập nhật mastery của 1 skill sau khi trả lời.
 * Trả về store mới (đã ghi xuống đĩa).
 */
export async function recordAnswer(
  userId: string,
  skillId: string,
  isCorrect: boolean,
  difficulty: Difficulty = 'Medium'
): Promise<SkillMastery> {
  if (!isValidSkill(skillId)) {
    throw new Error(`skillId không hợp lệ: ${skillId}`);
  }

  const store = await loadMastery(userId);
  if (!store.skills) store.skills = {};

  const cur = store.skills[skillId] ?? emptySkill();
  const alpha = DIFFICULTY_WEIGHT[difficulty];

  // EWMA hướng tới 100 (đúng) hoặc 0 (sai); câu khó kéo mạnh hơn.
  const target = isCorrect ? 100 : 0;
  const newScore = Math.round(cur.score + alpha * (target - cur.score));

  const nowISO = new Date().toISOString();
  const todayVN = todayStr();

  // Retention: ghi ngày ĐÚNG đầu tiên (chỉ đặt 1 lần) + ngày ĐÚNG cuối cùng
  // (cập nhật = hôm nay VN khi đúng; giữ nguyên khi sai). hasRetention so 2 ngày.
  const prevLastCorrect = (cur as SkillMastery & { lastCorrectDay?: string }).lastCorrectDay ?? '';
  const firstCorrectDay = cur.firstCorrectDay ?? (isCorrect ? todayVN : undefined);
  const lastCorrectDay = isCorrect ? todayVN : prevLastCorrect;

  const updated: SkillMastery = {
    score: Math.min(100, Math.max(0, newScore)),
    attempts: cur.attempts + 1,
    correct: cur.correct + (isCorrect ? 1 : 0),
    lastSeen: nowISO,
    confidence: computeConfidence(cur.attempts + 1, nowISO),
    ...(firstCorrectDay ? { firstCorrectDay } : {}),
    ...({ lastCorrectDay } as { lastCorrectDay?: string }),
  };

  store.skills[skillId] = updated;

  // Gộp đếm câu đúng tích lũy cho cooldown thi lại VÀO CÙNG lần ghi này (tránh
  // race read-modify-write thứ 2 trên cùng dòng user_mastery). `store.skills`
  // round-trip cả `__gates__` nên bump trực tiếp ở đây là an toàn.
  if (isCorrect) {
    const domain = getDomainOfSkill(skillId);
    if (domain) {
      bumpDomainGateProgress(store.skills as Record<string, unknown>, domain.id);
    }
  }

  await saveMastery(userId, store);
  return updated;
}

/**
 * Kiểm "mastered bền vững" cho 1 skill: đủ attempts + score≥threshold + có
 * retention (ít nhất 1 lần đúng cách lần đầu ≥1 ngày). Pure, nhận SkillMastery.
 * Dữ liệu cũ thiếu field → retention=false → trả false (chưa chứng minh bền).
 * Dùng cho level/boss/PvP gate "mới"; KHÔNG thay thế `mastered` hiện tại ở
 * summarizeMastery (giữ Skill Tree không bị khóa lại).
 */
export function isDurableMastered(skill: SkillMastery): boolean {
  if (skill.attempts < RELIABLE_ATTEMPTS) return false;
  if (skill.score < MASTERED_THRESHOLD) return false;
  const lastCorrectDay = (skill as SkillMastery & { lastCorrectDay?: string }).lastCorrectDay;
  return hasRetention(skill.firstCorrectDay, lastCorrectDay);
}

/**
 * Số skill đã TINH THÔNG BỀN VỮNG (durable mastered) của user — nền cho "level"
 * RPG 60/40 phản ánh học bền vững thay vì burst ngắn. Pure, nhận MasteryStore
 * dạng Record. Dữ liệu cũ thiếu field → durable=false → đếm 0 (an toàn, không
 * tự mở khóa; user ôn thêm sẽ đạt).
 */
export function countDurableMastered(
  skillsData: Record<string, SkillMastery>
): number {
  return ALL_SKILLS.filter((s) => isDurableMastered(skillsData[s.id] ?? emptySkill())).length;
}

/** Đọc mastery của 1 skill (mặc định rỗng nếu chưa làm). */
export async function getSkillMastery(userId: string, skillId: string): Promise<SkillMastery> {
  const store = await loadMastery(userId);
  return store.skills?.[skillId] ?? emptySkill();
}

export interface MasterySummary {
  /** Mastery từng skill, kèm nhãn + cờ đã-làm-chủ + đáng-tin + định danh module/môn/chương. */
  skills: Array<{
    id: string;
    label: string;
    score: number;
    attempts: number;
    correct: number;
    reliable: boolean;
    mastered: boolean;
    // Nhúng sẵn để các module THUẦN (adaptive, skill-tree, stats) không phải
    // import lại taxonomy — giữ chúng pure, unit-test được.
    moduleType: string;
    subject: Subject;
    domainId: string;
    domainLabel: string;
  }>;
  /** Mastery trung bình theo từng môn (math/reading). */
  bySubject: Record<Subject, number>;
  /** Mastery tổng thể toàn bộ skill (0..100). */
  overall: number;
}

/**
 * Tổng hợp toàn bộ mastery của user — đầu vào cho dashboard, Skill Tree,
 * Score Prediction và Base Stats.
 */
export async function getMasterySummary(userId: string): Promise<MasterySummary> {
  const store = await loadMastery(userId);
  return summarizeMastery(store.skills ?? {});
}

/**
 * Tổng hợp mastery THUẦN từ map skillId→SkillMastery (không I/O). Tách khỏi
 * getMasterySummary để đường phụ huynh (đọc dữ liệu con qua service-role) tái
 * dụng cùng logic mà không cần RLS session của con.
 */
export function summarizeMastery(skillsData: Record<string, SkillMastery>): MasterySummary {
  const skills = ALL_SKILLS.map((s) => {
    const m = skillsData[s.id] ?? emptySkill();
    const domain = getDomainOfSkill(s.id);
    return {
      id: s.id,
      label: s.label,
      score: m.score,
      attempts: m.attempts,
      correct: m.correct,
      reliable: m.attempts >= RELIABLE_ATTEMPTS,
      mastered: m.attempts >= RELIABLE_ATTEMPTS && m.score >= MASTERED_THRESHOLD,
      moduleType: s.moduleType,
      subject: (domain?.subject ?? 'math') as Subject,
      domainId: domain?.id ?? '',
      domainLabel: domain?.label ?? '',
    };
  });

  // Trung bình theo môn.
  const bySubject = { math: 0, reading: 0 } as Record<Subject, number>;
  for (const subject of ['math', 'reading'] as Subject[]) {
    const ids = SKILL_TREE.filter((d) => d.subject === subject).flatMap((d) => d.skills.map((s) => s.id));
    const scores = ids.map((id) => skillsData[id]?.score ?? 0);
    bySubject[subject] = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  const allScores = ALL_SKILLS.map((s) => skillsData[s.id]?.score ?? 0);
  const overall = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

  return { skills, bySubject, overall };
}
