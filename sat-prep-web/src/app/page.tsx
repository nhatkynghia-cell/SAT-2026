'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { getSkill } from '@/lib/skill-taxonomy';
import { BadgeSystem } from '@/components/BadgeSystem';
import { AITutoring } from '@/components/AITutoring';
import { MistakeNotebook } from '@/components/MistakeNotebook';
import { DiagnosticBanner } from '@/components/DiagnosticBanner';

interface ScorePrediction {
  total: number;
  confidence: 'low' | 'medium' | 'high';
  totalAttempts: number;
  focusSkills: Array<{ id: string; label: string; score: number; subject?: string }>;
  detailLocked?: boolean;
}

function practiceRouteForSkill(skillId: string): string {
  const moduleType = getSkill(skillId)?.moduleType;
  if (moduleType === 'vocab') return '/vocab';
  if (moduleType === 'literature') return '/literature';
  if (moduleType === 'desmos') return '/desmos';
  return '/math';
}

export default function Home() {
  const {
    level, masteredCount, totalNodes, coins, shields, maxPower, dayStreak,
    syncDayStreak, claimDailyLogin,
    soundEnabled, setSoundEnabled,
    focusMode, setFocusMode,
    hideBanner, setHideBanner,
    learningMode,
    onboardingCompleted,
    gamificationLoaded
  } = useGamification();

  const { showToast } = useToast();

  const [todayPlan, setTodayPlan] = useState<ScorePrediction | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [todayItems, setTodayItems] = useState<Array<{ kind: string; title: string; href: string; rationale: string }>>([]);
  const [weeklyDelta, setWeeklyDelta] = useState<number | null>(null);

  // 🔥 Đồng bộ chuỗi ngày học 1 lần khi vào trang chủ. Đây là nơi DUY NHẤT gọi
  // (trong ToastProvider) → cập nhật số + hiện toast ăn mừng khi vừa đạt mốc.
  // Server grant xu mốc idempotent nên gọi lại các lần sau chỉ cập nhật số, 0 xu.
  const streakSyncedRef = useRef(false);
  useEffect(() => {
    if (!gamificationLoaded) return;
    if (streakSyncedRef.current) return;
    streakSyncedRef.current = true;
    async function sync() {
      const r = await syncDayStreak();
      if (r.grantedCoins > 0 && r.milestonesReached.length > 0) {
        const topMilestone = Math.max(...r.milestonesReached);
        showToast(`🔥 Chuỗi ${topMilestone} ngày! Nhận thưởng ${r.grantedCoins} Xu. Giữ lửa nhé!`, 'success');
      }
      // 🎁 Thưởng đăng nhập mỗi ngày (server idempotent 1 lần/ngày VN).
      const login = await claimDailyLogin();
      if (login.grantedCoins > 0) {
        showToast(`🎁 Điểm danh hôm nay: +${login.grantedCoins} Xu! Mai quay lại nhé.`, 'success');
      }
    }
    sync();
  }, [syncDayStreak, claimDailyLogin, showToast, gamificationLoaded]);
  useEffect(() => {
    let cancelled = false;
    async function loadTodayPlan() {
      try {
        const res = await fetch('/api/score');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTodayPlan(data);
      } catch (e) {
        console.error('Không tải được kế hoạch hôm nay', e);
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    }
    loadTodayPlan();
    return () => { cancelled = true; };
  }, []);

  // Kế hoạch hôm nay 3 mục (due SRS + skill yếu nhất + stamina) + mastery delta tuần,
  // từ /api/today (core loop miễn phí). Lỗi → giữ rỗng, không vỡ trang chủ.
  useEffect(() => {
    let cancelled = false;
    async function loadToday() {
      try {
        const res = await fetch('/api/today');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data?.plan?.items)) setTodayItems(data.plan.items);
        if (typeof data?.weeklyDelta === 'number') setWeeklyDelta(data.weeklyDelta);
      } catch (e) {
        console.error('Không tải được /api/today', e);
      }
    }
    loadToday();
    return () => { cancelled = true; };
  }, []);


  // Thanh tiến trình giờ phản ánh ĐỘ PHỦ KỸ NĂNG (số skill đã tinh thông),
  // KHÔNG còn XP phẳng (§10 — bỏ Level phẳng).
  const masteryPercent = totalNodes > 0 ? Math.min(100, (masteredCount / totalNodes) * 100) : 0;
  const planFocusSkill = todayPlan?.focusSkills?.[0];
  const hasPracticeData = (todayPlan?.totalAttempts ?? 0) > 0;
  const primaryPlanHref = planFocusSkill ? practiceRouteForSkill(planFocusSkill.id) : onboardingCompleted ? '/math' : '/diagnostic';
  const primaryPlanLabel = planFocusSkill ? `Luyện ngay: ${planFocusSkill.label}` : onboardingCompleted ? 'Bắt đầu luyện 10 câu' : 'Làm diagnostic 5 phút';

  return (
    <div className="space-y-8 animate-in fade-in duration-700 relative">

      {/* CÁC NÚT ĐIỀU KHIỂN GIAO DIỆN (GÓC PHẢI) */}
      <div className="flex justify-end gap-6 items-center mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} className="toggle-checkbox" />
          <span className="text-sm text-gray-300">🔊 Âm thanh</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={focusMode} onChange={(e) => setFocusMode(e.target.checked)} className="toggle-checkbox" />
          <span className="text-sm text-gray-300">📺 Tập trung</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={hideBanner} onChange={(e) => setHideBanner(e.target.checked)} className="toggle-checkbox" />
          <span className="text-sm text-gray-300">🙈 Ẩn Banner</span>
        </label>
      </div>

      {focusMode && (
        <div className="mb-4">
          <button onClick={() => setFocusMode(false)} className="bg-[#262730] hover:bg-[#333] text-white px-4 py-2 rounded text-sm transition-colors border border-[#404353]">
            ⬅️ Thoát chế độ tập trung (Hiện lại Menu)
          </button>
        </div>
      )}

      {/* Gợi ý làm bài test xếp lớp (chỉ hiện khi chưa hoàn tất onboarding) */}
      {!focusMode && <DiagnosticBanner />}

      {/* Dynamic Banner - Render Exactly like Streamlit math-academy-header */}
      {!hideBanner && !focusMode && (
        <div className="math-academy-header epic-shake-active">
          <div className="math-title-container">
            <div className="math-icon">🚀</div>
            <div>
              <h1 className="math-title">ÔN LUYỆN HẰNG NGÀY</h1>
              <p className="math-subtitle">Cày cuốc chăm chỉ, tương lai rộng mở!</p>
            </div>
          </div>

          <div className="rpg-hud-container">
            <div className="hud-row" style={{ marginBottom: "2px" }}>
              <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "#1e293b", border: "2px solid #64748b", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "24px" }}>
                👤
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                <div className="hud-row">
                  <div style={{ fontSize: "11px", color: "#e2e8f0", width: "50px" }}><b>Lv.{level}</b></div>
                  <div style={{ flex: 1, background: "#1e293b", height: "4px", borderRadius: "2px", overflow: "hidden", marginRight: "5px" }}>
                    <div style={{ background: "#ef4444", width: `${masteryPercent}%`, height: "100%", transition: "width 0.5s ease" }}></div>
                  </div>
                  <div style={{ fontSize: "9px", color: "#94a3b8", width: "45px", textAlign: "right" }}>{masteredCount}/{totalNodes}</div>
                </div>
                <div className="hud-row">
                  <div style={{ fontSize: "11px", color: "#a5b4fc", width: "50px" }}><b>MP</b></div>
                  <div style={{ flex: 1, background: "#1e293b", height: "4px", borderRadius: "2px", overflow: "hidden", marginRight: "5px" }}>
                    <div style={{ background: "linear-gradient(90deg, #6366f1, #a855f7)", width: "100%", height: "100%" }}></div>
                  </div>
                  <div style={{ fontSize: "9px", color: "#94a3b8", width: "45px", textAlign: "right" }}>100/100</div>
                </div>
              </div>
            </div>

            <div className="hud-row" style={{ background: "rgba(30,41,59,0.5)", borderRadius: "6px", padding: "4px 8px" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#fbbf24" }}>
                💰 {coins} <span style={{ fontWeight: "normal", color: "#cbd5e1", fontSize: "10px" }}>Coins</span>
              </div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#f87171" }}>
                🛡️ {shields} <span style={{ fontWeight: "normal", color: "#cbd5e1", fontSize: "10px" }}>Khiên</span>
              </div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#fb923c" }} title="Chuỗi ngày học liên tiếp">
                🔥 {dayStreak} <span style={{ fontWeight: "normal", color: "#cbd5e1", fontSize: "10px" }}>ngày</span>
              </div>
            </div>

            <div className="hud-row" style={{ justifyContent: "flex-start", gap: "4px" }}>
              <span className="tag-pill" style={{ background: "rgba(59,130,246,0.2)", color: "#60a5fa", border: "1px solid #3b82f6" }}>
                {level >= 15 ? "Thần Thoại Học Thuật" : level >= 11 ? "Đỉnh Phong Thủ Khoa" : level >= 7 ? "Đại Pháp Sư SAT" : level >= 4 ? "Kiếm Khách SAT" : "Tân Sinh"}
              </span>
              <span className="tag-pill" style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc", border: "1px solid #a855f7" }}>🏆 Tân thủ học thuật</span>
              <span className="tag-pill" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid #ef4444" }}>⚔️ {maxPower >= 2000 ? "Chúa Tể Sức Mạnh" : maxPower >= 1000 ? "Chiến Thần Hủy Diệt" : maxPower >= 500 ? "Đòn Đánh Chí Mạng" : maxPower >= 300 ? "Kẻ Phá Vỡ Giới Hạn" : maxPower >= 100 ? "Sức Mạnh Đánh Thức" : "Sức Mạnh Cấp 1"}</span>
            </div>

            <div style={{ fontSize: "10px", color: "#94a3b8", textAlign: "center", marginTop: "2px" }}>
              🐾 Chưa đồng hành Linh Thú
            </div>
          </div>
        </div>
      )}
      
      {/* Streamlit Divider */}
      <hr className="border-[#262730] my-6" />

      {!focusMode && (
        <section className="bg-gradient-to-br from-[#10233a] to-[#111827] border border-blue-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(59,130,246,0.12)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Kế hoạch hôm nay</div>
              <h2 className="text-2xl font-black text-white">
                {planLoading ? 'Đang dựng lộ trình cá nhân...' : planFocusSkill ? 'Tập trung 1 kỹ năng yếu nhất' : onboardingCompleted ? 'Giữ nhịp luyện tập hôm nay' : 'Bắt đầu bằng diagnostic 5 phút'}
              </h2>
              <p className="text-sm text-[#cbd5e1] max-w-2xl">
                {planFocusSkill
                  ? `Ưu tiên ${planFocusSkill.label} (mastery ${planFocusSkill.score}/100). Làm một phiên ngắn rồi quay lại xem mastery delta.`
                  : onboardingCompleted
                    ? 'Bạn đã có nền tảng ban đầu. Làm 10 câu luyện tập để app cập nhật điểm dự đoán và gợi ý skill kế tiếp.'
                    : 'Hoàn thành bài xếp lớp để app biết điểm mạnh/yếu, dự đoán điểm SAT và tạo lộ trình luyện phù hợp.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 lg:items-center">
              <Link href={primaryPlanHref} className="text-center bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 text-[#78350f] font-black px-6 py-3 rounded-xl shadow-lg">
                🎯 {primaryPlanLabel}
              </Link>
              <Link href="/dashboard" className="text-center bg-[#0f172a] hover:bg-[#1e293b] text-blue-200 border border-blue-500/30 font-bold px-5 py-3 rounded-xl">
                📊 Xem tiến bộ
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            <div className="bg-[#0f172a]/80 border border-[#334155] rounded-xl p-4">
              <div className="text-xs text-gray-400">Bước 1</div>
              <div className="font-bold text-white">{onboardingCompleted ? 'Đã xếp lớp' : 'Diagnostic'}</div>
              <div className="text-xs text-gray-500 mt-1">{onboardingCompleted ? 'Dữ liệu đầu vào đã sẵn sàng.' : '5–10 phút để cá nhân hóa lộ trình.'}</div>
            </div>
            <div className="bg-[#0f172a]/80 border border-[#334155] rounded-xl p-4">
              <div className="text-xs text-gray-400">Bước 2</div>
              <div className="font-bold text-white">Practice đúng skill</div>
              <div className="text-xs text-gray-500 mt-1">{planFocusSkill ? planFocusSkill.label : 'Luyện Toán / Đọc-Viết để mở gợi ý.'}</div>
            </div>
            <div className="bg-[#0f172a]/80 border border-[#334155] rounded-xl p-4">
              <div className="text-xs text-gray-400">Bước 3</div>
              <div className="font-bold text-white">Mastery delta</div>
              <div className="text-xs text-gray-500 mt-1">
                {weeklyDelta !== null
                  ? `Tiến độ tuần: ${weeklyDelta >= 0 ? '+' : ''}${weeklyDelta} điểm SAT so với 7 ngày trước.`
                  : hasPracticeData
                    ? `Điểm dự đoán hiện tại: ${todayPlan?.total ?? '—'}`
                    : 'Dashboard sẽ hiện khi có câu trả lời đầu tiên.'}
              </div>
            </div>
          </div>

          {/* Kế hoạch hôm nay — 3 mục học (due SRS + skill yếu + stamina) từ /api/today */}
          {todayItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {todayItems.map((it, i) => (
                <Link
                  key={`${it.kind}-${i}`}
                  href={it.href}
                  className="block bg-[#0f172a]/80 hover:bg-[#111c30] border border-[#334155] hover:border-[#3b82f6]/60 rounded-xl p-4 transition-colors"
                >
                  <div className="text-xs text-blue-300 font-bold">
                    {it.kind === 'due' ? '🔁 Ôn đến hạn' : it.kind === 'weakness' ? '🎯 Luyện điểm yếu' : '⚡ Stamina'}
                  </div>
                  <div className="font-bold text-white mt-1">{it.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{it.rationale}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* COMPONENT 1: Hộp Quà Huy Hiệu (Badges) */}
      {!focusMode && <BadgeSystem />}

      {/* Streamlit Divider */}
      {!focusMode && <hr className="border-[#262730] my-6" />}

      {/* COMPONENT 2: AI Tutoring (Luyện Câu Hỏi Mới) / Sổ tay ôn câu sai */}
      {learningMode === 'ai' ? <AITutoring /> : <MistakeNotebook />}

    </div>
  );
}
