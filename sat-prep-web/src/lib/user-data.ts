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
 *  ⚠️ CÒN LẠI DUY NHẤT `getUserDataPath` — đường FALLBACK FILE của save/load-data
 *  (task 4.1) khi bảng Supabase `user_progress` chưa có hoặc user không phải uuid.
 *  Mọi store khác đã lên Supabase (Nhóm 1 + 5.1/2.1/4.1) → các hàm cũ
 *  `getSharedDataPath`/`readUserJson`/`writeUserJson` + `mutex.ts` đã XÓA (dead).
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
