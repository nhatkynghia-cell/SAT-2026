import { loadMastery, saveMastery } from './mastery-store';
import { ALL_SKILLS, isValidSkill, getDomainOfSkill, SKILL_TREE, type Subject } from './skill-taxonomy';
import { bumpDomainGateProgress } from './gate-exam';

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

function emptySkill(): SkillMastery {
  return { score: 0, attempts: 0, correct: 0, lastSeen: '' };
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

  const updated: SkillMastery = {
    score: Math.min(100, Math.max(0, newScore)),
    attempts: cur.attempts + 1,
    correct: cur.correct + (isCorrect ? 1 : 0),
    lastSeen: new Date().toISOString(),
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
  /** Mastery trung bình theo từng môn (5 kỹ năng Cambridge). */
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
      subject: (domain?.subject ?? 'foundation') as Subject,
      domainId: domain?.id ?? '',
      domainLabel: domain?.label ?? '',
    };
  });

  // Trung bình theo môn — dẫn xuất ĐỘNG từ SKILL_TREE (5 kỹ năng: reading/
  // writing/listening/speaking/foundation) để không hardcode enum.
  const subjects = Array.from(new Set(SKILL_TREE.map((d) => d.subject))) as Subject[];
  const bySubject = Object.fromEntries(subjects.map((s) => [s, 0])) as Record<Subject, number>;
  for (const subject of subjects) {
    const ids = SKILL_TREE.filter((d) => d.subject === subject).flatMap((d) => d.skills.map((s) => s.id));
    const scores = ids.map((id) => skillsData[id]?.score ?? 0);
    bySubject[subject] = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  const allScores = ALL_SKILLS.map((s) => skillsData[s.id]?.score ?? 0);
  const overall = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

  return { skills, bySubject, overall };
}
