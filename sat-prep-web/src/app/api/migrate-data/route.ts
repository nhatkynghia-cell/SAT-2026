import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import fs from 'fs';
import path from 'path';

/**
 * ============================================================================
 *  MIGRATION API (Chỉ chạy 1 lần) — LEGACY, MẶC ĐỊNH TẮT
 * ============================================================================
 *  Đọc các file JSON cục bộ từ ứng dụng Streamlit cũ và "bơm" lên Supabase cho
 *  tài khoản hiện tại. Công cụ migrate 1-lần từ bản Streamlit cũ.
 *
 *  🔒 KHOÁ BẢO MẬT (2026-07-05): trước đây route này ghi coins/xp từ file JSON
 *  local vào user_economy bằng UPSERT (GHI ĐÈ) — GET, không auth-gate, không
 *  rate-limit → nếu file streak_data.json tồn tại trên server thì bất kỳ ai gọi
 *  cũng bơm/ghi đè số dư (xu đổi quà THẬT §9.6 = vector faucet). Prod hiện TRƠ
 *  (file bị gitignore) nhưng đóng chốt trước beta. 4 lớp phòng thủ:
 *    1. ENV FLAG: mặc định TẮT (ENABLE_LEGACY_MIGRATION !== 'true') → 410. Route
 *       chết hẳn trên prod trừ khi cố ý bật để migrate thủ công.
 *    2. AUTH: phải đăng nhập (chống local-default-user bơm vào account chung).
 *    3. RATE-LIMIT: 3 req/phút/user.
 *    4. NO-OVERWRITE: chỉ migrate economy cho account CHƯA có row (INSERT, không
 *       UPSERT) → không bao giờ ghi đè số dư đang có.
 * ============================================================================
 */

export async function GET() {
  try {
    // 🔒 CHỐT 1 — route legacy TẮT mặc định. Bật thủ công bằng env khi cần migrate.
    if (process.env.ENABLE_LEGACY_MIGRATION !== 'true') {
      return NextResponse.json(
        { success: false, error: 'Công cụ migrate đã ngừng hoạt động.', code: 'MIGRATION_DISABLED' },
        { status: 410 }
      );
    }

    const user = await getCurrentUser();

    // 🔒 CHỐT 2 — phải đăng nhập (chống local-default-user ghi vào account chung).
    if (!user.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Bạn cần đăng nhập để migrate dữ liệu.' },
        { status: 401 }
      );
    }

    // 🔒 CHỐT 3 — rate-limit.
    const rl = rateLimit(`migrate:${user.id}`, 3, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Đường dẫn tương đối theo process.cwd() (thư mục sat-prep-web) để không phụ thuộc máy.
    // Bản Streamlit cũ nằm ở thư mục cha: ../10.SAT_Prep_App - Copy
    const oldDataDir = path.join(process.cwd(), '..', '10.SAT_Prep_App - Copy');

    const streakPath = path.join(oldDataDir, 'streak_data.json');
    const cauSaiPath = path.join(oldDataDir, 'cau_sai.json');
    const historyPath = path.join(oldDataDir, 'lich_su_thi.json');

    let migratedEconomy = false;
    let migratedMistakesCount = 0;
    let migratedHistoryCount = 0;

    let economyError = null;
    let mistakesError = null;
    let historyError = null;

    // 1. Migrate streak_data.json -> user_economy
    if (fs.existsSync(streakPath)) {
      const streakData = JSON.parse(fs.readFileSync(streakPath, 'utf8'));

      // 🔒 CHỐT 4 — NO-OVERWRITE: chỉ migrate cho account CHƯA có economy row.
      // Nếu đã có row (đã chơi/nhận xu) → BỎ QUA, KHÔNG ghi đè số dư (chống bơm
      // xu / reset economy bằng số từ file). Migrate economy vốn chỉ có nghĩa 1
      // lần cho account mới nhập từ Streamlit cũ.
      const { data: existing } = await supabase
        .from('user_economy')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        economyError = 'Account đã có dữ liệu economy — bỏ qua để không ghi đè số dư.';
      } else {
        const { error } = await supabase.from('user_economy').insert({
          user_id: user.id,
          coins: streakData.sat_coins || 100,
          xp: streakData.total_xp || 0,
          inventory: streakData.inventory || [],
          last_spin_date: streakData.last_spin_date || null,
          level: streakData.level || 1,
          current_xp: streakData.current_xp || 0,
          active_pet: streakData.active_pet || null,
          pity_counter: streakData.pity_counter || 0,
          fever_streak: streakData.fever_streak || 0,
          max_tower_floor: streakData.max_tower_floor || 0,
        });

        if (!error) migratedEconomy = true;
        else economyError = error;
      }
    } else {
      economyError = 'File streak_data.json không tồn tại';
    }

    // 2. Migrate cau_sai.json -> user_mistakes
    if (fs.existsSync(cauSaiPath)) {
      const cauSaiData = JSON.parse(fs.readFileSync(cauSaiPath, 'utf8'));
      
      // Chuyển đổi dữ liệu và gắn user_id
      const insertData = cauSaiData.map((item: Record<string, unknown>) => ({
        user_id: user.id,
        passage: item.passage || '',
        question: item.question || '',
        choices: item.choices || [],
        correct_choice: item.correct_choice || '',
        user_choice: item.user_choice || '',
        explanation: item.explanation || '',
        source: item.source || 'Old JSON'
      }));

      if (insertData.length > 0) {
        // Xóa hết câu sai cũ của user này để tránh trùng lặp
        await supabase.from('user_mistakes').delete().eq('user_id', user.id);
        
        const { error } = await supabase.from('user_mistakes').insert(insertData);
        if (!error) migratedMistakesCount = insertData.length;
        else mistakesError = error;
      }
    } else {
      mistakesError = 'File cau_sai.json không tồn tại';
    }

    // 3. Migrate lich_su_thi.json -> test_history
    if (fs.existsSync(historyPath)) {
      const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      
      const insertData = historyData.map((item: Record<string, unknown>) => ({
        user_id: user.id,
        module: item.module || '',
        subject: item.subject || '',
        correct: item.correct || 0,
        total: item.total || 0,
        score: item.score || 0,
        test_timestamp: item.timestamp || 0
      }));

      if (insertData.length > 0) {
        // Xóa hết lịch sử cũ của user
        await supabase.from('test_history').delete().eq('user_id', user.id);
        
        const { error } = await supabase.from('test_history').insert(insertData);
        if (!error) migratedHistoryCount = insertData.length;
        else historyError = error;
      }
    } else {
      historyError = 'File lich_su_thi.json không tồn tại';
    }

    return NextResponse.json({
      success: true,
      message: 'Đã hoàn tất tiến trình quét dữ liệu',
      debug_info: {
        user_id: user.id,
        is_authenticated: user.isAuthenticated,
        paths: {
          dir: oldDataDir,
          streak: streakPath
        }
      },
      details: {
        economy_migrated: migratedEconomy,
        economy_error: economyError,
        mistakes_migrated: migratedMistakesCount,
        mistakes_error: mistakesError,
        history_migrated: migratedHistoryCount,
        history_error: historyError
      }
    });

  } catch (error: unknown) {
    console.error('Lỗi tiến trình migration:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
