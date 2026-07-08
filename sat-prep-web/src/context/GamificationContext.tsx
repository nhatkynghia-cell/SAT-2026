'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { attemptUpgrade, getForgeCost, Equipment } from '@/helpers/forge';
import { PVP_OPPONENTS } from '@/helpers/pvp';
import { computeUnlockedBadges, resolveStreakOnWrong, resolveBuy } from '@/lib/rpg-rules';
import { resolveDailyQuests, type QuestTrack } from '@/lib/quests';

export type InventoryItem = string | Equipment;

// Kết quả mua hàng: phân biệt thiếu xu vs mua trùng đồ vĩnh viễn (shop hiện toast
// khác nhau); maxPowerGained để hiện "+X Lực chiến" khi mua trang bị.
export interface BuyResult {
  success: boolean;
  reason?: 'insufficient' | 'already_owned';
  maxPowerGained?: number;
}

// Badge catalog + logic dẫn xuất chuyển sang @/lib/rpg-rules (nguồn DUY NHẤT,
// unit-test được). BadgeSystem.tsx cũng import trực tiếp từ đó — hết trùng ID.

export const ITEM_CATALOG = [
  { id: "skin_1", name: "Đại Pháp Sư Desmos", icon: "🧙‍♂️", type: "skin", price: 1500, effectClass: "shadow-[0_0_20px_#8b5cf6] animate-pulse text-purple-400 border-[#8b5cf6]" },
  { id: "skin_2", name: "Kiếm Khách SAT Cổ Đại", icon: "🗡️", type: "skin", price: 1800, effectClass: "shadow-[0_0_20px_#ef4444] text-red-400 border-[#ef4444]" },
  { id: "skin_3", name: "Đỉnh Phong Thủ Khoa", icon: "👑", type: "skin", price: 3000, effectClass: "shadow-[0_0_30px_#fbbf24] animate-bounce text-yellow-300 border-[#fbbf24]" },
  { id: "title_gold", name: "Vương Miện Trí Tuệ", icon: "👑", type: "skin", price: 3500, effectClass: "shadow-[0_0_30px_#fde047] text-yellow-200 border-[#fde047]" },
  { id: "theme_fire", name: "Áo Choàng Bóng Tối", icon: "🦇", type: "skin", price: 4000, effectClass: "shadow-[0_0_25px_#7c3aed] text-violet-300 border-[#7c3aed]" },
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
  /** Loại hook tiến độ (answer/vocab/exam). Optional cho tương thích dữ liệu cũ
   *  (quest lưu trước bản xoay vòng chưa có track — updateQuestProgress fallback
   *  match theo id q1/q2/q3). */
  track?: QuestTrack;
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
  /** Ngày (YYYY-MM-DD) của bộ daily hiện tại. Khi load mà != hôm nay → reset
   *  daily về progress 0/claimed false (nhiệm vụ ngày làm mới mỗi ngày). */
  date?: string;
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
  /** Đã hoàn tất bài test xếp lớp đầu vào chưa (diagnostic onboarding). */
  onboardingCompleted: boolean;
  coins: number;
  shields: number;
  maxPower: number;
  correctAnswersCountToday: number;
  pvpRank: number;
  pvpWinStreak: number;
  practiceStreak: number;
  /** 🔥 Chuỗi NGÀY học liên tiếp (server-authoritative, từ daily_snapshots).
   *  KHÁC practiceStreak (số câu đúng liên tiếp). Dẫn xuất, không persist client. */
  dayStreak: number;
  lastSpinDate: string | null;
  activePet: string | null;
  bookmarkedQuestions: string[];

  // Actions
  // 🔴 Economy server-authoritative (§9.1): coins/xp do SERVER quyết. Các hàm
  // grant (answer/exam) là ASYNC — số thưởng lấy từ response server, client
  // KHÔNG tự cộng. Các hàm spend gate trên coins đã đồng bộ rồi POST 'spend'.
  // ROOT A: phần thưởng câu luyện tập do /api/grade trao (server-authoritative).
  // Client gọi hàm này SAU grade để cập nhật streak/quest/HUD; truyền economy
  // mới (grade trả về) để đồng bộ coins/xp. KHÔNG gọi API tiền, KHÔNG gửi isCorrect.
  registerGradedResult: (isCorrect: boolean, economy?: { coins?: number; xp?: number; lastSpinDate?: string | null } | null) => { comboMultiplier: number };
  // Đồng bộ HUD (coins/xp) từ EconomyState mà server trả về. Dùng cho các luồng
  // chấm/thưởng SERVER-SIDE (thi: /api/exams/grade, ôn từ: /api/vocab) — client
  // KHÔNG tự tính số tiền, chỉ nhận state mới từ server rồi cập nhật hiển thị.
  syncServerEconomy: (economy: { coins?: number; xp?: number; lastSpinDate?: string | null } | null | undefined) => void;
  /** 🔥 Đồng bộ chuỗi ngày từ server (POST action:'streak'). Trả kết quả để trang
   *  gọi (đã ở trong ToastProvider) hiện toast ăn mừng khi đạt mốc. Server cộng
   *  xu mốc idempotent + đồng bộ số dư mới. */
  syncDayStreak: () => Promise<{ dayStreak: number; grantedCoins: number; milestonesReached: number[] }>;
  /** 🎁 Nhận thưởng đăng nhập mỗi ngày (server idempotent). Trả xu vừa nhận để
   *  trang chủ (trong ToastProvider) hiện toast. 0 nếu hôm nay đã nhận. */
  claimDailyLogin: () => Promise<{ grantedCoins: number }>;
  incrementCorrectAnswers: () => void;
  spinDailyWheel: () => Promise<{ success: boolean, message: string, rewardType: string }>;
  buyItem: (itemId: string, price: number) => BuyResult;
  // 🔴 Đổi xu lấy quà THẬT (Phase 2 Bước 3): server tra REWARDS lấy giá + trừ xu
  // ATOMIC + tạo phiếu fulfillment (/api/redeem). Client CHỈ gửi rewardId, KHÔNG
  // gửi số xu; đồng bộ số dư MỚI từ server. Trả kết quả để UI hiện toast.
  redeemReward: (rewardId: string) => Promise<{ success: boolean; message: string }>;
  spendCoins: (amount: number) => boolean;
  toggleBookmark: (questionId: string) => void;
  upgradeItem: (instanceId: string, useBua?: boolean) => { success: boolean, message: string };
  fightPvP: () => Promise<{ success: boolean, message: string, won: boolean }>;
  equipPet: (petId: string) => void;

  // Quest Actions
  updateQuestProgress: (track: QuestTrack, amount: number) => void;
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

/** Ngày local YYYY-MM-DD (chỉ để reset UI nhiệm vụ ngày — tiền vẫn do server
 *  quyết theo ngày server ở /api/economy). Dùng local để khớp cảm nhận "hôm nay"
 *  của học sinh; lệch múi giờ chỉ ảnh hưởng thời điểm nút quest mở lại. */
function clientToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const GamificationContext = createContext<GamificationState | undefined>(undefined);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  // State Groups (Hydration Schema)
  const [userStats, setUserStats] = useState<UserStats>({
    level: 1, xp: 0, coins: 100, streak: 0, shield: 0,
    maxPower: 50, correctAnswersCountToday: 0, pvpRank: 11, pvpWinStreak: 0,
    lastSpinDate: null, activePet: null
  });

  // 🔥 Chuỗi ngày học (server-authoritative, dẫn xuất — không persist client).
  const [dayStreak, setDayStreak] = useState(0);

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
  // Cờ diagnostic onboarding (từ /api/diagnostic). Mặc định true để KHÔNG nhá
  // banner trước khi biết chắc — chỉ bật banner khi fetch xác nhận chưa hoàn tất.
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load on mount: nền từ /api/save-data (streak/inventory/quests), nhưng
  // coins/xp/lastSpinDate LẤY TỪ /api/economy (server-authoritative), level
  // DẪN XUẤT từ /api/skill-tree (masteredCount). Fetch song song.
  useEffect(() => {
    async function loadData() {
      try {
        const [saveRes, ecoRes, treeRes, diagRes] = await Promise.all([
          fetch('/api/load-data'),
          fetch('/api/economy'),
          fetch('/api/skill-tree'),
          fetch('/api/diagnostic'),
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

          if (parsed.quests) {
            // Nhiệm vụ NGÀY XOAY VÒNG: cùng ngày → giữ nguyên (bảo toàn progress/
            // claimed); ngày mới (hoặc chưa có dấu ngày) → bộ MỚI cho hôm nay theo
            // hàm băm deterministic từ dayKey (mỗi ngày một biến thể khác → tươi
            // mới). Server vẫn quyết tiền claim (QUEST_REWARD dẫn xuất từ QUEST_POOL,
            // scope theo ngày ở saveQuestClaim) — client chỉ mở lại nút cho ngày mới.
            const today = clientToday();
            const { daily } = resolveDailyQuests(parsed.quests.daily ?? [], parsed.quests.date, today);
            setQuests({ ...parsed.quests, daily, date: today });
          }
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

        // 4) Diagnostic onboarding: bật banner nếu chưa hoàn tất. Fetch lỗi →
        //    giữ mặc định true (không nhá banner) để tránh dương tính giả.
        if (diagRes.ok) {
          const diag = await diagRes.json();
          setOnboardingCompleted(diag.completed === true);
        }

        // 5) 🔥 Chuỗi ngày học: KHÔNG fetch ở đây. Trang chủ (trong ToastProvider)
        //    là nơi DUY NHẤT gọi syncDayStreak() — vừa cập nhật số + số dư, vừa
        //    hiện toast ăn mừng khi đạt mốc. Gọi cả 2 nơi sẽ khiến grant idempotent
        //    ở lần đầu nuốt mốc → lần sau mất toast. Chip 🔥 chỉ ở trang chủ.
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

  // 🔥 Đồng bộ chuỗi ngày học từ server (POST action:'streak'). Server tính
  // chuỗi từ daily_snapshots + cộng xu mốc idempotent. Client chỉ nhận state
  // mới. Trả kết quả để trang gọi (đã trong ToastProvider) hiện toast ăn mừng.
  const syncDayStreak = async () => {
    try {
      const res = await fetch('/api/economy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'streak' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.dayStreak === 'number') setDayStreak(data.dayStreak);
        if (data.state) syncEconomy(data.state); // đồng bộ số dư nếu grant xu mốc
        return {
          dayStreak: typeof data.dayStreak === 'number' ? data.dayStreak : 0,
          grantedCoins: data.granted?.coins ?? 0,
          milestonesReached: Array.isArray(data.milestonesReached) ? data.milestonesReached : [],
        };
      }
    } catch (e) {
      console.error('Failed to sync day streak', e);
    }
    return { dayStreak: 0, grantedCoins: 0, milestonesReached: [] };
  };

  // 🎁 Nhận thưởng đăng nhập mỗi ngày (server idempotent 1 lần/ngày VN). Trả xu
  // vừa nhận (0 nếu hôm nay đã nhận) để trang chủ hiện toast. Mẫu như syncDayStreak.
  const claimDailyLogin = async () => {
    try {
      const res = await fetch('/api/economy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dailyLogin' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) syncEconomy(data.state); // đồng bộ số dư nếu vừa cộng xu
        return { grantedCoins: data.claimed ? (data.granted?.coins ?? 0) : 0 };
      }
    } catch (e) {
      console.error('Failed to claim daily login', e);
    }
    return { grantedCoins: 0 };
  };

  const incrementCorrectAnswers = () => {
    setUserStats(prev => ({ ...prev, correctAnswersCountToday: prev.correctAnswersCountToday + 1 }));
    updateQuestProgress('answer', 1);
  };

  // 🔴 ROOT A (2026-07-04): phần thưởng 1 câu luyện tập giờ do `/api/grade` quyết
  // (dựa trên đáp án lưu server + CAS answered:false→true) — client KHÔNG còn POST
  // số tiền/isCorrect. Hàm này CHỈ cập nhật streak/quest/HUD SAU khi grade đã trao
  // thưởng, và nhận `economy` mới từ grade để đồng bộ HUD. Trả comboMultiplier để
  // hiển thị (thuần cosmetic — số xu thật đã do server tính trong granted).
  const registerGradedResult = (
    isCorrect: boolean,
    economy?: { coins?: number; xp?: number; lastSpinDate?: string | null } | null
  ): { comboMultiplier: number } => {
    if (!isCorrect) {
      // Khiên Bảo Vệ Streak (shield_1): còn khiên → tiêu 1, GIỮ chuỗi; hết → về 0.
      // Cosmetic (chỉ cứu combo ×1.5, không phải vector tiền — xem rpg-rules.ts).
      setUserStats(prev => {
        const r = resolveStreakOnWrong(prev.streak, prev.shield);
        return { ...prev, streak: r.streak, shield: r.shield };
      });
      return { comboMultiplier: 1.0 };
    }

    const newStreak = userStats.streak + 1;
    const comboMultiplier = newStreak >= 5 ? 1.5 : 1.0;
    setUserStats(prev => ({ ...prev, streak: newStreak }));
    incrementCorrectAnswers();
    if (economy) syncEconomy(economy);
    return { comboMultiplier };
  };

  // 🔴 ROOT A follow-up (đường thi): phần thưởng bài THI giờ do server chấm +
  // trao ở /api/exams/grade (thi) và /api/vocab (ôn từ) — client KHÔNG còn POST
  // `/api/economy {action:'exam'}` với correctCount tự khai (faucet đã đóng).
  // Trang thi/ôn tự gọi endpoint mới rồi gọi hàm này để đồng bộ HUD từ state server.
  const syncServerEconomy = (
    economy: { coins?: number; xp?: number; lastSpinDate?: string | null } | null | undefined
  ) => {
    if (economy) syncEconomy(economy);
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

  const buyItem = (itemId: string, price: number): BuyResult => {
    // resolveBuy (thuần) quyết: đủ xu? · đồ vĩnh viễn đã sở hữu? · maxPower/shield
    // cộng thêm. Equipment/skin mua 1 LẦN (chống bơm maxPower ảo bằng mua lại);
    // consumable mua lặp. maxPower là cosmetic (không bơm lực PvP — xem rpg-rules).
    const item = ITEM_CATALOG.find(i => i.id === itemId);
    const type = item?.type ?? 'consumable';
    const owned = inventory.filter((i): i is string => typeof i === 'string');
    const decision = resolveBuy({ id: itemId, type, price }, userStats.coins, owned);

    if (!decision.ok) {
      return { success: false, reason: decision.reason };
    }

    setUserStats(prev => ({
      ...prev,
      coins: prev.coins - price,
      shield: prev.shield + decision.shieldDelta,
      maxPower: prev.maxPower + decision.maxPowerDelta,
    }));
    postSpend(price);

    setInventory(prev => [...prev, itemId]);

    if (itemId.includes("da_cuong_hoa")) {
      setInventory(prev => [...prev, { instanceId: `eq_${Date.now()}`, itemId: "da_cuong_hoa", name: "Đá Cường Hóa", tier: "Đồng", level: 1, icon: "🪨", isBound: true }]);
    }

    return { success: true, maxPowerGained: decision.maxPowerDelta };
  };

  // 🔴 Đổi xu lấy quà THẬT (Phase 2 Bước 3). KHÁC buyItem (item ẢO, optimistic):
  // quà thật trừ xu ATOMIC ở server + tạo phiếu fulfillment. Client KHÔNG tự trừ
  // (không optimistic) — chờ server xác nhận rồi đồng bộ số dư MỚI từ response.
  const redeemReward = async (rewardId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Đồng bộ số dư MỚI từ server (server-authoritative — không tự trừ).
        if (typeof data.coins === 'number') {
          setUserStats(prev => ({ ...prev, coins: data.coins }));
        }
        return { success: true, message: data.message ?? 'Đổi quà thành công!' };
      }
      return { success: false, message: data?.error ?? 'Không thể đổi quà lúc này.' };
    } catch (e) {
      console.error('Failed to redeem reward', e);
      return { success: false, message: 'Lỗi kết nối, vui lòng thử lại sau.' };
    }
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

  const upgradeItem = (instanceId: string, useBua: boolean = false) => {
    const itemIndex = inventory.findIndex(i => typeof i === 'object' && i.instanceId === instanceId);
    if (itemIndex === -1) return { success: false, message: "Không tìm thấy trang bị!" };

    const item = inventory[itemIndex] as Equipment;
    const { coins: costCoins } = getForgeCost(item.tier, item.level);

    if (userStats.coins < costCoins) {
      return { success: false, message: `Không đủ ${costCoins} Xu để cường hóa!` };
    }

    setUserStats(prev => ({ ...prev, coins: prev.coins - costCoins }));
    postSpend(costCoins);

    // Bùa Bảo Hộ tái dùng Khiên Bảo Vệ Streak (shield): bật + còn khiên → fail thì
    // giữ nguyên cấp, tiêu 1 khiên. Helper trả buaUsed để context trừ shield.
    const hasBua = userStats.shield > 0;
    const result = attemptUpgrade(item.tier, item.level, useBua, hasBua);

    const newInventory = [...inventory];
    newInventory[itemIndex] = { ...item, level: result.newLevel };
    setInventory(newInventory);

    if (result.success) {
      setUserStats(prev => ({ ...prev, maxPower: prev.maxPower + 15 }));
    }
    if (result.buaUsed) {
      setUserStats(prev => ({ ...prev, shield: Math.max(0, prev.shield - 1) }));
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
    // Chỉ đổi linh thú đang theo (cosmetic). TRƯỚC ĐÂY cộng dồn +50 maxPower MỖI
    // lần đổi → bơm lực ảo vô hạn (đổi qua-lại nhiều lần). Pet là bạn đồng hành
    // thẩm mỹ, không cộng chỉ số (mô tả buff đã bỏ khỏi pets/page.tsx).
    setUserStats(prev => ({ ...prev, activePet: petId }));
  };

  // Cập nhật tiến độ quest theo TRACK (answer/vocab/exam) — vì id quest giờ xoay
  // vòng theo ngày (q1/q1b/q1c...), không còn cố định. Fallback: quest dữ liệu cũ
  // chưa có track → match theo id gốc q1/q2/q3 (tương thích ngược).
  const TRACK_LEGACY_ID: Record<QuestTrack, string> = { answer: 'q1', vocab: 'q2', exam: 'q3' };
  const updateQuestProgress = (track: QuestTrack, amount: number) => {
    setQuests(prev => {
      const legacyId = TRACK_LEGACY_ID[track];
      const updatedDaily = prev.daily.map(q =>
        (q.track === track || (!q.track && q.id === legacyId))
          ? { ...q, progress: Math.min(q.target, q.progress + amount) }
          : q
      );
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
  const unlockedBadges = useMemo(
    () => computeUnlockedBadges({ level: userStats.level, coins: userStats.coins, maxPower: userStats.maxPower }),
    [userStats.level, userStats.coins, userStats.maxPower]
  );

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
      onboardingCompleted,
      coins: userStats.coins,
      shields: userStats.shield,
      maxPower: userStats.maxPower,
      correctAnswersCountToday: userStats.correctAnswersCountToday,
      pvpRank: userStats.pvpRank,
      pvpWinStreak: userStats.pvpWinStreak,
      practiceStreak: userStats.streak,
      dayStreak,
      lastSpinDate: userStats.lastSpinDate,
      activePet: userStats.activePet,
      bookmarkedQuestions: practiceQuestion.bookmarkedQuestions || [],

      unlockedBadges,

      incrementCorrectAnswers, registerGradedResult, syncServerEconomy, syncDayStreak, claimDailyLogin, spinDailyWheel, buyItem, redeemReward, spendCoins, toggleBookmark, upgradeItem, fightPvP, equipPet,
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
