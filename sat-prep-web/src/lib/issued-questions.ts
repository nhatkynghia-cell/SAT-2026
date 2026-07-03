import { createAdminClient } from '@/lib/supabase/admin';

export async function issueQuestion(
  userId: string,
  correctChoice: string,
  skillId: string | undefined,
  difficulty: string | undefined,
  context?: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('issued_questions')
    .insert({
      user_id: userId,
      correct_choice: correctChoice,
      skill_id: skillId ?? null,
      difficulty: difficulty ?? 'Medium',
      context: context ?? null,
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
}

export async function gradeAnswer(
  questionId: string,
  userId: string,
  userAnswer: string
): Promise<GradeResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('issued_questions')
    .select('correct_choice, skill_id, difficulty, user_id, answered')
    .eq('id', questionId)
    .single();

  if (error || !data) return null;
  if (data.user_id !== userId) return null;
  if (data.answered) return null; // fast-fail cho replay hiển nhiên

  const correct = userAnswer.trim()[0]?.toUpperCase() === data.correct_choice.trim()[0]?.toUpperCase();

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

  return {
    correct,
    correctChoice: data.correct_choice,
    skillId: data.skill_id,
    difficulty: data.difficulty ?? 'Medium',
  };
}
