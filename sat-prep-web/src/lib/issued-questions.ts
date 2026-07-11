import { createAdminClient } from '@/lib/supabase/admin';
import { matchesAnswer } from '@/lib/answer-match';

export interface ChoiceAnalysis {
  choice_letter: string;
  is_correct: boolean;
  analysis: string;
}

/**
 * Envelope lưu trong cột `context` (TEXT) của issued_questions dưới dạng JSON.
 * Chứa metadata KHÔNG được lộ cho client lúc phát câu:
 *   - src: nguồn câu (ai/bank/golden_hour) — chỉ để debug/thống kê.
 *   - ca:  choice_analysis đầy đủ (có is_correct = ĐÁP ÁN) → chỉ trả về SAU khi
 *          chấm (/api/grade) và cho hint (1 bẫy) qua /api/hint. KHÔNG nằm trong
 *          payload generate-practice nữa (ROOT A hardening 2026-07-04).
 */
interface IssuedContext {
  src?: string;
  ca?: ChoiceAnalysis[];
  /** Lời giải đầy đủ — chỉ trả về SAU khi chấm (/api/grade). Dùng cho câu có sẵn
   *  đáp án + lời giải tĩnh (vd đề thư viện) để render block "GIA SƯ AI PHÂN TÍCH". */
  exp?: string;
}

function encodeContext(ctx: IssuedContext): string | null {
  const clean: IssuedContext = {};
  if (ctx.src) clean.src = ctx.src;
  if (Array.isArray(ctx.ca) && ctx.ca.length > 0) clean.ca = ctx.ca;
  if (ctx.exp) clean.exp = ctx.exp;
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
}

function decodeContext(raw: string | null | undefined): IssuedContext {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return obj as IssuedContext;
  } catch {
    // Row cũ có thể lưu context dạng chuỗi thô (vd 'golden_hour') → coi như src.
    return { src: raw };
  }
  return {};
}

export async function issueQuestion(
  userId: string,
  correctChoice: string,
  skillId: string | undefined,
  difficulty: string | undefined,
  opts?: { src?: string; choiceAnalysis?: ChoiceAnalysis[]; explanation?: string }
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('issued_questions')
    .insert({
      user_id: userId,
      correct_choice: correctChoice,
      skill_id: skillId ?? null,
      difficulty: difficulty ?? 'Medium',
      context: encodeContext({ src: opts?.src, ca: opts?.choiceAnalysis, exp: opts?.explanation }),
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('issueQuestion error:', error?.message);
    return null;
  }
  return data.id;
}

export interface GradeResult {
  correct: boolean;
  correctChoice: string;
  skillId: string | null;
  difficulty: string;
  /** choice_analysis đầy đủ — chỉ trả về sau khi chấm (không lộ trước lúc nộp). */
  choiceAnalysis: ChoiceAnalysis[] | null;
  /** Lời giải đầy đủ — chỉ trả về sau khi chấm. null nếu câu không lưu lời giải. */
  explanation: string | null;
  /** Nguồn câu (ai/bank/diagnostic/golden_hour…). Route dùng để KHÔNG trao xu cho
   *  câu diagnostic (test xếp lớp — re-issue được nên nếu thưởng sẽ thành faucet). */
  src: string | null;
}

export async function gradeAnswer(
  questionId: string,
  userId: string,
  userAnswer: string
): Promise<GradeResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('issued_questions')
    .select('correct_choice, skill_id, difficulty, user_id, answered, context')
    .eq('id', questionId)
    .single();

  if (error || !data) return null;
  if (data.user_id !== userId) return null;
  if (data.answered) return null; // fast-fail cho replay hiển nhiên

  // 🔴 CRITICAL FIX (ROOT A): so khớp đáp án đúng cách — câu có nhãn "A)/B)" so
  // ký tự đầu, câu THÔ ("x = 2", "(1,0)", "49π") so toàn chuỗi. Trước đây chỉ so
  // [0] → mọi lựa chọn "x = 1/2/3/4" cùng 'x' → chọn sai vẫn chấm đúng (faucet xu
  // + mastery bẩn). Xem answer-match.ts.
  const correct = matchesAnswer(userAnswer, data.correct_choice);

  // 🔒 COMPARE-AND-SWAP (ROOT A): chỉ chấm-và-trao-thưởng khi CHÍNH request này
  // lật answered false→true. `.eq('answered', false)` khiến 2 request đua nhau
  // chỉ 1 cái update trúng dòng → cái kia nhận 0 row → return null. Đây là chốt
  // atomic đảm bảo phần thưởng (tính ở route dựa trên kết quả này) cộng ĐÚNG 1 LẦN.
  const { data: updated, error: updErr } = await admin
    .from('issued_questions')
    .update({ answered: true, was_correct: correct })
    .eq('id', questionId)
    .eq('answered', false)
    .select('id')
    .maybeSingle();

  if (updErr || !updated) return null; // thua race hoặc đã trả lời

  const ctx = decodeContext(data.context);
  return {
    correct,
    correctChoice: data.correct_choice,
    skillId: data.skill_id,
    difficulty: data.difficulty ?? 'Medium',
    choiceAnalysis: ctx.ca ?? null,
    explanation: ctx.exp ?? null,
    src: ctx.src ?? null,
  };
}

/**
 * Đọc KẾT QUẢ ĐÃ CHẤM của 1 câu đã trả lời (was_correct đã lưu lúc gradeAnswer
 * lật answered). Dùng cho NỘP LẠI idempotent: khi client retry cùng bộ answers,
 * gradeAnswer trả null (đã answered) → route lấy điểm đã lưu để đếm ĐÚNG số câu
 * đúng (không mất điểm), NHƯNG không đưa vào đường thưởng (tránh double-grant).
 * Trả null nếu câu không tồn tại / không sở hữu / CHƯA chấm.
 */
export async function getGradedResult(
  questionId: string,
  userId: string
): Promise<{ correct: boolean } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('issued_questions')
    .select('user_id, answered, was_correct')
    .eq('id', questionId)
    .single();

  if (error || !data) return null;
  if (data.user_id !== userId) return null;
  if (!data.answered) return null; // chưa chấm → không có điểm đã lưu
  return { correct: !!data.was_correct };
}

/**
 * Lấy 1 GỢI Ý LOẠI TRỪ (hint cấp 2): trả về MỘT đáp án SAI + phân tích bẫy của
 * nó, KHÔNG lộ đáp án đúng. Verify quyền sở hữu; câu chưa nộp mới cho hint.
 * Không có choice_analysis (golden_hour / bank cũ) → null → client fallback text.
 */
export async function getHintTrap(
  questionId: string,
  userId: string
): Promise<{ choice_letter: string; analysis: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('issued_questions')
    .select('user_id, answered, context')
    .eq('id', questionId)
    .single();

  if (error || !data) return null;
  if (data.user_id !== userId) return null;
  if (data.answered) return null; // đã nộp thì không cần hint

  const ca = decodeContext(data.context).ca;
  const trap = ca?.find((c) => !c.is_correct);
  if (!trap) return null;
  return { choice_letter: trap.choice_letter, analysis: trap.analysis };
}
