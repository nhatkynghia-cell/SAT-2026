import mockExams from '@/data/mock_exams.json';

/**
 * ============================================================================
 *  EXAMS (server-authoritative grading) — ROOT A follow-up (đường THI)
 * ============================================================================
 *  Trước đây `/api/exams` ship NGUYÊN đáp án (correct_choice) + lời giải xuống
 *  client, rồi trang mock/real tự chấm client-side và POST `correctCount` lên
 *  `/api/economy {action:'exam'}` → faucet xu (client gửi count/độ khó tùy ý).
 *
 *  Đề thi là DỮ LIỆU TĨNH nằm SẴN ở server (mock_exams.json) → server LUÔN biết
 *  đáp án đúng của mọi câu. Vì vậy KHÔNG cần issued_questions per-câu như ROOT A
 *  (câu luyện tập là AI sinh, phù du); server chấm THẲNG với bản của chính nó.
 *
 *  Module này là NGUỒN SỰ THẬT về đề + đáp án ở server:
 *    • listExamsPublic() — danh sách đề đã GIẤU đáp án (client chỉ nhận cái này).
 *    • getExamById()     — đề đầy đủ (đáp án) CHỈ dùng nội bộ server để chấm.
 *  Thuần (pure) — không I/O động, JSON bundle lúc build (serverless-safe).
 * ============================================================================
 */

export interface ExamQuestion {
  id: string;
  full_passage?: string;
  practice_question: string;
  choices: string[];
  correct_choice: string;
  explanation: string;
  difficulty: string;
  trapRate?: number;
}

export interface ExamModule {
  module_id?: string;
  name: string;
  time_minutes: number;
  questions: ExamQuestion[];
}

export interface FullExam {
  id: string;
  title: string;
  description: string;
  total_time_minutes: number;
  modules: ExamModule[];
}

/** Câu hỏi đã GIẤU đáp án — dạng an toàn để gửi xuống client. */
export type PublicExamQuestion = Omit<ExamQuestion, 'correct_choice' | 'explanation'>;
export interface PublicExamModule extends Omit<ExamModule, 'questions'> {
  questions: PublicExamQuestion[];
}
export interface PublicExam extends Omit<FullExam, 'modules'> {
  modules: PublicExamModule[];
}

const EXAMS: FullExam[] = (mockExams as { exams: FullExam[] }).exams ?? [];

/** Bỏ correct_choice + explanation khỏi 1 câu (không lộ đáp án trước khi nộp). */
function stripQuestion(q: ExamQuestion): PublicExamQuestion {
  const { correct_choice: _c, explanation: _e, ...safe } = q;
  return safe;
}

/** Danh sách đề đã GIẤU đáp án — client chỉ được nhận cái này. */
export function listExamsPublic(): PublicExam[] {
  return EXAMS.map((exam) => ({
    ...exam,
    modules: exam.modules.map((mod) => ({
      ...mod,
      questions: mod.questions.map(stripQuestion),
    })),
  }));
}

/** Đề đầy đủ (CÓ đáp án) — CHỈ dùng nội bộ server để chấm. */
export function getExamById(examId: string): FullExam | null {
  return EXAMS.find((e) => e.id === examId) ?? null;
}

/** Gộp mọi câu của 1 đề thành map id → câu (để tra đáp án khi chấm). */
export function getExamQuestionMap(exam: FullExam): Map<string, ExamQuestion> {
  const map = new Map<string, ExamQuestion>();
  for (const mod of exam.modules) {
    for (const q of mod.questions) map.set(q.id, q);
  }
  return map;
}

/** Chấm 1 đáp án client gửi so với đáp án đúng lưu server (so ký tự đầu: "B) ..."). */
export function isChoiceCorrect(userAnswer: string, correctChoice: string): boolean {
  const u = userAnswer?.trim()?.[0]?.toUpperCase();
  const c = correctChoice?.trim()?.[0]?.toUpperCase();
  return !!u && !!c && u === c;
}
