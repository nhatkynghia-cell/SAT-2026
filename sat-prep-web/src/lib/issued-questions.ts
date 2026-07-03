import { createAdminClient } from '@/lib/supabase/admin';

export async function issueQuestion(
  userId: string,
  correctChoice: string,
  skillId: string | undefined,
  difficulty: string | undefined
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('issued_questions')
    .insert({
      user_id: userId,
      correct_choice: correctChoice,
      skill_id: skillId ?? null,
      difficulty: difficulty ?? 'Medium',
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
  if (data.answered) return null;

  await admin
    .from('issued_questions')
    .update({ answered: true })
    .eq('id', questionId);

  const correct = userAnswer.trim()[0]?.toUpperCase() === data.correct_choice.trim()[0]?.toUpperCase();

  return {
    correct,
    correctChoice: data.correct_choice,
    skillId: data.skill_id,
    difficulty: data.difficulty ?? 'Medium',
  };
}
