import diagnosticData from '@/data/diagnostic_questions.json';

/**
 * ============================================================================
 *  DIAGNOSTIC ONBOARDING — bài test xếp lớp đầu vào (implementation_plan §10.A.2/§10.A.5)
 * ============================================================================
 *  User mới có mastery rỗng → Score Prediction luôn 400/low, Skill Tree toàn
 *  locked ở score 0. Diagnostic gieo mastery ban đầu: 1 bộ câu tĩnh phủ 4 domain
 *  Toán + Reading, MỖI câu gắn sẵn `skillId` cụ thể.
 *
 *  🔑 Vì mỗi câu có skillId, khi client nộp qua CorePracticeUI → /api/grade sẽ
 *  gọi recordAnswer → mastery được bơm ĐÚNG skill (server-authoritative, §9.1).
 *  KHÔNG cần logic chấm/ghi mastery riêng — tái dụng nguyên đường /api/grade.
 *
 *  Đề là DỮ LIỆU TĨNH bundle lúc build (serverless-safe) → server LUÔN biết đáp
 *  án. Module THUẦN, mirror exams.ts:
 *    • getDiagnosticQuestions() — bộ câu đầy đủ (CÓ đáp án), CHỈ dùng nội bộ
 *      server để issueQuestion (lưu correct_choice + choice_analysis).
 *    • stripQuestion() — bỏ đáp án trước khi gửi client (choice_analysis quay
 *      lại sau khi nộp qua /api/grade → revealedAnalysis, như đường luyện tập).
 * ============================================================================
 */

export interface DiagnosticChoiceAnalysis {
  choice_letter: string;
  is_correct: boolean;
  analysis: string;
}

export interface DiagnosticQuestion {
  id: string;
  skillId: string;
  difficulty: string;
  title: string;
  full_passage?: string;
  practice_question: string;
  choices: string[];
  correct_choice: string;
  explanation: string;
  trapRate: number;
  choice_analysis: DiagnosticChoiceAnalysis[];
}

/** Câu đã GIẤU đáp án — dạng an toàn để gửi xuống client. */
export type PublicDiagnosticQuestion = Omit<
  DiagnosticQuestion,
  'correct_choice' | 'explanation' | 'choice_analysis'
>;

const QUESTIONS: DiagnosticQuestion[] = diagnosticData as DiagnosticQuestion[];

/** Bộ câu đầy đủ (CÓ đáp án) — CHỈ dùng nội bộ server để issueQuestion. */
export function getDiagnosticQuestions(): DiagnosticQuestion[] {
  return QUESTIONS;
}

/** Bỏ correct_choice + explanation + choice_analysis (không lộ đáp án trước khi nộp). */
export function stripQuestion(q: DiagnosticQuestion): PublicDiagnosticQuestion {
  const { correct_choice: _c, explanation: _e, choice_analysis: _ca, ...safe } = q;
  return safe;
}
