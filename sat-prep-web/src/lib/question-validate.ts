/**
 * ============================================================================
 *  QUESTION VALIDATE (pure) — kiểm tính hợp lệ LOGIC của câu trắc nghiệm
 * ============================================================================
 *  json_schema strict của OpenAI đảm bảo CẤU TRÚC (đủ field, đúng kiểu) nhưng
 *  KHÔNG đảm bảo LOGIC: câu có thể có 2 đáp án đúng, correct_choice không nằm
 *  trong choices, hoặc choice_analysis lệch với correct_choice. Một câu lỗi lọt
 *  vào ngân hàng (MIN_POOL reuse) sẽ lan cho hàng trăm học sinh → ghi nhớ SAI
 *  (misconception entrenchment). Module này chặn TRƯỚC khi issue/saveToBank.
 *
 *  THUẦN (pure): chỉ nhận object câu hỏi, không I/O → unit-test được.
 * ============================================================================
 */

export interface ValidatableChoiceAnalysis {
  choice_letter?: string;
  is_correct?: boolean;
  analysis?: string;
}

export interface ValidatableQuestion {
  practice_question?: unknown;
  choices?: unknown;
  correct_choice?: unknown;
  choice_analysis?: unknown;
  difficulty?: unknown;
}

export interface ValidationResult {
  ok: boolean;
  /** Lý do fail (rỗng nếu ok) — để log/thống kê chất lượng câu AI. */
  reasons: string[];
}

/** Chữ cái đầu của một lựa chọn ('A) foo' → 'A'). */
function leadingLetter(choice: string): string {
  return (choice ?? '').trim()[0]?.toUpperCase() ?? '';
}

/** Nội dung lựa chọn sau prefix 'A) ' / 'B. ' ('A) small' → 'small'). */
function choiceBody(choice: string): string {
  return (choice ?? '').trim().replace(/^[A-Da-d][).:\-]\s*/, '').trim();
}

/**
 * Kiểm 1 câu trắc nghiệm hợp lệ LOGIC:
 *  - practice_question không rỗng.
 *  - choices: đúng ≥2 (thường 4), không phần tử rỗng, không TRÙNG nội dung.
 *  - correct_choice: nằm TRONG choices.
 *  - choice_analysis (nếu có): số phần tử = số choices, ĐÚNG 1 phần tử is_correct=true,
 *    và letter của phần tử đúng khớp chữ cái đầu của correct_choice.
 *  - difficulty (nếu có): thuộc Easy/Medium/Hard.
 */
export function validateQuestion(q: ValidatableQuestion): ValidationResult {
  const reasons: string[] = [];

  const pq = typeof q.practice_question === 'string' ? q.practice_question.trim() : '';
  if (!pq) reasons.push('practice_question rỗng');

  const choices = Array.isArray(q.choices) ? (q.choices as unknown[]) : null;
  if (!choices || choices.length < 2) {
    reasons.push('choices phải có ≥2 lựa chọn');
    return { ok: false, reasons };
  }

  const choiceStrs = choices.map((c) => (typeof c === 'string' ? c.trim() : ''));
  const bodies = choiceStrs.map(choiceBody);
  if (bodies.some((b) => !b)) reasons.push('có lựa chọn rỗng');

  const normed = bodies.map((b) => b.toLowerCase());
  if (new Set(normed).size !== normed.length) reasons.push('có lựa chọn TRÙNG nội dung');

  const correct = typeof q.correct_choice === 'string' ? q.correct_choice.trim() : '';
  if (!correct) {
    reasons.push('correct_choice rỗng');
  } else if (!choiceStrs.includes(correct)) {
    reasons.push('correct_choice KHÔNG nằm trong choices');
  }

  if (q.choice_analysis !== undefined) {
    const ca = Array.isArray(q.choice_analysis) ? (q.choice_analysis as ValidatableChoiceAnalysis[]) : null;
    if (!ca) {
      reasons.push('choice_analysis không phải mảng');
    } else {
      if (ca.length !== choices.length) {
        reasons.push(`choice_analysis (${ca.length}) không phủ hết choices (${choices.length})`);
      }
      const corrects = ca.filter((c) => c?.is_correct === true);
      if (corrects.length !== 1) {
        reasons.push(`choice_analysis có ${corrects.length} phần tử is_correct (phải đúng 1)`);
      } else if (correct) {
        const wantLetter = leadingLetter(correct);
        const gotLetter = (corrects[0].choice_letter ?? '').trim()[0]?.toUpperCase() ?? '';
        if (wantLetter && gotLetter && wantLetter !== gotLetter) {
          reasons.push(`choice_analysis đúng (${gotLetter}) lệch correct_choice (${wantLetter})`);
        }
      }
    }
  }

  if (q.difficulty !== undefined) {
    const d = typeof q.difficulty === 'string' ? q.difficulty : '';
    if (!['Easy', 'Medium', 'Hard'].includes(d)) {
      reasons.push(`difficulty lạ: "${String(q.difficulty)}"`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}
