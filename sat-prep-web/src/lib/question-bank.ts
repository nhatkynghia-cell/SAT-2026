import crypto from 'crypto';
import fs from 'fs';
import { getSharedDataPath } from './user-data';
import { acquireLock } from '@/helpers/mutex';

/**
 * ============================================================================
 *  QUESTION BANK — tái sử dụng câu hỏi AI đã sinh (implementation_plan.md §9.4)
 * ============================================================================
 *  Mỗi câu AI sinh ra được lưu vào ngân hàng DÙNG CHUNG (mọi user xài chung
 *  nội dung tĩnh). Route generate-practice ưu tiên lấy từ bank → cắt chi phí
 *  OpenAI. Đây cũng là nguồn dữ liệu cho Mastery (task #9), Adaptive (task #12),
 *  Boss = assessment (task #19).
 *
 *  Lưu ý concurrency: bank là 1 file chia sẻ → mọi thao tác GHI phải qua khóa
 *  (acquireLock) để tránh nhiều request ghi đè nhau.
 *
 *  Khi lên Supabase/Postgres (Phase 2): thay tầng đọc/ghi file bằng bảng
 *  `questions`; chữ ký hàm giữ nguyên nên route không phải sửa.
 * ============================================================================
 */

const BANK_FILE = getSharedDataPath('question_bank.json');

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

interface BankFile {
  questions: BankEntry[];
}

function loadBank(): BankFile {
  try {
    if (!fs.existsSync(BANK_FILE)) return { questions: [] };
    const content = fs.readFileSync(BANK_FILE, 'utf-8');
    return content.trim() ? (JSON.parse(content) as BankFile) : { questions: [] };
  } catch (e) {
    console.error('Lỗi đọc question_bank.json:', e);
    return { questions: [] };
  }
}

/** Hash định danh 1 câu hỏi theo module + nội dung (để dedup). */
function entryId(moduleType: string, data: unknown): string {
  const d = data as Record<string, unknown>;
  const core = `${moduleType}::${d?.practice_question ?? ''}::${d?.full_passage ?? ''}`;
  return crypto.createHash('sha256').update(core, 'utf-8').digest('hex').slice(0, 16);
}

/** Số câu hiện có cho 1 moduleType (dùng để quyết định reuse hay sinh mới). */
export function poolSize(moduleType: string): number {
  return loadBank().questions.filter((q) => q.moduleType === moduleType).length;
}

/**
 * Lấy ngẫu nhiên 1 câu từ bank khớp moduleType (ưu tiên đúng topic nếu có).
 * Trả về `data` của câu đó, hoặc null nếu không có câu nào khớp.
 * (Không tăng usageCount ở đây để tránh ghi file mỗi lần đọc; usage tính ở route.)
 *
 * `difficulty` (tùy chọn): chỉ lấy câu đúng mức độ (Easy/Medium/Hard) — phục vụ
 * adaptive (Tower/Gate). Khi không truyền → lấy bất kỳ mức nào (hành vi cũ).
 * Nếu lọc theo difficulty mà không còn câu nào → trả null để route fallback sang AI.
 */
export function getFromBank(moduleType: string, topic?: string, difficulty?: string): unknown | null {
  let all = loadBank().questions.filter((q) => q.moduleType === moduleType);
  if (difficulty) {
    all = all.filter((q) => (q.data as Record<string, unknown>)?.difficulty === difficulty);
  }
  if (all.length === 0) return null;

  const matchTopic = topic ? all.filter((q) => q.topic === topic) : [];
  const pool = matchTopic.length > 0 ? matchTopic : all;

  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick.data;
}

/**
 * Lưu 1 câu AI mới sinh vào bank (dedup theo hash nội dung). An toàn concurrency
 * nhờ khóa file. Trả về true nếu thực sự thêm mới, false nếu đã tồn tại.
 */
export async function saveToBank(moduleType: string, topic: string, data: unknown): Promise<boolean> {
  const id = entryId(moduleType, data);
  let release;
  try {
    release = await acquireLock(BANK_FILE);
    const bank = loadBank();

    if (bank.questions.some((q) => q.id === id)) {
      return false; // đã có câu giống hệt
    }

    bank.questions.push({
      id,
      moduleType,
      topic,
      data,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    });

    fs.writeFileSync(BANK_FILE, JSON.stringify(bank, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Lỗi lưu vào question_bank.json:', e);
    return false;
  } finally {
    if (release) release();
  }
}
