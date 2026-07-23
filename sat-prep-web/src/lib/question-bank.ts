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
 *  scope user_id. Chỉ chứa câu hỏi SAT, KHÔNG có PII. Xem `questions.sql`.
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

const VALID_DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);

/**
 * Validator câu AI TRƯỚC khi lưu vào bank chung (Content Quality — roadmap pre-deploy).
 * PURE (không I/O), unit-test được. Chặn câu lỗi/kém chuẩn lọt vào nguồn dùng chung
 * cho mọi user, tránh độc hại học (đáp án sai, choices lệch, analysis sai is_correct).
 *
 * Quy tắc:
 *  - choices là mảng >=4 chuỗi không rỗng.
 *  - correct_choice là chuỗi KHÔNG rỗng VÀ phải khớp 1 phần tử trong choices
 *    (so bằng — câu thô vd "x = 2"; không khớp ký tự đầu để tránh multiple match).
 *  - difficulty trong Easy/Medium/Hard.
 *  - trapRate là số 0..100 (nếu có).
 *  - choice_analysis (nếu có): mảng đúng số lượng choices, đúng 1 phần tử is_correct=true,
 *    choice_letter khớp nhãn A/B/C/D theo index.
 *
 * Trả về true nếu hợp lệ; false + lý do (log) nếu lệch. Route gọi fire-and-forget,
 * câu fail validation sẽ KHÔNG vào bank (chỉ phục vụ phiên hiện tại).
 */
export function validateBankEntry(data: unknown): { ok: boolean; reason?: string } {
  const d = data as Record<string, unknown>;
  if (!d || typeof d !== 'object') return { ok: false, reason: 'data không phải object' };

  const choices = d.choices;
  if (!Array.isArray(choices) || choices.length < 4) {
    return { ok: false, reason: 'choices phải có ít nhất 4 phần tử' };
  }
  if (!choices.every((c) => typeof c === 'string' && c.trim().length > 0)) {
    return { ok: false, reason: 'choices chứa phần tử rỗng/không phải chuỗi' };
  }

  const correct = d.correct_choice;
  if (typeof correct !== 'string' || correct.trim().length === 0) {
    return { ok: false, reason: 'correct_choice rỗng/không phải chuỗi' };
  }
  const matches = choices.filter((c) => c === correct);
  if (matches.length !== 1) {
    return { ok: false, reason: `correct_choice phải khớp đúng 1 choice (khớp ${matches.length})` };
  }

  const difficulty = d.difficulty;
  if (typeof difficulty !== 'string' || !VALID_DIFFICULTIES.has(difficulty)) {
    return { ok: false, reason: `difficulty không hợp lệ: ${String(difficulty)}` };
  }

  if (d.trapRate != null) {
    const t = d.trapRate;
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > 100) {
      return { ok: false, reason: `trapRate không hợp lệ: ${String(t)}` };
    }
  }

  const analysis = d.choice_analysis;
  if (analysis !== undefined && analysis !== null) {
    if (!Array.isArray(analysis)) {
      return { ok: false, reason: 'choice_analysis phải là mảng' };
    }
    if (analysis.length !== choices.length) {
      return { ok: false, reason: `choice_analysis lệch số lượng (${analysis.length} vs ${choices.length})` };
    }
    let correctCount = 0;
    for (let i = 0; i < analysis.length; i++) {
      const a = analysis[i] as Record<string, unknown>;
      if (!a || typeof a !== 'object') return { ok: false, reason: `choice_analysis[${i}] không hợp lệ` };
      if (typeof a.is_correct !== 'boolean') return { ok: false, reason: `choice_analysis[${i}].is_correct không phải boolean` };
      if (a.is_correct) correctCount++;
      const expectedLetter = String.fromCharCode(65 + i);
      if (typeof a.choice_letter !== 'string' || a.choice_letter.trim().toUpperCase() !== expectedLetter) {
        return { ok: false, reason: `choice_analysis[${i}].choice_letter phải là "${expectedLetter}"` };
      }
    }
    if (correctCount !== 1) {
      return { ok: false, reason: `choice_analysis phải có đúng 1 is_correct=true (có ${correctCount})` };
    }
  }

  return { ok: true };
}

/** 1 dòng chuẩn hóa để upsert vào bảng `questions`. */
export interface BankRow {
  id: string;
  module_type: string;
  topic: string;
  difficulty: string | null;
  skill_id: string | null;
  data: unknown;
  usage_count: number;
}

/**
 * Dựng 1 dòng bank CHUẨN HÓA từ câu AI mới sinh — PURE (không I/O), test được.
 *
 * Chuẩn hóa schema (Bước 0 — nền cho curation kho đề):
 *  • skillId nhúng THẲNG vào `data.skillId` (giữ trong payload jsonb) VÀ tách ra
 *    cột `skill_id` (để index + đếm phân bố theo skill lúc lọc/tuyển). Không ghi
 *    đè nếu skillId không xác định (giữ giá trị sẵn trong data nếu có).
 *  • difficulty đọc từ data (Easy/Medium/Hard), null nếu thiếu.
 *  • id = hash nội dung (dedup qua PK).
 */
export function buildBankRow(
  moduleType: string,
  topic: string,
  data: unknown,
  skillId?: string
): BankRow {
  const d = (data ?? {}) as Record<string, unknown>;
  // Ưu tiên skillId truyền vào (đã qua taxonomy ở route); nếu không có thì giữ
  // giá trị đã nhúng sẵn trong data (nếu có) — không xoá dữ liệu đang có.
  const effectiveSkillId =
    (typeof skillId === 'string' && skillId) ||
    (typeof d.skillId === 'string' && d.skillId) ||
    null;
  const difficulty = typeof d.difficulty === 'string' ? d.difficulty : null;
  // data mang luôn skillId để câu tái dùng từ bank có sẵn skillId trong payload
  // (client cần để POST /api/mastery, y hợp đồng câu sinh mới).
  const normalizedData = effectiveSkillId ? { ...d, skillId: effectiveSkillId } : d;
  return {
    id: entryId(moduleType, data),
    module_type: moduleType,
    topic,
    difficulty,
    skill_id: effectiveSkillId,
    data: normalizedData,
    usage_count: 0,
  };
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
 *
 * ĐO LƯỜNG: mỗi lần bốc trúng 1 câu → tăng usage_count qua RPC atomic
 * (fire-and-forget, non-critical: lỗi/RPC chưa có → chỉ mất 1 nhịp đếm, KHÔNG
 * ảnh hưởng câu trả về). Tín hiệu tái-dùng phục vụ curation (Bước 0).
 */
export async function getFromBank(
  moduleType: string,
  topic?: string,
  difficulty?: string
): Promise<unknown | null> {
  try {
    const supabase = await createClient();
    let query = supabase.from('questions').select('id, topic, data').eq('module_type', moduleType);
    if (difficulty) query = query.eq('difficulty', difficulty);
    const { data: rows, error } = await query;
    if (error || !rows || rows.length === 0) return null;

    const matchTopic = topic ? rows.filter((r) => r.topic === topic) : [];
    const pool = matchTopic.length > 0 ? matchTopic : rows;

    const pick = pool[Math.floor(Math.random() * pool.length)];
    // Đếm tái dùng (fire-and-forget, atomic qua RPC). Không await → không chặn
    // đường trả câu; nuốt lỗi để RPC-chưa-migrate / lỗi DB không vỡ luồng.
    if (pick.id) {
      supabase
        .rpc('increment_question_usage', { p_id: pick.id })
        .then(({ error: rpcErr }) => {
          if (rpcErr) console.error('increment_question_usage:', rpcErr.message);
        });
    }
    return pick.data;
  } catch (e) {
    console.error('Lỗi đọc question bank:', e);
    return null;
  }
}

/**
 * Lưu 1 câu AI mới sinh vào bank (dedup theo hash nội dung = PK).
 * `skillId` (tùy chọn): skillId taxonomy đã tính ở route → persist vào cột
 * `skill_id` + nhúng `data.skillId` (chuẩn hóa schema cho curation, Bước 0).
 * Trả về true nếu ghi không lỗi, false nếu lỗi (bảng chưa có → false, KHÔNG vỡ).
 * Route gọi fire-and-forget nên giá trị trả về chỉ mang tính thông báo.
 */
export async function saveToBank(
  moduleType: string,
  topic: string,
  data: unknown,
  skillId?: string
): Promise<boolean> {
  try {
    const validation = validateBankEntry(data);
    if (!validation.ok) {
      // Chặn câu lỗi/kém chuẩn vào bank chung (lộ đáp án sai / analysis lệch). Vẫn
      // trả về false (route fire-and-forget) — câu hiện tại đã trả cho user phiên này.
      console.warn('saveToBank: câu fail validation, bỏ qua —', validation.reason);
      return false;
    }
    const row = buildBankRow(moduleType, topic, data, skillId);
    const supabase = await createClient();
    const { error } = await supabase
      .from('questions')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true });
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
