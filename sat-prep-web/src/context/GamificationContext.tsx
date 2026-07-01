'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { attemptUpgrade, getForgeCost, Equipment } from '@/helpers/forge';
import { PVP_OPPONENTS } from '@/helpers/pvp';

export type InventoryItem = string | Equipment;

export interface BadgeState {
  level: number;
  maxPower: number;
  coins: number;
}

// Static Badge Database
// ⚠️ Ngưỡng theo THANG KỸ NĂNG mới (level = số skill tinh thông + 1, tối đa ~19),
// KHÔNG còn Level phẳng 1-200 (§10). req_desc mô tả theo số chương/skill.
export const BADGE_CATALOG = [
  { id: "b_1", title: "Tân Binh Xuất Thế", req_desc: "Tinh thông 1 kỹ năng", icon: "🥉", category: "Tu Vi", check: (state: BadgeState) => state.level >= 2 },
  { id: "b_2", title: "Kiếm Khách SAT", req_desc: "Tinh thông 3 kỹ năng", icon: "🗡️", category: "Tu Vi", check: (state: BadgeState) => state.level >= 4 },
  { id: "b_3", title: "Đại Pháp Sư SAT", req_desc: "Tinh thông 6 kỹ năng", icon: "🧙‍♂️", category: "Tu Vi", check: (state: BadgeState) => state.level >= 7 },
  { id: "b_4", title: "Đỉnh Phong Thủ Khoa", req_desc: "Tinh thông 10 kỹ năng", icon: "👑", category: "Tu Vi", check: (state: BadgeState) => state.level >= 11 },
  { id: "b_5", title: "Thần Thoại Học Thuật", req_desc: "Tinh thông 14 kỹ năng", icon: "🌟", category: "Tu Vi", check: (state: BadgeState) => state.level >= 15 },
  
  { id: "l_1", title: "Sức Mạnh Đánh Thức", req_desc: "Cần 100 Lực chiến", icon: "🔥", category: "Lực Chiến", check: (state: BadgeState) => state.maxPower >= 100 },
  { id: "l_2", title: "Kẻ Phá Vỡ Giới Hạn", req_desc: "Cần 300 Lực chiến", icon: "⚔️", category: "Lực Chiến", check: (state: BadgeState) => state.maxPower >= 300 },
  
  { id: "c_1", title: "💰 Phú Hộ Học Thuật", req_desc: "Tích lũy 500 Xu", icon: "💰", category: "Chiến Tích", check: (state: BadgeState) => state.coins >= 500 }
];

export const ITEM_CATALOG = [
  { id: "skin_1", name: "Đại Pháp Sư Desmos", icon: "🧙‍♂️", type: "skin", price: 1500, effectClass: "shadow-[0_0_20px_#8b5cf6] animate-pulse text-purple-400 border-[#8b5cf6]" },
  { id: "skin_2", name: "Kiếm Khách SAT Cổ Đại", icon: "🗡️", type: "skin", price: 1800, effectClass: "shadow-[0_0_20px_#ef4444] text-red-400 border-[#ef4444]" },
  { id: "skin_3", name: "Đỉnh Phong Thủ Khoa", icon: "👑", type: "skin", price: 3000, effectClass: "shadow-[0_0_30px_#fbbf24] animate-bounce text-yellow-300 border-[#fbbf24]" },
  { id: "eq_epic_1", name: "Găng Tay Tri Thức", icon: "🥊", type: "equipment", price: 800, effectClass: "text-blue-400" },
  { id: "eq_epic_2", name: "Mũ Cú Vọ Ban Đêm", icon: "🎩", type: "equipment", price: 850, effectClass: "text-indigo-400" },
  { id: "eq_leg_1", name: "Huy Hiệu Ivy League (Cũ)", icon: "🛡️", type: "equipment", price: 5000, effectClass: "shadow-[0_0_15px_#34d399] text-emerald-400" },
  { id: "eq_leg_2", name: "Nhẫn Chân Lý SAT", icon: "💍", type: "equipment", price: 6000, effectClass: "shadow-[0_0_25px_#f472b6] animate-pulse text-pink-400" },
  { id: "rw_1", name: "Voucher Lệ Phí Thi SAT (100%)", icon: "🎟️", type: "reward", price: 50000, effectClass: "border-green-500 shadow-[0_0_20px_#22c55e]" },
  { id: "rw_2", name: "Bộ Tài Liệu Giải Bẫy Toán Thủ Khoa", icon: "📚", type: "reward", price: 10000, effectClass: "border-blue-500 shadow-[0_0_15px_#3b82f6]" },
  { id: "rw_3", name: "Thẻ Đặc Quyền Gia Sư AI VIP", icon: "🤖", type: "reward", price: 20000, effectClass: "border-purple-500 shadow-[0_0_15px_#a855f7]" },
  { id: "shield_1", name: "Khiên Bảo Vệ Streak", icon: "🛡️", type: "consumable", price: 50 },
  { id: "mana_1", name: "Thuốc Hồi Mana", icon: "🧪", type: "consumable", price: 30 },
  { id: "exp_1", name: "Bùa X2 Kinh Nghiệm", icon: "✨", type: "consumable", price: 200 },
  { id: "sinh_menh_dan", name: "Sinh Mệnh Đan", icon: "💊", type: "consumable", price: 100 },
  { id: "ve_skip_cau", name: "Vé Skip Câu Khó", icon: "🎫", type: "consumable", price: 150 }
];

export interface UserStats {
  level: number;
  xp: number;
  coins: number;
  streak: number;
  shield: number;
  // Các field mở rộng phục vụ Next.js frontend
  maxPower: number;
  correctAnswersCountToday: number;
  pvpRank: number;
  pvpWinStreak: number;
  lastSpinDate: string | null;
  activePet: string | null;
}

export interface PracticeQuestionState {
  current_id: string | null;
  history: string[];
  wrong_answers: string[];
  bookmarkedQuestions: string[];
}

export interface Quest {
  id: string;
  name: string;
  desc: string;
  progress: number;
  target: number;
  xp: number;
  coins: number;
  claimed?: boolean;
}

export interface QuestsState {
  daily: Quest[];
  weekly: Quest[];
  monthly: Quest[];
}

type GamificationState = {
  // Bọc dữ liệu (Tương thích chuẩn cấu trúc)
  userStats: UserStats;
  inventory: InventoryItem[];
  practiceQuestion: PracticeQuestionState;
  quests: QuestsState;
  unlockedBadges: string[];
  
  // Helpers & Legacy getters để các Component không bị gãy (Crash-proof)
  // ⚠️ Level KHÔNG còn phẳng (§10): level DẪN XUẤT từ masteredCount (số skill
  // đã tinh thông), KHÔNG từ XP. Giữ tên biến `level` cho các trang gate đọc.
  level: number;
  currentXp: number;
  masteredCount: number;
  totalNodes: number;
  coins: number;
  shields: number;
  maxPower: number;
  correctAnswersCountToday: number;
  pvpRank: number;
  pvpWinStreak: number;
  practiceStreak: number;
  lastSpinDate: string | null;
  activePet: string | null;
  bookmarkedQuestions: string[];

  // Actions
  // 🔴 Economy server-authoritative (§9.1): coins/xp do SERVER quyết. Các hàm
  // grant (answer/exam) là ASYNC — số thưởng lấy từ response server, client
  // KHÔNG tự cộng. Các hàm spend gate trên coins đã đồng bộ rồi POST 'spend'.
  handlePracticeAnswer: (isCorrect: boolean, difficulty: string) => Promise<{ xpGiven: number, coinsGiven: number, comboMultiplier: number }>;
  handleExamComplete: (correctCount: number, difficulty: string) => Promise<{ coins: number, xp: number }>;
  incrementCorrectAnswers: () => void;
  spinDailyWheel: () => Promise<{ success: boolean, message: string, rewardType: string }>;
  buyItem: (itemId: string, price: number) => boolean;
  spendCoins: (amount: number) => boolean;
  toggleBookmark: (questionId: string) => void;
  upgradeItem: (instanceId: string) => { success: boolean, message: string };
  fightPvP: () => Promise<{ success: boolean, message: string, won: boolean }>;
  equipPet: (petId: string) => void;

  // Quest Actions
  updateQuestProgress: (questId: string, amount: number) => void;
  claimQuest: (questId: string) => Promise<void>;

  // UI States
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  focusMode: boolean;
  setFocusMode: (v: boolean) => void;
  hideBanner: boolean;
  setHideBanner: (v: boolean) => void;
  learningMode: 'ai' | 'notebook';
  setLearningMode: (v: 'ai' | 'notebook') => void;
  subject: string;
  setSubject: (v: string) => void;
  questionKey: number;
  incrementQuestionKey: () => void;
};

const GamificationContext = createContext<GamificationState | undefined>(undefined);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  // State Groups (Hydration Schema)
  const [userStats, setUserStats] = useState<UserStats>({
    level: 1, xp: 0, coins: 100, streak: 0, shield: 0,
    maxPower: 50, correctAnswersCountToday: 0, pvpRank: 11, pvpWinStreak: 0,
    lastSpinDate: null, activePet: null
  });
  
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { instanceId: "eq_1", itemId: "kiem_go", name: "Kiếm Gỗ Tập Sự", tier: "Đồng", level: 1, icon: "🗡️", isBound: true },
    { instanceId: "eq_2", itemId: "giap_da", name: "Giáp Da Tập Sự", tier: "Đồng", level: 1, icon: "🛡️", isBound: true }
  ]);
  
  const [practiceQuestion, setPracticeQuestion] = useState<PracticeQuestionState>({
    current_id: null, history: [], wrong_answers: [], bookmarkedQuestions: []
  });
  
  const [quests, setQuests] = useState<QuestsState>({
    daily: [], weekly: [], monthly: []
  });

  // Badge: DẪN XUẤT từ level/coins/maxPower (không phải state riêng) → dùng
  // useMemo thay useEffect+setState (tránh cascading render, React purity).
  // (khai báo useMemo đặt SAU userStats; xem bên dưới phần derive)
  // Tiến trình kỹ năng (nguồn dẫn xuất `level`). masteredCount từ /api/skill-tree.
  const [skillProgress, setSkillProgress] = useState<{ masteredCount: number; totalNodes: number }>({
    masteredCount: 0,
    totalNodes: 0,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load on mount: nền từ /api/save-data (streak/inventory/quests), nhưng
  // coins/xp/lastSpinDate LẤY TỪ /api/economy (server-authoritative), level
  // DẪN XUẤT từ /api/skill-tree (masteredCount). Fetch song song.
  useEffect(() => {
    async function loadData() {
      try {
        const [saveRes, ecoRes, treeRes] = await Promise.all([
          fetch('/api/load-data'),
          fetch('/api/economy'),
          fetch('/api/skill-tree'),
        ]);

        // 1) Nền: save-data (streak, inventory, quests, pvp, maxPower, pet...)
        if (saveRes.ok) {
          const parsed = await saveRes.json();

          // Defensive Hydration
          if (parsed.user_stats) {
            setUserStats(prev => ({ ...prev, ...parsed.user_stats }));
          } else if (parsed.level !== undefined) {
            // Hỗ trợ ngược (Backward compatibility) nếu json cũ phẳng
            setUserStats(prev => ({
              ...prev,
              coins: parsed.coins ?? prev.coins,
              shield: parsed.shields ?? prev.shield,
              streak: parsed.practiceStreak ?? prev.streak,
              maxPower: parsed.maxPower ?? prev.maxPower,
              correctAnswersCountToday: parsed.correctAnswersCountToday ?? prev.correctAnswersCountToday,
              pvpRank: parsed.pvpRank ?? prev.pvpRank,
              pvpWinStreak: parsed.pvpWinStreak ?? prev.pvpWinStreak,
              activePet: parsed.activePet ?? prev.activePet
            }));
          }

          if (parsed.inventory) setInventory(parsed.inventory);

          if (parsed.practice_question) {
            setPracticeQuestion(prev => ({ ...prev, ...parsed.practice_question }));
          } else if (parsed.bookmarkedQuestions) {
            setPracticeQuestion(prev => ({ ...prev, bookmarkedQuestions: parsed.bookmarkedQuestions }));
          }

          if (parsed.quests) setQuests(parsed.quests);
        }

        // 2) Economy server-authoritative: ghi đè coins/xp/lastSpinDate.
        if (ecoRes.ok) {
          const eco = await ecoRes.json();
          setUserStats(prev => ({
            ...prev,
            coins: eco.coins ?? prev.coins,
            xp: eco.xp ?? prev.xp,
            lastSpinDate: eco.lastSpinDate ?? prev.lastSpinDate,
          }));
        }

        // 3) Level dẫn xuất từ masteredCount (số skill đã tinh thông).
        if (treeRes.ok) {
          const tree = await treeRes.json();
          const masteredCount = tree.masteredCount ?? 0;
          const totalNodes = tree.totalNodes ?? 0;
          setSkillProgress({ masteredCount, totalNodes });
          setUserStats(prev => ({ ...prev, level: masteredCount + 1 }));
        }
      } catch (e) {
        console.error("Failed to load state from API", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  // Save to Local API with Debounce (1.5s)
  useEffect(() => {
    if (!isLoaded) return;
    
    const limitedInventory = inventory.length > 100 ? inventory.slice(-100) : inventory;
    
    const state = { 
      user_stats: userStats,
      inventory: limitedInventory, 
      practice_question: practiceQuestion,
      quests: quests
    };
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/save-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });
      } catch (e) {
        console.error("Failed to save state to API", e);
      }
    }, 1500);
    
  }, [userStats, inventory, practiceQuestion, quests, isLoaded]);

  // UI States
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [hideBanner, setHideBanner] = useState(false);
  const [learningMode, setLearningMode] = useState<'ai' | 'notebook'>('ai');
  const [subject, setSubject] = useState('Reading & Writing (Đọc hiểu)');
  const [questionKey, setQuestionKey] = useState(0);

  // Đồng bộ coins/xp/lastSpinDate từ EconomyState mà server trả về sau mỗi
  // mutation. 🔴 Client KHÔNG tự cộng số tiền — luôn lấy con số từ server.
  const syncEconomy = (eco: { coins?: number; xp?: number; lastSpinDate?: string | null }) => {
    setUserStats(prev => ({
      ...prev,
      coins: eco.coins ?? prev.coins,
      xp: eco.xp ?? prev.xp,
      lastSpinDate: eco.lastSpinDate ?? prev.lastSpinDate,
    }));
  };

  const incrementCorrectAnswers = () => {
    setUserStats(prev => ({ ...prev, correctAnswersCountToday: prev.correctAnswersCountToday + 1 }));
    updateQuestProgress('q1', 1);
  };

  // 🔴 Server-authoritative (§9.1): client gửi {isCorrect, difficulty, streak},
  // SERVER tra ANSWER_REWARD + combo rồi trả coins/xp. Client KHÔNG gửi số tiền.
  const handlePracticeAnswer = async (isCorrect: boolean, difficulty: string) => {
    if (!isCorrect) {
      setUserStats(prev => ({ ...prev, streak: 0 }));
      return { xpGiven: 0, coinsGiven: 0, comboMultiplier: 1.0 };
    }

    const newStreak = userStats.streak + 1;
    const comboMultiplier = newStreak >= 5 ? 1.5 : 1.0;
    setUserStats(prev => ({ ...prev, streak: newStreak }));
    incrementCorrectAnswers();

    try {
      const res = await fetch('/api/economy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'answer', isCorrect: true, difficulty, streak: newStreak }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) syncEconomy(data.state);
        const granted = data.granted ?? { coins: 0, xp: 0 };
        return { xpGiven: granted.xp, coinsGiven: granted.coins, comboMultiplier };
      }
    } catch (e) {
      console.error('Failed to grant answer reward', e);
    }
    return { xpGiven: 0, coinsGiven: 0, comboMultiplier };
  };

  // Phần thưởng cho 1 BÀI (thi thử/thi thật/lượt ôn từ vựng): server nhân
  // correctCount × đơn giá theo độ khó. Client chỉ gửi số đếm + độ khó.
  const handleExamComplete = async (correctCount: number, difficulty: string) => {
    try {
      const res = await fetch('/api/economy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exam', correctCount, difficulty }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) syncEconomy(data.state);
        return data.granted ?? { coins: 0, xp: 0 };
      }
    } catch (e) {
      console.error('Failed to grant exam reward', e);
    }
    return { coins: 0, xp: 0 };
  };

  const spinDailyWheel = async () => {
    // Random CHẠY Ở SERVER (§9.6) — client không tự quyết kết quả.
    try {
      const res = await fetch('/api/economy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'spin' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) syncEconomy(data.state);
        const r = data.result;
        if (data.success && r) {
          // Đồng bộ item ẢO vào inventory hiển thị (server đã ghi vào túi của nó).
          if (r.type === 'item') {
            setInventory(prev => [...prev, { instanceId: `eq_${Date.now()}`, itemId: 'da_cuong_hoa', name: 'Đá Cường Hóa', tier: 'Đồng', level: 1, icon: '🪨', isBound: true }]);
          } else if (r.type === 'epic' && r.itemId) {
            setInventory(prev => [...prev, r.itemId]);
          }
          return { success: true, message: r.message, rewardType: r.type };
        }
        return { success: false, message: r?.message ?? 'Hôm nay bạn đã quay rồi. Quay lại vào ngày mai!', rewardType: 'none' };
      }
    } catch (e) {
      console.error('Failed to spin', e);
    }
    return { success: false, message: 'Lỗi kết nối, vui lòng thử lại sau.', rewardType: 'none' };
  };

  const buyItem = (itemId: string, price: number) => {
    if (userStats.coins >= price) {
      setUserStats(prev => {
        const newState = { ...prev, coins: prev.coins - price };
        if (itemId.includes("shield")) newState.shield += 1;
        if (itemId.includes("power")) newState.maxPower += 10;
        return newState;
      });
      postSpend(price);

      setInventory(prev => [...prev, itemId]);
      
      if (itemId.includes("da_cuong_hoa")) {
        setInventory(prev => [...prev, { instanceId: `eq_${Date.now()}`, itemId: "da_cuong_hoa", name: "Đá Cường Hóa", tier: "Đồng", level: 1, icon: "🪨", isBound: true }]);
      }
      
      return true;
    }
    return false;
  };

  // 🔴 Trừ xu qua server (§9.1): optimistic deduct cục bộ để UI phản hồi ngay +
  // giữ chữ ký sync (boolean), rồi POST 'spend' và đồng bộ lại coins từ server.
  // Spend KHÔNG phải vector cheat (chỉ tiêu được xu đang có) nên optimistic an toàn.
  const postSpend = (amount: number) => {
    fetch('/api/economy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'spend', amount }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.state) syncEconomy(data.state);
        }
      })
      .catch((e) => console.error('Failed to spend coins', e));
  };

  const spendCoins = (amount: number) => {
    if (userStats.coins >= amount) {
      setUserStats(prev => ({ ...prev, coins: prev.coins - amount }));
      postSpend(amount);
      return true;
    }
    return false;
  };

  const toggleBookmark = (questionId: string) => {
    setPracticeQuestion(prev => {
      const current = prev.bookmarkedQuestions || [];
      if (current.includes(questionId)) {
        return { ...prev, bookmarkedQuestions: current.filter(id => id !== questionId) };
      }
      return { ...prev, bookmarkedQuestions: [...current, questionId] };
    });
  };

  const upgradeItem = (instanceId: string) => {
    const itemIndex = inventory.findIndex(i => typeof i === 'object' && i.instanceId === instanceId);
    if (itemIndex === -1) return { success: false, message: "Không tìm thấy trang bị!" };
    
    const item = inventory[itemIndex] as Equipment;
    const { coins: costCoins } = getForgeCost(item.tier, item.level);
    
    if (userStats.coins < costCoins) {
      return { success: false, message: `Không đủ ${costCoins} Xu để cường hóa!` };
    }
    
    setUserStats(prev => ({ ...prev, coins: prev.coins - costCoins }));
    postSpend(costCoins);

    const result = attemptUpgrade(item.tier, item.level, false);
    
    const newInventory = [...inventory];
    newInventory[itemIndex] = { ...item, level: result.newLevel };
    setInventory(newInventory);
    
    if (result.success) {
      setUserStats(prev => ({ ...prev, maxPower: prev.maxPower + 15 }));
    }
    
    return { success: result.success, message: result.message };
  };

  const fightPvP = async () => {
    // Đối thủ hiển thị (chỉ để dựng message) tính từ rank client. Rank THẬT do
    // SERVER quyết và trả về trong data.pvpRank — client luôn đồng bộ theo đó.
    const targetRank = Math.max(1, userStats.pvpRank - 1);
    const opponent = PVP_OPPONENTS[targetRank];

    // 🔴 Server quyết tất cả: hợp lệ lượt đánh (rank kế trên + cap/ngày), cổng
    // năng lực (lực từ mastery thật), RNG, thưởng, rank mới (§9.1). Client KHÔNG
    // gửi targetRank có ý nghĩa (server tự tính từ rank thật) — chống nhảy rank.
    try {
      const res = await fetch('/api/economy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pvp' }),
      });
      const data = await res.json();

      // PvP đang nâng cấp (migration cột pvp_* chưa chạy) hoặc lỗi khác.
      if (!res.ok || !data.success) {
        return { success: false, message: data?.error ?? "Lỗi khi xử lý trận đấu.", won: false };
      }

      // Đồng bộ rank THẬT từ server (kể cả khi không đủ điều kiện, để client
      // không lệch với server).
      if (typeof data.pvpRank === 'number') {
        setUserStats(prev => ({ ...prev, pvpRank: data.pvpRank }));
      }

      // Không đủ điều kiện (hết cap/ngày, chưa đủ lực, hoặc đã ở đỉnh): không đổi
      // chuỗi thắng, hiện thông điệp hướng dẫn từ server.
      if (!data.eligible) {
        return { success: false, message: data.reason ?? "Chưa thể thách đấu lúc này.", won: false };
      }

      if (data.won) {
        if (data.state) syncEconomy(data.state); // xu/XP từ server
        setUserStats(prev => ({ ...prev, pvpWinStreak: prev.pvpWinStreak + 1 }));
        const displayStreak = userStats.pvpWinStreak + 1;
        const streakMsg = displayStreak >= 3 ? ` (Chuỗi thắng ${displayStreak}x!)` : '';
        const reward = data.granted ? ` +${data.granted.coins} Xu, +${data.granted.xp} XP.` : '';
        const foe = opponent ? opponent.name : 'đối thủ';
        return { success: true, message: `Chiến thắng ${foe}! Leo lên hạng mới.${reward}${streakMsg}`, won: true };
      }

      setUserStats(prev => ({ ...prev, pvpWinStreak: 0 }));
      const foe = opponent ? opponent.name : 'đối thủ';
      return { success: true, message: `Thất bại trước ${foe}! Chuỗi thắng bị đứt. Hãy luyện thêm để nâng lực chiến và thử lại.`, won: false };
    } catch (e) {
      console.error('Lỗi trận PvP', e);
      return { success: false, message: "Lỗi kết nối khi xử lý trận đấu.", won: false };
    }
  };

  const equipPet = (petId: string) => {
    setUserStats(prev => ({ ...prev, activePet: petId, maxPower: prev.maxPower + 50 }));
  };

  const updateQuestProgress = (questId: string, amount: number) => {
    setQuests(prev => {
      // Find quest in daily
      const updatedDaily = prev.daily.map(q => q.id === questId ? { ...q, progress: Math.min(q.target, q.progress + amount) } : q);
      return { ...prev, daily: updatedDaily };
    });
  };

  const claimQuest = async (questId: string) => {
    const quest = quests.daily.find(q => q.id === questId);
    if (quest && quest.progress >= quest.target && !quest.claimed) {
      // 🔴 Server quyết phần thưởng từ QUEST_REWARD theo questId (§9.1).
      // Đánh dấu đã nhận TRƯỚC để chống double-claim do bấm nhanh; nếu request
      // lỗi, server không cộng nhưng claim flag chỉ là cờ UI cục bộ (sẽ đồng bộ
      // lại từ save-data lần load sau).
      setQuests(prev => ({
        ...prev,
        daily: prev.daily.map(q => q.id === questId ? { ...q, claimed: true } : q)
      }));
      try {
        const res = await fetch('/api/economy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'quest', questId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.state) syncEconomy(data.state);
        }
      } catch (e) {
        console.error('Failed to claim quest reward', e);
      }
    }
  };

  // Badge: neo vào level (đã DẪN XUẤT từ masteredCount), coins, maxPower.
  // useMemo (không phải effect+setState) — thuần dẫn xuất, tránh cascading render.
  const unlockedBadges = useMemo(() => {
    const state = { level: userStats.level, coins: userStats.coins, maxPower: userStats.maxPower };
    return BADGE_CATALOG.filter(b => b.check(state)).map(b => b.id);
  }, [userStats.level, userStats.coins, userStats.maxPower]);

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-50 animate-pulse">
        <div className="w-16 h-16 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
        <div className="mt-8 text-2xl font-black tracking-widest text-[#94a3b8]">ĐANG TẢI DỮ LIỆU...</div>
      </div>
    );
  }

  return (
    <GamificationContext.Provider value={{
      userStats, inventory, practiceQuestion, quests,
      
      // Legacy exposes for crash-proofing
      level: userStats.level,
      currentXp: userStats.xp,
      masteredCount: skillProgress.masteredCount,
      totalNodes: skillProgress.totalNodes,
      coins: userStats.coins,
      shields: userStats.shield,
      maxPower: userStats.maxPower,
      correctAnswersCountToday: userStats.correctAnswersCountToday,
      pvpRank: userStats.pvpRank,
      pvpWinStreak: userStats.pvpWinStreak,
      practiceStreak: userStats.streak,
      lastSpinDate: userStats.lastSpinDate,
      activePet: userStats.activePet,
      bookmarkedQuestions: practiceQuestion.bookmarkedQuestions || [],

      unlockedBadges,

      incrementCorrectAnswers, handlePracticeAnswer, handleExamComplete, spinDailyWheel, buyItem, spendCoins, toggleBookmark, upgradeItem, fightPvP, equipPet,
      updateQuestProgress, claimQuest,
      soundEnabled, setSoundEnabled, focusMode, setFocusMode,
      hideBanner, setHideBanner, learningMode, setLearningMode,
      subject, setSubject, questionKey, incrementQuestionKey: () => setQuestionKey(prev => prev + 1)
    }}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) throw new Error("useGamification must be used within GamificationProvider");
  return context;
}
