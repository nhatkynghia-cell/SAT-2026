import { createClient } from '@/lib/supabase/server';
import { DEFAULT_ECONOMY, type EconomyState } from './economy';

/**
 * ============================================================================
 *  ECONOMY STORE (Supabase Postgres)
 * ============================================================================
 *  Đọc/ghi EconomyState của user từ bảng `user_economy` trên Supabase.
 *  Sử dụng RLS của Supabase để bảo mật thay vì dùng HMAC file cục bộ.
 * ============================================================================
 */

export async function loadEconomy(userId: string): Promise<EconomyState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_economy')
    .select('coins, xp, inventory, last_spin_date')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Nếu chưa có record thì trả về mặc định
    return { ...DEFAULT_ECONOMY };
  }

  return {
    coins: data.coins,
    xp: data.xp,
    inventory: data.inventory || [],
    lastSpinDate: data.last_spin_date,
  };
}

export async function saveEconomy(userId: string, state: EconomyState): Promise<void> {
  const supabase = await createClient();
  
  // Upsert dữ liệu kinh tế (nếu chưa có thì insert, có rồi thì update)
  const { error } = await supabase
    .from('user_economy')
    .upsert({
      user_id: userId,
      coins: state.coins,
      xp: state.xp,
      inventory: state.inventory,
      last_spin_date: state.lastSpinDate,
      // Không ghi đè các cột gamification phụ nếu chúng đã có
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Lỗi khi lưu economy lên Supabase:', error);
  }
}
