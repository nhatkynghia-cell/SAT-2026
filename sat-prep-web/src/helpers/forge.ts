export type Tier = 'Đồng' | 'Bạc' | 'Vàng' | 'Kim Cương';

export interface Equipment {
  instanceId: string;
  itemId: string;
  name: string;
  tier: Tier;
  level: number;
  icon: string;
  isBound: boolean;
}

export const getForgeCost = (tier: Tier, level: number): { coins: number; stones: number } => {
  if (tier === 'Đồng') return { coins: level * 150, stones: level };
  if (tier === 'Bạc') return { coins: level * 250, stones: level };
  if (tier === 'Vàng') return { coins: level * 400, stones: level };
  if (tier === 'Kim Cương') {
    if (level < 5) return { coins: level * 1000, stones: level };
    return { coins: level * 2000, stones: level * 2 };
  }
  return { coins: level * 150, stones: level };
};

export const getMaxLevel = (tier: Tier): number => {
  if (tier === 'Kim Cương') return 10;
  return 5;
};

export const getSuccessRate = (tier: Tier, level: number): number => {
  if (tier === 'Đồng') return 100;
  if (tier === 'Bạc' || tier === 'Vàng') {
    const rates: Record<number, number> = { 1: 100, 2: 90, 3: 75, 4: 50 };
    return rates[level] || 50;
  }
  if (tier === 'Kim Cương') {
    const rates: Record<number, number> = { 1: 100, 2: 90, 3: 80, 4: 65, 5: 50, 6: 40, 7: 30, 8: 20, 9: 10 };
    return rates[level] || 10;
  }
  return 100;
};

export const attemptUpgrade = (tier: Tier, level: number, useBua: boolean = false) => {
  const maxLvl = getMaxLevel(tier);
  if (level >= maxLvl) return { success: false, message: `Trang bị đã đạt cấp tối đa (+${maxLvl})!`, newLevel: level };
  
  const rate = getSuccessRate(tier, level);
  const roll = Math.floor(Math.random() * 100) + 1; // 1 to 100
  
  if (roll <= rate) {
    return { success: true, message: `Cường hóa thành công! Trang bị đạt cấp +${level + 1} 🎉`, newLevel: level + 1 };
  } else {
    // Fail
    if (useBua) {
      return { success: false, message: "Cường hóa thất bại! May mắn có Bùa Bảo Hộ nên trang bị giữ nguyên cấp độ. 🛡️", newLevel: level };
    } else {
      if (level > 1) {
        return { success: false, message: `CƯỜNG HÓA THẤT BẠI! Trang bị của bạn đã bị rớt xuống cấp +${level - 1} 😭`, newLevel: level - 1 };
      } else {
        return { success: false, message: "Cường hóa thất bại! Đá cường hóa đã bị vỡ vụn... ⚡", newLevel: level };
      }
    }
  }
};
