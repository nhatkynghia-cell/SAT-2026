import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { loadEconomy } from '@/lib/economy-store';
import { computeStats } from '@/lib/stats';

/**
 * CHARACTER STATS API (implementation_plan.md §10.B.2, task #18)
 *
 * GET → chỉ số nhân vật sinh từ hiệu suất học thật (Trí Tuệ/Chính Xác/Độ Phủ →
 *       Lực Chiến nền) + bonus trang bị (từ túi đồ ảo) → Lực Chiến tổng.
 *
 * Trang bị CHỈ cộng thêm — Lực Chiến nền hoàn toàn từ năng lực Cambridge thật.
 */

/** Bonus Lực Chiến mỗi món trang bị ảo trong túi (cosmetic-ish, nhỏ). */
const EQUIP_BONUS_PER_ITEM = 5;

export async function GET() {
  const user = await getCurrentUser();
  const summary = await getMasterySummary(user.id);
  const economy = await loadEconomy(user.id);

  // Bonus trang bị = số món trong túi × hệ số nhỏ (chỉ là phụ trợ, không thay
  // thế năng lực thật). Đây là dữ liệu server-authoritative từ economy.
  const equipmentBonus = economy.inventory.length * EQUIP_BONUS_PER_ITEM;

  const stats = computeStats(summary, equipmentBonus);
  return NextResponse.json(stats);
}
