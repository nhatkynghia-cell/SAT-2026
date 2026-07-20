import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

/**
 * ============================================================================
 *  QUESTION BANK (Supabase) — tái sử dụng câu hỏi AI đã sinh (§9.4 / task 2.1)
 * ============================================================================
 *  Mỗi câu AI sinh ra được lưu vào ngân hàng DÙNG CHUNG (mọi user xài chung
 *  nội dung tĩnh). Route generate-practice ưu tiên lấy từ bank → cắt chi phí
 *  OpenAI. Đây cũng là nguồn dữ liệu cho Mastery, Adaptive, Boss=assessment.
 *
 *  📦 SỔ CÁI (2026-07-02, task 2.1): chuyển từ file `question_bank.json`
 *  (file-based → reset mỗi cold-start serverless → hit-rate ≈ 0% trên Vercel,
 *  pool KHÔNG BAO GIỜ đạt MIN_POOL) sang bảng Supabase `questions` (bền vững).
 *  Vì I/O giờ là async → `poolSize`/`getFromBank` thành ASYNC (saveToBank vốn
 *  đã async). Route chỉ cần thêm `await`.
 *
 *  ⚠️ GIỐNG ai_chat_cache/ai_cost_ledger: bảng DÙNG CHUNG toàn hệ thống (nội
 *  dung tĩnh phục vụ mọi học sinh) → RLS `authenticated using(true)`, KHÔNG
 *  scope user_id. Chỉ chứa câu hỏi Cambridge, KHÔNG có PII. Xem `questions.sql`.
 *
 *  🔓 FAIL-SAFE (memory 2026-07-02): bảng CHƯA tồn tại (pre-migration) / lỗi đọc
 *  → poolSize=0 + getFromBank=null → route tự sinh câu qua AI (ĐÚNG hành vi
 *  hiện tại trên Vercel khi file reset). saveToBank lỗi → no-op, KHÔNG vỡ luồng.
 *  Sau khi user chạy SQL → bank bắt đầu tích lũy & tái dùng thật.
 *
 *  🏁 Dedup theo hash nội dung (id = PK) → upsert onConflict tự xử lý race,
 *  KHÔNG cần khóa file như bản cũ.
 * ============================================================================
 */

/** Số câu tối thiểu cho mỗi moduleType trước khi bắt đầu tái sử dụng. */
export const MIN_POOL = 8;

export interface BankEntry {
  id: string;          // hash nội dung (dùng để dedup)
  moduleType: string;
  topic: string;
  data: unknown;       // object câu hỏi y như client cần (giữ nguyên hợp đồng)
  createdAt: string;
  usageCount: number;
}

/** Hash định danh 1 câu hỏi theo module + nội dung (để dedup). */
function entryId(moduleType: string, data: unknown): string {
  const d = data as Record<string, unknown>;
  const core = `${moduleType}::${d?.practice_question ?? ''}::${d?.full_passage ?? ''}`;
  return crypto.createHash('sha256').update(core, 'utf-8').digest('hex').slice(0, 16);
}

/**
 * Số câu hiện có cho 1 moduleType (dùng để quyết định reuse hay sinh mới).
 * FAIL-SAFE: bảng chưa có / lỗi → 0 → route sinh câu qua AI.
 */
export async function poolSize(moduleType: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('module_type', moduleType);
    if (error || count == null) return 0;
    return count;
  } catch (e) {
    console.error('Lỗi đếm question bank:', e);
    return 0;
  }
}

/**
 * Lấy ngẫu nhiên 1 câu từ bank khớp moduleType (ưu tiên đúng topic nếu có).
 * Trả về `data` của câu đó, hoặc null nếu không có câu nào khớp.
 *
 * `difficulty` (tùy chọn): chỉ lấy câu đúng mức độ (Easy/Medium/Hard) — phục vụ
 * adaptive (Tower/Gate). Khi không truyền → lấy bất kỳ mức nào (hành vi cũ).
 *
 * Chiến lược pick: nạp mọi câu khớp (module + difficulty) rồi chọn ngẫu nhiên
 * trong bộ nhớ — giữ NGUYÊN logic ưu-tiên-topic của bản file, KHÔNG cần thêm DB
 * function `order by random()` vào schema PRODUCTION.
 * FAIL-SAFE: bảng chưa có / lỗi / rỗng → null → route sinh câu qua AI.
 */
export async function getFromBank(
  moduleType: string,
  topic?: string,
  difficulty?: string
): Promise<unknown | null> {
  try {
    const supabase = await createClient();
    let query = supabase.from('questions').select('topic, data').eq('module_type', moduleType);
    if (difficulty) query = query.eq('difficulty', difficulty);
    const { data: rows, error } = await query;
    if (error || !rows || rows.length === 0) return null;

    const matchTopic = topic ? rows.filter((r) => r.topic === topic) : [];
    const pool = matchTopic.length > 0 ? matchTopic : rows;

    const pick = pool[Math.floor(Math.random() * pool.length)];
    return pick.data;
  } catch (e) {
    console.error('Lỗi đọc question bank:', e);
    return null;
  }
}

/**
 * Lưu 1 câu AI mới sinh vào bank (dedup theo hash nội dung = PK).
 * Trả về true nếu ghi không lỗi, false nếu lỗi (bảng chưa có → false, KHÔNG vỡ).
 * Route gọi fire-and-forget nên giá trị trả về chỉ mang tính thông báo.
 */
export async function saveToBank(moduleType: string, topic: string, data: unknown): Promise<boolean> {
  try {
    const id = entryId(moduleType, data);
    const difficulty = (data as Record<string, unknown>)?.difficulty ?? null;
    const supabase = await createClient();
    const { error } = await supabase
      .from('questions')
      .upsert(
        {
          id,
          module_type: moduleType,
          topic,
          difficulty,
          data,
          usage_count: 0,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    if (error) {
      console.error('Lỗi lưu vào question bank:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Lỗi lưu vào question bank:', e);
    return false;
  }
}
