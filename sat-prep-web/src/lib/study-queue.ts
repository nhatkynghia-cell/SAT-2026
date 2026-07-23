import type { MasterySummary } from './mastery';
import type { AdaptiveRecommendation } from './adaptive';

/**
 * ============================================================================
 *  STUDY QUEUE — LÕI THUẦN (pure) soạn hàng đợi học ưu tiên SRS + yếu nhất
 * ============================================================================
 *  Trục "đo tiến bộ bản thân" (RPG 60/40): hôm nay nên luyện gì? Soạn 1 hàng
 *  đợi ưu tiên theo "expected learning value":
 *    1. Lỗi ĐẾN HẠN ôn SRS (chống quên — giá trị học cao nhất, có skill_id).
 *    2. Vocab ĐẾN HẠN ôn SRS (rw.vocab).
 *    3. Skill YẾU NHẤT chưa thành thạo (adaptive fresh).
 *
 *  Pure: nhận summary + mảng due mistakes (có skill_id) + mảng due vocab +
 *  recommendation (từ recommendNext) → trả mảng StudyQueueItem ưu tiên. Caller
 *  (route) lấy item đầu để sinh câu. Unit-test được, không I/O.
 * ============================================================================
 */

export interface StudyQueueItem {
  /** 'due-mistake' | 'due-vocab' | 'weakness' — loại nguồn. */
  kind: 'due-mistake' | 'due-vocab' | 'weakness';
  skillId: string | null;
  /** Lý do ưu tiên (hiện cho user / debug). */
  reason: string;
}

/** Mục due tối thiểu từ mistakes-store (chỉ cần skill_id + id). */
export interface DueMistake {
  skill_id?: string | null;
}

/**
 * Soạn hàng đợi học. dueMistakes/dueVocab đã lọc isDue (caller lọc ở tầng I/O).
 * Trả mảng ưu tiên: due-mistake (có skill_id) → due-vocab → weakness. Bỏ due
 * không có skill_id ở mistake (không biết sinh câu gì) — vẫn để caller ôn lối
 * cũ qua /api/cau-sai.
 */
export function buildStudyQueue(
  summary: MasterySummary,
  dueMistakes: DueMistake[],
  dueVocabCount: number,
  recommendation: AdaptiveRecommendation | null
): StudyQueueItem[] {
  const items: StudyQueueItem[] = [];

  // 1. Lỗi đến hạn CÓ skill_id → ưu tiên cao nhất (chống quên + biết skill).
  for (const m of dueMistakes) {
    if (m && typeof m.skill_id === 'string' && m.skill_id.length > 0) {
      items.push({
        kind: 'due-mistake',
        skillId: m.skill_id,
        reason: 'Câu sai đến hạn ôn — ôn lại đúng lúc để nhớ lâu (spaced repetition).',
      });
    }
  }

  // 2. Vocab đến hạn → skill rw.vocab (route generate-practice moduleType=vocab).
  if (dueVocabCount > 0) {
    items.push({
      kind: 'due-vocab',
      skillId: 'rw.vocab',
      reason: `${dueVocabCount} từ vựng đến hạn ôn — giữ vốn từ dài hạn.`,
    });
  }

  // 3. Skill yếu nhất chưa thành thạo (adaptive fresh).
  if (recommendation) {
    items.push({
      kind: 'weakness',
      skillId: recommendation.skillId,
      reason: recommendation.reason,
    });
  }

  return items;
}

/**
 * Chọn 1 skillId để luyện từ đầu hàng đợi. Trả null khi rỗng (caller báo "không
 * có gì cần luyện hôm nay" — hiếm vì luôn có weakness hoặc stamina). Thuần.
 */
export function pickNextSkillId(queue: StudyQueueItem[]): string | null {
  return queue.length > 0 && queue[0].skillId ? queue[0].skillId : null;
}
