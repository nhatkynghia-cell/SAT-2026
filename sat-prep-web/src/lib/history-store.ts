import { createClient } from '@/lib/supabase/server';

/**
 * ============================================================================
 *  HISTORY STORE (Supabase Postgres)
 * ============================================================================
 *  Quản lý lịch sử thi (test_history).
 * ============================================================================
 */

export interface TestHistoryEntry {
  id?: string;
  module: string;
  subject: string;
  correct: number;
  total: number;
  score: number;
  test_timestamp: number;
  created_at?: string;
}

/**
 * Lấy lịch sử thi của user
 */
export async function loadTestHistory(userId: string): Promise<TestHistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('test_history')
    .select('*')
    .eq('user_id', userId)
    .order('test_timestamp', { ascending: false });

  if (error) {
    console.error('Lỗi tải lịch sử thi:', error);
    return [];
  }

  return data as TestHistoryEntry[];
}

/**
 * Lưu kết quả thi vào bảng lịch sử
 */
export async function addTestHistory(userId: string, entry: TestHistoryEntry): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('test_history')
    .insert({
      user_id: userId,
      module: entry.module,
      subject: entry.subject,
      correct: entry.correct,
      total: entry.total,
      score: entry.score,
      test_timestamp: entry.test_timestamp || (Date.now() / 1000), // Tính bằng Unix seconds như bản cũ
    });

  if (error) {
    console.error('Lỗi khi lưu lịch sử thi:', error);
  }
}
