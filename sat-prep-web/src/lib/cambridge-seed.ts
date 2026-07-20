import seedData from '@/data/cambridge_bank_seed.json';
import { validateQuestion } from '@/lib/question-validate';

/**
 * ============================================================================
 *  CAMBRIDGE SEED (KET A2 / PET B1) — Phase 2
 * ============================================================================
 *  Loader THUẦN cho ngân hàng câu hỏi seed Cambridge KET/PET (reading/writing/
 *  listening/speaking + grammar/vocabulary). File seed do agent Phase 2 ghi
 *  (src/data/cambridge_bank_seed.json). Module này CHỈ nạp + lọc + validate,
 *  KHÔNG sinh câu, KHÔNG I/O DB — mirror vocab-seed.ts.
 *
 *    • getSeedQuestions(moduleType?, difficulty?) — lọc câu seed theo
 *      module/difficulty (tùy chọn).
 *    • seedBySkill()        — đếm câu theo skillId (dashboard "bank coverage").
 *    • validateAllSeed()    — chạy validateQuestion CHO MỖI câu seed, thu lọc
 *                              câu fail (test shape file seed — chặn câu lỗi
 *                              lọt ngân hàng, chống misconception entrenchment).
 *    • seedStats()          — tổng quan {total, byModule, byDifficulty,
 *                              invalidCount}.
 *
 *  Phụ thuộc file seed tồn tại lúc runtime (Phase 2 ghi trước verify cuối).
 *  Guard Array.isArray: nếu JSON import về object rỗng {} (không phải mảng)
 *  → SEED=[] an toàn thay vì crash `.filter` trên non-array.
 * ============================================================================
 */

export type CambridgeModuleType =
  | 'reading'
  | 'writing'
  | 'listening'
  | 'speaking'
  | 'grammar'
  | 'vocabulary';

export type CambridgeDifficulty = 'Easy' | 'Medium' | 'Hard';

export type CambridgeCefrLevel = 'A1' | 'A2' | 'B1';

export interface CambridgeSeedChoiceAnalysis {
  choice_letter: string;
  is_correct: boolean;
  analysis: string;
}

export interface CambridgeSeedQuestion {
  id: string;
  skillId: string;
  moduleType: string;
  difficulty: CambridgeDifficulty;
  cefr_level: CambridgeCefrLevel;
  title: string;
  full_passage: string;
  practice_question: string;
  choices: string[];
  correct_choice: string;
  explanation: string;
  trapRate: number;
  choice_analysis: CambridgeSeedChoiceAnalysis[];
}

/**
 * SEED: lọc câu hợp lệ (có id không rỗng). Guard Array.isArray cho trường hợp
 * JSON import về {} (object rỗng, không phải mảng) → SEED=[] thay vì throw
 * `.filter` trên non-array. Giữ khớp pattern vocab-seed.ts nhưng an toàn hơn
 * vì file seed do agent khác ghi (có thể lỗi cấu trúc).
 */
const SEED: CambridgeSeedQuestion[] = (
  Array.isArray(seedData) ? (seedData as CambridgeSeedQuestion[]) : []
).filter((x) => x && typeof x.id === 'string' && x.id.length > 0);

/**
 * Lọc câu seed theo moduleType và difficulty (cả hai tùy chọn — bỏ qua nếu
 * không truyền). Trả mảng mới (không mutate SEED).
 */
export function getSeedQuestions(
  moduleType?: string,
  difficulty?: string
): CambridgeSeedQuestion[] {
  return SEED.filter(
    (q) =>
      (!moduleType || q.moduleType === moduleType) &&
      (!difficulty || q.difficulty === difficulty)
  );
}

/**
 * Đếm câu seed theo skillId — cho dashboard "bank coverage" (bank có phủ
 * đều các skill Cambridge hay không). Trả Record<skillId, count>.
 */
export function seedBySkill(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of SEED) {
    counts[q.skillId] = (counts[q.skillId] ?? 0) + 1;
  }
  return counts;
}

/**
 * Chạy validateQuestion CHO MỖI câu seed, thu lọc câu fail. Đây là "test shape"
 * file seed: ok=true khi mọi câu pass (hoặc SEED rỗng). errors[] liệt kê
 * {id, reasons} cho câu lỗi — để dashboard/sẽ sửa lại trước khi issue ra user.
 *
 * validateQuestion kiểm LOGIC MCQ (choices ≥2, không trùng, correct_choice nằm
 * trong choices, choice_analysis đúng 1 is_correct + khớp letter, difficulty
 * hợp lệ) — json_schema strict chỉ đảm bảo CẤU TRÚC, không đảm bảo LOGIC.
 */
export function validateAllSeed(): {
  ok: boolean;
  errors: Array<{ id: string; reasons: string[] }>;
} {
  const errors: Array<{ id: string; reasons: string[] }> = [];
  for (const q of SEED) {
    const r = validateQuestion(q);
    if (!r.ok) {
      errors.push({ id: q.id, reasons: r.reasons });
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Tổng quan ngân hàng seed: total + phân bố theo module/difficulty + số câu
 * lỗi (invalidCount = errors.length của validateAllSeed). Cho dashboard admin
 * nhìn nhanh chất lượng bank.
 */
export function seedStats(): {
  total: number;
  byModule: Record<string, number>;
  byDifficulty: Record<string, number>;
  invalidCount: number;
} {
  const byModule: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  for (const q of SEED) {
    byModule[q.moduleType] = (byModule[q.moduleType] ?? 0) + 1;
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1;
  }
  const { errors } = validateAllSeed();
  return {
    total: SEED.length,
    byModule,
    byDifficulty,
    invalidCount: errors.length,
  };
}
