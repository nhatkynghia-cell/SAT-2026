import { createClient } from '@/lib/supabase/server';
import { SEED_MARKER_ID } from '@/lib/vocab-seed';

/**
 * ============================================================================
 *  VOCAB SRS STORE (Supabase Postgres) — Phase 1.5 / Nhóm 1.1
 * ============================================================================
 *  Đọc/ghi danh sách từ vựng Leitner của user từ bảng `user_vocab_srs`. Thay
 *  cho file `vocab_srs.json`. Bảo mật RLS (auth.uid()=user_id).
 *
 *  Phase 1 — vocab seed Cambridge KET/PET: field vocab (word/meaning_vi/...)
 *  đưa thành optional chính thức nhưng GIỮ [key:string]:unknown để tương thích
 *  dữ liệu SAT cũ + sentinel marker __seed_version__.
 * ============================================================================
 */

export interface VocabWord {
  id: string;
  box: number;
  next_review: string;
  // Phase 1 — vocab seed KET/PET (optional: dữ liệu SAT cũ chỉ có id/box/next_review).
  word?: string;
  pos?: string;
  ipa?: string;
  meaning_vi?: string;
  meaning_en?: string;
  example?: string;
  cefr?: 'A2' | 'B1';
  exam?: 'KET' | 'PET';
  topic?: string;
  audio_url?: string;
  [key: string]: unknown;
}

export interface VocabData {
  words: VocabWord[];
}

/**
 * Có sentinel seed không — chống seed lại 2 lần (double-seed). Marker
 * {id:'__seed_version__'} được chèn đầu words[] lúc lazy-seed (GET /api/vocab).
 * KHÔNG dựa vào words.length (phân biệt "chưa seed" vs "user xoá hết").
 */
export function hasSeedMarker(words: VocabWord[]): boolean {
  return Array.isArray(words) && words.some((w) => w?.id === SEED_MARKER_ID);
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
