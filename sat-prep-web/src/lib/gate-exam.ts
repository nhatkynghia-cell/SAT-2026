/**
 * CỔNG KHẢO THÍ — pure logic (implementation_plan.md §10.B.3, task T5)
 *
 * Boss=Assessment gate mở khóa chương trong Skill Tree.
 * Đạt ngưỡng mastery chương → mở Đề Thi Cổng; trượt → không mở chương kế,
 * đẩy về luyện skill yếu (adaptive).
 */

export const GATE_QUESTIONS = 5;
export const GATE_PASS_THRESHOLD = 4;
export const RETRY_CORRECT_NEEDED = 10;
/** Must match DOMAIN_UNLOCK_THRESHOLD in skill-tree.ts */
export const GATE_DOMAIN_THRESHOLD = 40;
/** Key under user_mastery.skills JSONB holding the per-domain gate map. */
export const GATES_KEY = '__gates__';

export interface GateProgress {
  passed: boolean;
  lastAttempt: string;
  score: number;
  correctSinceFail: number;
}

export interface GateResult {
  passed: boolean;
  nearMiss: boolean;
  score: number;
}

export function isGateEligible(domainAvg: number, gate: GateProgress | undefined): boolean {
  if (domainAvg < GATE_DOMAIN_THRESHOLD) return false;
  if (gate?.passed) return false;
  return isRetryAllowed(gate);
}

export function isRetryAllowed(gate: GateProgress | undefined): boolean {
  if (!gate) return true;
  if (gate.passed) return false;
  return gate.correctSinceFail >= RETRY_CORRECT_NEEDED;
}

export function evaluateGateResult(correctCount: number): GateResult {
  const score = Math.max(0, Math.min(GATE_QUESTIONS, Math.floor(correctCount)));
  return {
    passed: score >= GATE_PASS_THRESHOLD,
    nearMiss: score === GATE_PASS_THRESHOLD - 1,
    score,
  };
}

/**
 * Tăng đếm câu đúng tích lũy của 1 chương (cooldown thi lại) NGAY trong object
 * `skills` của mastery store — để recordAnswer ghi cùng 1 lần, tránh round-trip
 * thừa + tránh race với saveMastery trên cùng dòng user_mastery.
 *
 * No-op (trả false) nếu chương chưa từng thi (chưa có gate) hoặc gate đã pass.
 * THUẦN: chỉ mutate object truyền vào, không I/O → unit-test được.
 */
export function bumpDomainGateProgress(
  skills: Record<string, unknown>,
  domainId: string
): boolean {
  const gates = skills[GATES_KEY] as Record<string, GateProgress> | undefined;
  const gate = gates?.[domainId];
  if (!gate || gate.passed) return false;
  gate.correctSinceFail += 1;
  return true;
}
