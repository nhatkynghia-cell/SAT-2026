/**
 * ============================================================================
 *  CEFR — LỚP NHÃN / MÀU / GAP THUẦN (pure) cho bậc Cambridge KET(A2)/PET(B1)
 * ============================================================================
 *  Lớp trình diện UI bên trên score-math.ts: nhãn song ngữ, màu badge, exam
 *  tương ứng (KET/PET), khoảng cách tới mục tiêu, và suy band (A2/B1/A2·B1) từ
 *  skillId. Re-export các symbol lõi của score-math để UI import 1 chỗ.
 *
 *  THUẦN: không import next/headers/supabase → unit-test được mà không kéo
 *  runtime. ADDITIVE: KHÔNG sửa score-math.ts (chỉ re-export + bổ sung).
 * ============================================================================
 */

// Re-export lõi từ score-math.ts để UI import 1 chỗ (không nhân bản logic).
// NOTE: bỏ đuôi .ts (tsconfig dùng moduleResolution "bundler", không bật
// allowImportingTsExtensions → đuôi .ts trong lib non-test làm hỏng tsc). Trình
// tải test (--import loader-register.mjs) vẫn resolve được cả hai dạng.
export type { CEFRLevel } from './score-math';
export {
  masteryToCEFR,
  cefrToScale,
  TARGET_LEVELS,
  SCALE_MIN,
  SCALE_MAX,
} from './score-math';

import type { CEFRLevel } from './score-math';

/** Band Cambridge của một skill: A2 (KET), B1 (PET), hoặc A2/B1 (phục vụ cả 2). */
export type SkillBand = 'A2' | 'B1' | 'A2/B1';

/** Màu badge tailwind cho một bậc CEFR (3 field className: bg / text / ring). */
export interface CEFRColor {
  bg: string;
  text: string;
  ring: string;
}

/** Thang thứ tự 4 bậc CEFR (thấp → cao) dùng tính gap. */
const CEFR_ORDER: CEFRLevel[] = ['Pre-A1', 'A1', 'A2', 'B1'];

const cefrIndex = (level: CEFRLevel): number => CEFR_ORDER.indexOf(level);

/** Nhãn song ngữ đẹp cho badge/dashboard, VD 'A2 · KET (Cơ bản)'. */
const CEFR_LABEL: Record<CEFRLevel, string> = {
  'Pre-A1': 'Pre-A1 · Chưa xếp lớp',
  'A1': 'A1 · Pre-KET',
  'A2': 'A2 · KET (Cơ bản)',
  'B1': 'B1 · PET (Trung cấp)',
};

/** Trả nhãn song ngữ đẹp cho một bậc CEFR (dùng cho badge/dashboard). */
export function cefrLabel(level: CEFRLevel): string {
  return CEFR_LABEL[level];
}

/** Trả nhãn ngắn gọn cho chip nhỏ, VD 'A2', 'B1' (chính là tên bậc). */
export function cefrShortLabel(level: CEFRLevel): string {
  return level;
}

/** Bộ màu tailwind (bg/text/ring) cho từng bậc CEFR. */
const CEFR_COLOR: Record<CEFRLevel, CEFRColor> = {
  'Pre-A1': { bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-200' },
  'A1': { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-200' },
  'A2': { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-200' },
  'B1': { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
};

/** Trả bộ màu tailwind (bg/text/ring) cho một bậc CEFR. */
export function cefrColor(level: CEFRLevel): CEFRColor {
  return CEFR_COLOR[level];
}

/** Exam Cambridge tương ứng bậc: A2→KET, B1→PET, Pre-A1/A1→null (chưa đủ thi). */
const CEFR_EXAM: Record<CEFRLevel, 'KET' | 'PET' | null> = {
  'Pre-A1': null,
  'A1': null,
  'A2': 'KET',
  'B1': 'PET',
};

/** Trả exam Cambridge tương ứng bậc (A2→KET, B1→PET; Pre-A1/A1→null). */
export function cefrExam(level: CEFRLevel): 'KET' | 'PET' | null {
  return CEFR_EXAM[level];
}

/**
 * Khoảng cách bậc từ current tới target theo thang Pre-A1<A1<A2<B1.
 * Trả { steps: 0, label: 'Đã đạt mục tiêu' } khi current>=target (đã đạt/vượt);
 * ngược lại steps = hiệu số bậc dương + nhãn `Còn N bậc tới <target>`.
 */
export function cefrGap(
  current: CEFRLevel,
  target: CEFRLevel
): { steps: number; label: string } {
  const steps = cefrIndex(target) - cefrIndex(current);
  if (steps <= 0) return { steps: 0, label: 'Đã đạt mục tiêu' };
  return { steps, label: `Còn ${steps} bậc tới ${target}` };
}

/**
 * Map tĩnh band của từng skill trong taxonomy (theo skill-taxonomy.ts).
 * Skill foundation (grammar/vocabulary) gắn band rõ theo suffix level; skill bám
 * task-type (reading/writing/listening/speaking) phục vụ cả A2 lẫn B1 → 'A2/B1'.
 * Khi thêm skill mới có suffix '.a2'/'.b1' mà chưa liệt kê, bandOfSkill dùng
 * fallback suffix (xem bandOfSkill) nên vẫn suy đúng.
 */
export const SKILL_BAND_MAP: Record<string, SkillBand> = {
  // reading — bám task-type, phục vụ cả KET & PET
  'reading.notice_mcq': 'A2/B1',
  'reading.matching': 'A2/B1',
  'reading.detail_mcq': 'A2/B1',
  'reading.gapped_text': 'A2/B1',
  'reading.cloze_vocab': 'A2/B1',
  'reading.open_cloze': 'A2/B1',
  // writing — bám task-type, phục vụ cả KET & PET
  'writing.short_message': 'A2/B1',
  'writing.story_pictures': 'A2/B1',
  'writing.email_100': 'A2/B1',
  'writing.article_or_story': 'A2/B1',
  // listening — bám task-type, phục vụ cả KET & PET
  'listening.short_convo': 'A2/B1',
  'listening.matching': 'A2/B1',
  'listening.gap_fill': 'A2/B1',
  'listening.long_convo': 'A2/B1',
  // speaking — bám task-type, phục vụ cả KET & PET
  'speaking.interview': 'A2/B1',
  'speaking.collaborative': 'A2/B1',
  'speaking.long_turn': 'A2/B1',
  'speaking.discussion': 'A2/B1',
  // foundation — band rõ theo suffix level
  'grammar.a2': 'A2',
  'grammar.b1': 'B1',
  'vocabulary.a2': 'A2',
  'vocabulary.b1': 'B1',
};

/**
 * Suy band Cambridge từ skillId: '*.a2'→A2, '*.b1'→B1, skill không suffix level
 * (reading/listening/writing/speaking bám task-type)→'A2/B1'. Ưu tiên tra
 * SKILL_BAND_MAP; nếu skill chưa liệt kê, dùng suffix làm fallback; không có
 * suffix rõ → mặc định 'A2/B1'.
 */
export function bandOfSkill(skillId: string): SkillBand {
  const mapped = SKILL_BAND_MAP[skillId];
  if (mapped) return mapped;
  if (skillId.endsWith('.a2')) return 'A2';
  if (skillId.endsWith('.b1')) return 'B1';
  return 'A2/B1';
}
