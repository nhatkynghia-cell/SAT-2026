/**
 * ONBOARDING FLAG — pure logic (Diagnostic Onboarding, §10.A.2)
 *
 * Đánh dấu user đã hoàn tất bài test xếp lớp đầu vào. Lưu dưới key
 * `__onboarding__` NGAY TRONG cột `user_mastery.skills` JSONB — cùng pattern với
 * `__gates__` (gate-exam.ts) → KHÔNG cần bảng/migration mới, và round-trip an
 * toàn cùng dữ liệu mastery + gates trên một dòng.
 *
 * THUẦN: chỉ đọc/mutate object truyền vào, không I/O → unit-test được.
 */

import type { CEFRLevel } from './score-math';

export const ONBOARDING_KEY = '__onboarding__';

export interface OnboardingState {
  completed: boolean;
  completedAt: string;
  /** Bậc CEFR mục tiêu user đặt lúc onboarding (nếu có) — chỉ để hiển thị lại. */
  targetLevel?: CEFRLevel;
}

const VALID_LEVELS: CEFRLevel[] = ['Pre-A1', 'A1', 'A2', 'B1'];

/** Đọc trạng thái onboarding từ object `skills`; null nếu chưa từng hoàn tất. */
export function readOnboarding(skills: Record<string, unknown> | null | undefined): OnboardingState | null {
  if (!skills) return null;
  const raw = skills[ONBOARDING_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const state = raw as Partial<OnboardingState>;
  if (state.completed !== true) return null;
  const hasLevel = typeof state.targetLevel === 'string' && VALID_LEVELS.includes(state.targetLevel);
  return {
    completed: true,
    completedAt: typeof state.completedAt === 'string' ? state.completedAt : '',
    ...(hasLevel ? { targetLevel: state.targetLevel } : {}),
  };
}

/**
 * Ghi cờ hoàn tất VÀO object `skills` (mutate tại chỗ, không đụng key khác như
 * skill mastery hay `__gates__`). Caller chịu trách nhiệm persist cả object.
 */
export function setOnboardingFlag(
  skills: Record<string, unknown>,
  opts: { completedAt: string; targetLevel?: CEFRLevel }
): void {
  const state: OnboardingState = {
    completed: true,
    completedAt: opts.completedAt,
    ...(opts.targetLevel ? { targetLevel: opts.targetLevel } : {}),
  };
  skills[ONBOARDING_KEY] = state;
}
