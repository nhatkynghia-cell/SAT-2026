import fs from 'fs';
import path from 'path';
import { USER_ID_PATTERN } from './auth';

/**
 * ============================================================================
 *  USER-SCOPED DATA PATHS (implementation_plan.md §9.3, task #1)
 * ============================================================================
 *  Mọi dữ liệu RIÊNG của người dùng được tách vào thư mục theo user_id:
 *      data/users/<user_id>/<file>.json
 *
 *  Dữ liệu DÙNG CHUNG (nội dung tĩnh: ngân hàng câu hỏi, danh mục đề thi)
 *  KHÔNG scope theo user — xem getSharedDataPath().
 *
 *  Khi chuyển sang Supabase/Postgres (task #4, #9), chỉ thay tầng đọc/ghi này;
 *  chữ ký hàm (theo user_id) giữ nguyên nên route không phải sửa.
 * ============================================================================
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');

/** Các file dữ liệu riêng của từng người dùng. */
export type UserDataFile =
  | 'streak_data.json'
  | 'vocab_srs.json'
  | 'cau_sai.json'
  | 'ai_usage.json'
  | 'mastery.json'
  | 'goals.json'
  | 'economy.json';

/**
 * Trả về đường dẫn tuyệt đối tới file dữ liệu của một user, đã tạo sẵn thư mục.
 *
 * 🛡️ Chống path traversal: userId phải khớp USER_ID_PATTERN (đã validate ở
 * lớp auth), và đường dẫn cuối cùng phải nằm TRONG USERS_DIR — nếu không sẽ ném lỗi.
 */
export function getUserDataPath(userId: string, file: UserDataFile): string {
  if (!USER_ID_PATTERN.test(userId)) {
    throw new Error(`user_id không hợp lệ: ${userId}`);
  }

  const userDir = path.join(USERS_DIR, userId);

  // Phòng tuyến 2: chặn mọi mưu đồ thoát khỏi thư mục users/.
  const resolved = path.resolve(userDir);
  if (resolved !== USERS_DIR && !resolved.startsWith(USERS_DIR + path.sep)) {
    throw new Error('Phát hiện path traversal khi phân giải thư mục người dùng.');
  }

  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  return path.join(userDir, file);
}

/** Đường dẫn tới dữ liệu dùng chung (không scope theo user). */
export function getSharedDataPath(file: string): string {
  return path.join(DATA_DIR, file);
}

/**
 * Đọc JSON của user; trả về BẢN SAO của `fallback` nếu file chưa tồn tại hoặc
 * hỏng định dạng. Phải clone vì caller (vd mastery.recordAnswer) có thể mutate
 * rồi ghi lại — nếu trả thẳng reference, một object hằng số dùng chung sẽ bị
 * nhiễm và lây dữ liệu sang user khác.
 */
export function readUserJson<T>(userId: string, file: UserDataFile, fallback: T): T {
  try {
    const p = getUserDataPath(userId, file);
    if (!fs.existsSync(p)) return structuredClone(fallback);
    const content = fs.readFileSync(p, 'utf-8');
    return content.trim() ? (JSON.parse(content) as T) : structuredClone(fallback);
  } catch (e) {
    console.error(`Lỗi đọc ${file} của user ${userId}:`, e);
    return structuredClone(fallback);
  }
}

/** Ghi JSON cho user (pretty-print). Ném lỗi để route quyết định cách phản hồi. */
export function writeUserJson(userId: string, file: UserDataFile, data: unknown): void {
  const p = getUserDataPath(userId, file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}
