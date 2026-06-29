export interface PvpOpponent {
  rank: number;
  name: string;
  level: number;
  luc_chien: number;
  max_hp: number;
  icon: string;
  reward_coins: number;
  reward_xp: number;
  rankBorderClass?: string;
}

export const PVP_OPPONENTS: Record<number, PvpOpponent> = {
  10: { rank: 10, name: "Học Viên Tập Sự", level: 5, luc_chien: 120, max_hp: 300, icon: "🥉", reward_coins: 300, reward_xp: 200, rankBorderClass: "border-[#b45309] shadow-[0_0_10px_#b45309]" },
  9: { rank: 9, name: "Kiếm Sĩ Tập Sự", level: 12, luc_chien: 280, max_hp: 600, icon: "🗡️", reward_coins: 500, reward_xp: 350, rankBorderClass: "border-[#b45309] shadow-[0_0_10px_#b45309]" },
  8: { rank: 8, name: "Cung Thủ Tri Thức", level: 22, luc_chien: 480, max_hp: 1000, icon: "🏹", reward_coins: 800, reward_xp: 500, rankBorderClass: "border-[#94a3b8] shadow-[0_0_15px_#94a3b8]" },
  7: { rank: 7, name: "Đại Pháp Sư Toán Học", level: 35, luc_chien: 750, max_hp: 1800, icon: "🧙‍♂️", reward_coins: 1200, reward_xp: 800, rankBorderClass: "border-[#94a3b8] shadow-[0_0_15px_#94a3b8]" },
  6: { rank: 6, name: "Sát Thủ Đọc Hiểu", level: 48, luc_chien: 1100, max_hp: 3000, icon: "👤", reward_coins: 1800, reward_xp: 1200, rankBorderClass: "border-[#eab308] shadow-[0_0_20px_#eab308]" },
  5: { rank: 5, name: "Quản Tịch Thư Viện", level: 60, luc_chien: 1500, max_hp: 5000, icon: "📚", reward_coins: 2500, reward_xp: 1800, rankBorderClass: "border-[#eab308] shadow-[0_0_20px_#eab308]" },
  4: { rank: 4, name: "Chiến Thần Hoàn Hảo", level: 75, luc_chien: 2000, max_hp: 8000, icon: "⚡", reward_coins: 3500, reward_xp: 2500, rankBorderClass: "border-[#38bdf8] shadow-[0_0_25px_#38bdf8]" },
  3: { rank: 3, name: "Hiệp Sĩ Oxford", level: 90, luc_chien: 2600, max_hp: 12000, icon: "🛡️", reward_coins: 5000, reward_xp: 4000, rankBorderClass: "border-[#38bdf8] shadow-[0_0_25px_#38bdf8]" },
  2: { rank: 2, name: "Đế Vương Harvard", level: 110, luc_chien: 3200, max_hp: 20000, icon: "👑", reward_coins: 8000, reward_xp: 6000, rankBorderClass: "border-[#c084fc] shadow-[0_0_30px_#c084fc] animate-pulse" },
  1: { rank: 1, name: "Chúa Tể SAT Quest", level: 150, luc_chien: 4000, max_hp: 35000, icon: "🌌", reward_coins: 15000, reward_xp: 10000, rankBorderClass: "border-[#fbbf24] shadow-[0_0_40px_#fbbf24] animate-bounce" }
};

export const getPvpRankBorder = (rank: number): string => {
  if (rank > 10) return "border-[#475569]"; // Mặc định cho người mới
  return PVP_OPPONENTS[rank]?.rankBorderClass || "border-[#475569]";
};

export const getPvpRankName = (rank: number): string => {
  if (rank > 10) return "Tân Binh Đấu Trường";
  const opp = PVP_OPPONENTS[rank];
  if (opp) {
    let league = "";
    if (rank >= 9) league = "Đồng";
    else if (rank >= 7) league = "Bạc";
    else if (rank >= 5) league = "Vàng";
    else if (rank >= 3) league = "Bạch Kim";
    else if (rank === 2) league = "Kim Cương";
    else league = "Thách Đấu";
    return `Rank ${league} - ${opp.icon} ${opp.name}`;
  }
  return "Huyền Thoại Thách Đấu";
};

export const calculateFightResult = (playerPower: number, opponentPower: number): boolean => {
  // Simple algorithm: higher power has higher chance, but some randomness
  const totalPower = playerPower + opponentPower;
  if (totalPower === 0) return false;
  
  const winProbability = playerPower / totalPower;
  const roll = Math.random();
  
  return roll <= winProbability;
};
