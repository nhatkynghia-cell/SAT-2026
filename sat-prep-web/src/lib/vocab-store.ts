import { createClient } from '@/lib/supabase/server';

/**
 * ============================================================================
 *  VOCAB SRS STORE (Supabase Postgres) — Phase 1.5 / Nhóm 1.1
 * ============================================================================
 *  Đọc/ghi danh sách từ vựng Leitner của user từ bảng `user_vocab_srs`. Thay
 *  cho file `vocab_srs.json`. Bảo mật RLS (auth.uid()=user_id).
 * ============================================================================
 */

export interface VocabWord {
  id: string;
  box: number;
  next_review: string;
  [key: string]: unknown;
}

export interface VocabData {
  words: VocabWord[];
}

export async function loadVocab(userId: string): Promise<VocabData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_vocab_srs')
    .select('words')
    .eq('user_id', userId)
    .single();

  if (error || !data) return { words: [] };
  return { words: Array.isArray(data.words) ? data.words : [] };
}

export async function saveVocab(userId: string, data: VocabData): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_vocab_srs')
    .upsert(
      { user_id: userId, words: data.words, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) console.error('Lỗi khi lưu vocab lên Supabase:', error);
}
