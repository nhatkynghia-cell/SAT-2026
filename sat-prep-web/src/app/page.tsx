'use client';

import { useEffect, useRef } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { BadgeSystem } from '@/components/BadgeSystem';
import { AITutoring } from '@/components/AITutoring';
import { MistakeNotebook } from '@/components/MistakeNotebook';
import { DiagnosticBanner } from '@/components/DiagnosticBanner';

export default function Home() {
  const {
    level, masteredCount, totalNodes, coins, shields, maxPower, dayStreak,
    syncDayStreak,
    soundEnabled, setSoundEnabled,
    focusMode, setFocusMode,
    hideBanner, setHideBanner,
    learningMode
  } = useGamification();

  const { showToast } = useToast();

  // 🔥 Đồng bộ chuỗi ngày học 1 lần khi vào trang chủ. Đây là nơi DUY NHẤT gọi
  // (trong ToastProvider) → cập nhật số + hiện toast ăn mừng khi vừa đạt mốc.
  // Server grant xu mốc idempotent nên gọi lại các lần sau chỉ cập nhật số, 0 xu.
  const streakSyncedRef = useRef(false);
  useEffect(() => {
    if (streakSyncedRef.current) return;
    streakSyncedRef.current = true;
    async function sync() {
      const r = await syncDayStreak();
      if (r.grantedCoins > 0 && r.milestonesReached.length > 0) {
        const topMilestone = Math.max(...r.milestonesReached);
        showToast(`🔥 Chuỗi ${topMilestone} ngày! Nhận thưởng ${r.grantedCoins} Xu. Giữ lửa nhé!`, 'success');
      }
    }
    sync();
  }, [syncDayStreak, showToast]);


  // Thanh tiến trình giờ phản ánh ĐỘ PHỦ KỸ NĂNG (số skill đã tinh thông),
  // KHÔNG còn XP phẳng (§10 — bỏ Level phẳng).
  const masteryPercent = totalNodes > 0 ? Math.min(100, (masteredCount / totalNodes) * 100) : 0;

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
                {level >= 15 ? "Thần Thoại Học Thuật" : level >= 11 ? "Đỉnh Phong Thủ Khoa" : level >= 7 ? "Đại Pháp Sư Cambridge" : level >= 4 ? "Kiếm Khách Cambridge" : "Tân Sinh"}
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

      {/* COMPONENT 1: Hộp Quà Huy Hiệu (Badges) */}
      {!focusMode && <BadgeSystem />}

      {/* Streamlit Divider */}
      {!focusMode && <hr className="border-[#262730] my-6" />}

      {/* COMPONENT 2: AI Tutoring (Luyện Câu Hỏi Mới) / Sổ tay ôn câu sai */}
      {learningMode === 'ai' ? <AITutoring /> : <MistakeNotebook />}

    </div>
  );
}
