import type { MasterySummary } from './mastery';
import type { GateProgress } from './gate-exam';

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

export type GateStatus = 'not_required' | 'available' | 'locked' | 'passed' | 'cooldown';

export interface DomainProgress {
  id: string;
  label: string;
  avgScore: number;
  satisfied: boolean;
  gateStatus: GateStatus;
  correctSinceFail?: number;
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
export function buildSkillTree(
  summary: MasterySummary,
  gates: Record<string, GateProgress> = {}
): SkillTreeView {
  const avgs = domainAverages(summary);

  // Chương đạt ngưỡng mastery avg (điều kiện CẦN để thi cổng).
  const meetsThreshold = new Map<string, boolean>();
  for (const [id, v] of avgs) {
    meetsThreshold.set(id, v.avg >= DOMAIN_UNLOCK_THRESHOLD);
  }

  // Chương nào không cần gate (không có chương phụ thuộc nào nhìn vào nó).
  const hasDependent = new Set<string>();
  for (const prereqs of Object.values(DOMAIN_PREREQS)) {
    for (const p of prereqs) hasDependent.add(p);
  }

  // Gate status từng chương.
  function getGateStatus(domainId: string): GateStatus {
    if (!hasDependent.has(domainId)) return 'not_required';
    const gate = gates[domainId];
    if (gate?.passed) return 'passed';
    if (!meetsThreshold.get(domainId)) return 'locked';
    if (!gate) return 'available';
    // ⚠️ 10 = RETRY_CORRECT_NEEDED (gate-exam.ts). KHÔNG import được vì module
    // này phải thuần để node:test chạy (import value chéo .ts gãy runner). Đổi 2 nơi.
    if (gate.correctSinceFail >= 10) return 'available';
    return 'cooldown';
  }

  // "satisfied" = avg đạt ngưỡng VÀ gate passed (hoặc domain không cần gate).
  const satisfied = new Map<string, boolean>();
  for (const [id] of avgs) {
    const gs = getGateStatus(id);
    satisfied.set(id, meetsThreshold.get(id)! && (gs === 'passed' || gs === 'not_required'));
  }

  // Chương nào đang MỞ KHÓA (mọi tiên quyết đã satisfied).
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
      node.lockedBy = lockedBy.map((id) => avgs.get(id)?.label ?? id);
    }
    return node;
  });

  const domains: DomainProgress[] = [...avgs.entries()].map(([id, v]) => {
    const gs = getGateStatus(id);
    const domain: DomainProgress = {
      id,
      label: v.label,
      avgScore: v.avg,
      satisfied: satisfied.get(id) ?? false,
      gateStatus: gs,
    };
    if (gs === 'cooldown') {
      domain.correctSinceFail = gates[id]?.correctSinceFail ?? 0;
    }
    return domain;
  });

  const masteredCount = nodes.filter((n) => n.state === 'mastered').length;

  return { domains, nodes, masteredCount, totalNodes: nodes.length };
}
