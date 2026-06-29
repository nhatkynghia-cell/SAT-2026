'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { attemptUpgrade, getForgeCost, Tier, Equipment } from '@/helpers/forge';
import { calculateFightResult, getPvpRankName, PVP_OPPONENTS } from '@/helpers/pvp';

export type InventoryItem = string | Equipment;

export interface BadgeState {
  level: number;
  maxPower: number;
  coins: number;
}

// Static Badge Database
export const BADGE_CATALOG = [
  { id: "b_1", title: "Tân Binh Xuất Thế", req_desc: "Cần đạt Cấp 5", icon: "🥉", category: "Tu Vi", check: (state: BadgeState) => state.level >= 5 },
  { id: "b_2", title: "Kiếm Khách SAT", req_desc: "Cần đạt Cấp 15", icon: "🗡️", category: "Tu Vi", check: (state: BadgeState) => state.level >= 15 },
  { id: "b_3", title: "Đại Pháp Sư SAT", req_desc: "Cần đạt Cấp 30", icon: "🧙‍♂️", category: "Tu Vi", check: (state: BadgeState) => state.level >= 30 },
  { id: "b_4", title: "Đỉnh Phong Thủ Khoa", req_desc: "Cần đạt Cấp 60", icon: "👑", category: "Tu Vi", check: (state: BadgeState) => state.level >= 60 },
  { id: "b_5", title: "Thần Thoại Học Thuật", req_desc: "Cần đạt Cấp 100", icon: "🌟", category: "Tu Vi", check: (state: BadgeState) => state.level >= 100 },
  
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

export interface QuestsState {
  daily: any[];
  weekly: any[];
  monthly: any[];
}

type GamificationState = {
  // Bọc dữ liệu (Tương thích chuẩn cấu trúc)
  userStats: UserStats;
  inventory: InventoryItem[];
  practiceQuestion: PracticeQuestionState;
  quests: QuestsState;
  unlockedBadges: string[];
  
  // Helpers & Legacy getters để các Component không bị gãy (Crash-proof)
  level: number;
  currentXp: number;
  maxXp: number;
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
  addReward: (xp: number, coins: number) => void;
  incrementCorrectAnswers: () => void;
  handlePracticeAnswer: (isCorrect: boolean, baseRewardXp: number, baseRewardCoins: number) => { xpGiven: number, coinsGiven: number, comboMultiplier: number };
  spinDailyWheel: () => { success: boolean, message: string, rewardType: string };
  buyItem: (itemId: string, price: number) => boolean;
  spendCoins: (amount: number) => boolean;
  toggleBookmark: (questionId: string) => void;
  upgradeItem: (instanceId: string) => { success: boolean, message: string };
  fightPvP: () => { success: boolean, message: string, won: boolean };
  equipPet: (petId: string) => void;
  
  // Quest Actions
  updateQuestProgress: (questId: string, amount: number) => void;
  claimQuest: (questId: string) => void;
  
  levelUpAlert: boolean;
  clearLevelUpAlert: () => void;
  
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

  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);
  const [levelUpAlert, setLevelUpAlert] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load from Local API on mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/load-data');
        if (res.ok) {
          const parsed = await res.json();
          
          // Defensive Hydration
          if (parsed.user_stats) {
            setUserStats(prev => ({ ...prev, ...parsed.user_stats }));
          } else if (parsed.level !== undefined) {
            // Hỗ trợ ngược (Backward compatibility) nếu json cũ phẳng
            setUserStats(prev => ({
              ...prev,
              level: parsed.level ?? prev.level,
              xp: parsed.currentXp ?? prev.xp,
              coins: parsed.coins ?? prev.coins,
              shield: parsed.shields ?? prev.shield,
              streak: parsed.practiceStreak ?? prev.streak,
              maxPower: parsed.maxPower ?? prev.maxPower,
              correctAnswersCountToday: parsed.correctAnswersCountToday ?? prev.correctAnswersCountToday,
              pvpRank: parsed.pvpRank ?? prev.pvpRank,
              pvpWinStreak: parsed.pvpWinStreak ?? prev.pvpWinStreak,
              lastSpinDate: parsed.lastSpinDate ?? prev.lastSpinDate,
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

  const getMaxXp = (lvl: number) => {
    if (lvl < 10) return 1000;
    if (lvl < 20) return 2000;
    return 5000;
  };

  const addReward = (xpToAdd: number, coinsToAdd: number) => {
    setUserStats(prev => {
      let newXp = prev.xp + xpToAdd;
      let newLevel = prev.level;
      let didLevelUp = false;

      while (newXp >= getMaxXp(newLevel)) {
        newXp -= getMaxXp(newLevel);
        newLevel += 1;
        didLevelUp = true;
      }

      if (didLevelUp) setLevelUpAlert(true);

      return {
        ...prev,
        level: newLevel,
        xp: newXp,
        coins: prev.coins + coinsToAdd,
        maxPower: didLevelUp ? prev.maxPower + 25 : prev.maxPower
      };
    });
  };

  const incrementCorrectAnswers = () => {
    setUserStats(prev => ({ ...prev, correctAnswersCountToday: prev.correctAnswersCountToday + 1 }));
    updateQuestProgress('q1', 1);
  };

  const handlePracticeAnswer = (isCorrect: boolean, baseRewardXp: number, baseRewardCoins: number) => {
    if (isCorrect) {
      let newStreak = userStats.streak + 1;
      const comboMultiplier = newStreak >= 5 ? 1.5 : 1.0;
      const xpGiven = Math.floor(baseRewardXp * comboMultiplier);
      const coinsGiven = Math.floor(baseRewardCoins * comboMultiplier);
      
      setUserStats(prev => ({ ...prev, streak: newStreak }));
      addReward(xpGiven, coinsGiven);
      incrementCorrectAnswers();
      
      return { xpGiven, coinsGiven, comboMultiplier };
    } else {
      setUserStats(prev => ({ ...prev, streak: 0 }));
      return { xpGiven: 0, coinsGiven: 0, comboMultiplier: 1.0 };
    }
  };

  const spinDailyWheel = () => {
    const today = new Date().toISOString().split('T')[0];
    if (userStats.lastSpinDate === today) {
      return { success: false, message: "Hôm nay bạn đã quay rồi. Hãy quay lại vào ngày mai!", rewardType: "none" };
    }

    setUserStats(prev => ({ ...prev, lastSpinDate: today }));
    
    const roll = Math.random() * 100;
    
    if (roll < 80) {
      const randomCoins = Math.floor(Math.random() * 151) + 50;
      setUserStats(prev => ({ ...prev, coins: prev.coins + randomCoins }));
      return { success: true, message: `Thần tài gõ cửa! Nhận được ${randomCoins} Xu!`, rewardType: "coins" };
    } else if (roll < 95) {
      setInventory(prev => [...prev, { instanceId: `eq_${Date.now()}`, itemId: "da_cuong_hoa", name: "Đá Cường Hóa", tier: "Đồng", level: 1, icon: "🪨", isBound: true }]);
      return { success: true, message: "May mắn! Nhận được 1 Đá Cường Hóa Lò Rèn!", rewardType: "item" };
    } else {
      const skins = ITEM_CATALOG.filter(item => item.type === "skin" || item.type === "equipment");
      const randomSkin = skins[Math.floor(Math.random() * skins.length)];
      setInventory(prev => [...prev, randomSkin.id]);
      return { success: true, message: `BÙNG NỔ! Trúng cực phẩm: ${randomSkin.name} ${randomSkin.icon}!`, rewardType: "epic" };
    }
  };

  const buyItem = (itemId: string, price: number) => {
    if (userStats.coins >= price) {
      setUserStats(prev => {
        let newState = { ...prev, coins: prev.coins - price };
        if (itemId.includes("shield")) newState.shield += 1;
        if (itemId.includes("power")) newState.maxPower += 10;
        return newState;
      });
      
      setInventory(prev => [...prev, itemId]);
      
      if (itemId.includes("da_cuong_hoa")) {
        setInventory(prev => [...prev, { instanceId: `eq_${Date.now()}`, itemId: "da_cuong_hoa", name: "Đá Cường Hóa", tier: "Đồng", level: 1, icon: "🪨", isBound: true }]);
      }
      
      return true;
    }
    return false;
  };

  const spendCoins = (amount: number) => {
    if (userStats.coins >= amount) {
      setUserStats(prev => ({ ...prev, coins: prev.coins - amount }));
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
    
    const result = attemptUpgrade(item.tier, item.level, false);
    
    const newInventory = [...inventory];
    newInventory[itemIndex] = { ...item, level: result.newLevel };
    setInventory(newInventory);
    
    if (result.success) {
      setUserStats(prev => ({ ...prev, maxPower: prev.maxPower + 15 }));
    }
    
    return { success: result.success, message: result.message };
  };

  const fightPvP = () => {
    const targetRank = Math.max(1, userStats.pvpRank - 1);
    const opponent = PVP_OPPONENTS[targetRank];
    if (!opponent) return { success: false, message: "Bạn đã đạt đỉnh cao Thách Đấu, không còn đối thủ!", won: false };
    
    const won = calculateFightResult(userStats.maxPower, opponent.luc_chien);
    
    if (won) {
      const newStreak = userStats.pvpWinStreak + 1;
      const multiplier = newStreak >= 3 ? 1.15 : 1;
      const finalXp = Math.floor(opponent.reward_xp * multiplier);
      const finalCoins = Math.floor(opponent.reward_coins * multiplier);
      
      setUserStats(prev => ({ ...prev, pvpWinStreak: newStreak, pvpRank: targetRank }));
      addReward(finalXp, finalCoins);
      
      const streakMsg = newStreak >= 3 ? ` (Chuỗi thắng ${newStreak}x! Bonus +15%)` : '';
      return { success: true, message: `Chiến thắng ${opponent.name}! Nhận ${finalXp} XP và ${finalCoins} Xu.${streakMsg}`, won: true };
    } else {
      setUserStats(prev => ({ ...prev, pvpWinStreak: 0 }));
      return { success: true, message: `Thất bại trước ${opponent.name}! Chuỗi thắng bị đứt. Hãy nâng cấp trang bị và thử lại.`, won: false };
    }
  };

  const equipPet = (petId: string) => {
    setUserStats(prev => ({ ...prev, activePet: petId, maxPower: prev.maxPower + 50 }));
  };

  const updateQuestProgress = (questId: string, amount: number) => {
    setQuests(prev => {
      // Find quest in daily
      let updatedDaily = prev.daily.map(q => q.id === questId ? { ...q, progress: Math.min(q.target, q.progress + amount) } : q);
      return { ...prev, daily: updatedDaily };
    });
  };

  const claimQuest = (questId: string) => {
    const quest = quests.daily.find(q => q.id === questId);
    if (quest && quest.progress >= quest.target && !quest.claimed) {
      addReward(quest.xp, quest.coins);
      setQuests(prev => ({
        ...prev,
        daily: prev.daily.map(q => q.id === questId ? { ...q, claimed: true } : q)
      }));
    }
  };

  useEffect(() => {
    const state = { level: userStats.level, coins: userStats.coins, maxPower: userStats.maxPower };
    const newlyUnlocked = BADGE_CATALOG.filter(b => b.check(state)).map(b => b.id);
    setUnlockedBadges(newlyUnlocked);
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
      maxXp: getMaxXp(userStats.level),
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
      
      addReward, incrementCorrectAnswers, handlePracticeAnswer, spinDailyWheel, buyItem, spendCoins, toggleBookmark, upgradeItem, fightPvP, equipPet,
      updateQuestProgress, claimQuest,
      levelUpAlert, clearLevelUpAlert: () => setLevelUpAlert(false),
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
