import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * ============================================================================
 *  USER PROGRESS STORE (Supabase) — streak/inventory/quests (§4.1 / task 4.1)
 * ============================================================================
 *  Sổ tiến trình "nền" của mỗi user: streak, shield, inventory, quests,
 *  practice-history, pet... — TẤT CẢ số liệu KHÔNG-đổi-ra-tiền-thật (coins/xp/
 *  level đã chuyển sang server-authoritative `/api/economy` + `/api/skill-tree`
 *  từ T7). Thay cho file `data/users/<id>/streak_data.json` (fs → reset mỗi
 *  cold-start serverless → mất streak/inventory sau mỗi deploy trên Vercel).
 *
 *  🔐 HMAC GIỮ NGUYÊN BYTE-CHO-BYTE: route save-data KÝ blob (HMAC-SHA256) rồi
 *  đưa NGUYÊN CHUỖI JSON đã ký xuống đây; load-data đọc lại CHUỖI ĐÓ rồi verify.
 *  ⚠️ VÌ SAO cột `text` chứ KHÔNG `jsonb`: jsonb chuẩn hóa lại số/thứ tự key →
 *  chuỗi đọc ra KHÁC chuỗi đã ký → HMAC lệch → bị coi là "gian lận" → XÓA sạch
 *  tiến trình mỗi lần reload. Lưu raw string → store chỉ là I/O thuần, HMAC ở
 *  route KHÔNG đổi 1 dòng.
 *
 *  🔓 FAIL-SAFE (memory 2026-07-02, task rủi ro CAO nên bảo thủ): bảng CHƯA có /
 *  user KHÔNG phải uuid (local-default-user) / lỗi → trả null (load) hoặc false
 *  (save) → route FALLBACK về đọc/ghi FILE như cũ → 0 regression pre-migration.
 *  Sau khi user chạy `user_progress.sql` → tiến trình bền vững qua deploy.
 *
 *  Đây là bảng THEO USER (khác questions/ai_chat_cache/ai_cost_ledger dùng
 *  chung) → RLS `auth.uid()=user_id` giống 4 bảng user_* của Nhóm 1.
 * ============================================================================
 */

/**
 * Đọc CHUỖI JSON tiến trình đã ký của user. null nếu chưa có / lỗi / bảng
 * chưa tồn tại → caller fallback về file.
 */
export async function loadProgressRaw(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_progress')
      .select('data_json')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return typeof data.data_json === 'string' ? data.data_json : null;
  } catch (e) {
    console.error('Lỗi đọc user_progress:', e);
    return null;
  }
}

/**
 * Ghi CHUỖI JSON tiến trình đã ký (upsert theo user_id). Trả về true nếu ghi
 * không lỗi; false nếu lỗi / bảng chưa có → caller fallback về ghi file.
 */
export async function saveProgressRaw(userId: string, dataJson: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('user_progress')
      .upsert({ user_id: userId, data_json: dataJson, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) {
      console.error('Lỗi ghi user_progress:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Lỗi ghi user_progress:', e);
    return false;
  }
}
