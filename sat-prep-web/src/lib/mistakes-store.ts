import { createClient } from '@/lib/supabase/server';

/**
 * ============================================================================
 *  MISTAKES STORE (Supabase Postgres)
 * ============================================================================
 *  Quản lý sổ tay câu sai (user_mistakes) + SRS resurfacing Leitner
 *  (implementation_plan.md §10.A.4, task #13). Thay cho file cau_sai.json.
 * ============================================================================
 */

export interface MistakeEntry {
  id?: string; // UUID from DB
  passage?: string;
  question: string;
  choices: string[];
  correct_choice: string;
  user_choice: string;
  explanation?: string;
  source?: string;
  created_at?: string;
  // Trường SRS (Leitner):
  box?: number;
  next_review?: string;
  /**
   * skillId gắn với câu sai (Nhóm 7 #6, migration phase1_5_pvp_mistakes.sql).
   * Cho phép sinh câu BIẾN THỂ cùng skill khác số liệu để ôn. Nullable: câu sai
   * cũ (trước migration) để null → không có nút biến thể, vẫn ôn lối cũ.
   */
  skill_id?: string | null;
}

/** Lấy danh sách toàn bộ câu sai của user (mới nhất trước). */
export async function loadMistakes(userId: string): Promise<MistakeEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_mistakes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Lỗi tải danh sách câu sai:', error);
    return [];
  }

  return data as MistakeEntry[];
}

/** Thêm một câu trả lời sai vào sổ tay (kèm metadata SRS: box 1 + lịch ôn). */
export async function addMistake(
  userId: string,
  mistake: MistakeEntry,
  srs?: { box: number; next_review: string }
): Promise<MistakeEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_mistakes')
    .insert({
      user_id: userId,
      passage: mistake.passage || '',
      question: mistake.question,
      choices: mistake.choices,
      correct_choice: mistake.correct_choice,
      user_choice: mistake.user_choice,
      explanation: mistake.explanation || '',
      source: mistake.source || 'Luyện AI (Next.js)',
      box: srs?.box ?? 1,
      next_review: srs?.next_review ?? null,
      skill_id: mistake.skill_id ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Lỗi khi thêm câu sai:', error);
    return null;
  }
  return data as MistakeEntry;
}

/** Cập nhật trạng thái ôn tập SRS của 1 câu sai (box + lịch ôn kế). */
export async function updateMistakeReview(
  userId: string,
  mistakeId: string,
  box: number,
  next_review: string
): Promise<MistakeEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_mistakes')
    .update({ box, next_review })
    .match({ id: mistakeId, user_id: userId })
    .select()
    .single();

  if (error) {
    console.error('Lỗi khi cập nhật ôn tập câu sai:', error);
    return null;
  }
  return data as MistakeEntry;
}

/** Xóa một câu sai khỏi sổ tay (khi đã hiểu và làm lại đúng). */
export async function removeMistake(userId: string, mistakeId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_mistakes')
    .delete()
    .match({ id: mistakeId, user_id: userId });

  if (error) {
    console.error('Lỗi khi xóa câu sai:', error);
  }
}
