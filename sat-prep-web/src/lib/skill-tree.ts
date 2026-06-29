import type { MasterySummary } from './mastery';

/**
 * ============================================================================
 *  SKILL TREE — bản đồ năng lực SAT (implementation_plan.md §10.B.1, task #17)
 * ============================================================================
 *  QUYẾT ĐỊNH ĐÃ CHỐT: đây là HỆ TIẾN TRÌNH DUY NHẤT — đã bỏ Level phẳng 1-200.
 *  Tiến trình của người chơi = độ phủ + độ thành thạo chương trình SAT thật,
 *  KHÔNG phải một con số XP vô nghĩa.
 *
 *  • Mỗi NODE = một skill trong taxonomy.
 *  • Các CHƯƠNG (domain) có quan hệ tiên quyết: Toán nâng cao / Phân tích số liệu
 *    / Hình học cần nền Đại số trước (đúng sư phạm). Reading độc lập.
 *  • Trạng thái node: locked → available → in_progress → mastered.
 *
 *  ⚠️ THUẦN (pure) — chỉ import TYPE. Tính per-domain average ngay từ
 *  summary.skills (đã nhúng domainId) nên không cần import taxonomy → unit-test
 *  được bằng node:test.
 * ============================================================================
 */

/** Một chương được coi là "đạt tiên quyết" khi mastery trung bình >= ngưỡng này. */
export const DOMAIN_UNLOCK_THRESHOLD = 40;

/**
 * Tiên quyết theo CHƯƠNG (domainId → các domainId phải đạt ngưỡng trước).
 * Đại số là gốc; Reading độc lập.
 */
export const DOMAIN_PREREQS: Record<string, string[]> = {
  algebra: [],
  advanced_math: ['algebra'],
  data_analysis: ['algebra'],
  geometry: ['algebra'],
  reading_writing: [],
};

export type NodeState = 'locked' | 'available' | 'in_progress' | 'mastered';

export interface SkillNode {
  id: string;
  label: string;
  domainId: string;
  domainLabel: string;
  score: number;
  state: NodeState;
  /** Lý do bị khóa (nếu locked) — chương tiên quyết chưa đạt. */
  lockedBy?: string[];
}

export interface DomainProgress {
  id: string;
  label: string;
  avgScore: number;
  satisfied: boolean; // đã đạt ngưỡng mở khóa chương phụ thuộc?
}

export interface SkillTreeView {
  domains: DomainProgress[];
  nodes: SkillNode[];
  /** Số node đã mastered / tổng — thay cho "Level" cũ. */
  masteredCount: number;
  totalNodes: number;
}

/** Tính mastery trung bình mỗi chương từ summary (thuần). */
function domainAverages(summary: MasterySummary): Map<string, { label: string; avg: number }> {
  const acc = new Map<string, { label: string; sum: number; n: number }>();
  for (const s of summary.skills) {
    const cur = acc.get(s.domainId) ?? { label: s.domainLabel, sum: 0, n: 0 };
    cur.sum += s.score;
    cur.n += 1;
    acc.set(s.domainId, cur);
  }
  const out = new Map<string, { label: string; avg: number }>();
  for (const [id, v] of acc) {
    out.set(id, { label: v.label, avg: v.n ? Math.round(v.sum / v.n) : 0 });
  }
  return out;
}

/** Dựng toàn bộ trạng thái Skill Tree từ mastery hiện tại. */
export function buildSkillTree(summary: MasterySummary): SkillTreeView {
  const avgs = domainAverages(summary);

  // Chương nào đã "đạt tiên quyết" (avg >= ngưỡng).
  const satisfied = new Map<string, boolean>();
  for (const [id, v] of avgs) {
    satisfied.set(id, v.avg >= DOMAIN_UNLOCK_THRESHOLD);
  }

  // Chương nào đang MỞ KHÓA (mọi tiên quyết đã đạt).
  function domainUnlocked(domainId: string): { unlocked: boolean; lockedBy: string[] } {
    const prereqs = DOMAIN_PREREQS[domainId] ?? [];
    const missing = prereqs.filter((p) => !satisfied.get(p));
    return { unlocked: missing.length === 0, lockedBy: missing };
  }

  const nodes: SkillNode[] = summary.skills.map((s) => {
    const { unlocked, lockedBy } = domainUnlocked(s.domainId);

    let state: NodeState;
    if (!unlocked) {
      state = 'locked';
    } else if (s.mastered) {
      state = 'mastered';
    } else if (s.attempts > 0) {
      state = 'in_progress';
    } else {
      state = 'available';
    }

    const node: SkillNode = {
      id: s.id,
      label: s.label,
      domainId: s.domainId,
      domainLabel: s.domainLabel,
      score: s.score,
      state,
    };
    if (state === 'locked') {
      // Đổi domainId tiên quyết thành nhãn chương cho dễ hiểu.
      node.lockedBy = lockedBy.map((id) => avgs.get(id)?.label ?? id);
    }
    return node;
  });

  const domains: DomainProgress[] = [...avgs.entries()].map(([id, v]) => ({
    id,
    label: v.label,
    avgScore: v.avg,
    satisfied: satisfied.get(id) ?? false,
  }));

  const masteredCount = nodes.filter((n) => n.state === 'mastered').length;

  return { domains, nodes, masteredCount, totalNodes: nodes.length };
}
