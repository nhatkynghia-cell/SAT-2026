'use client';

import { useState } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { BadgeSystem } from '@/components/BadgeSystem';
import { AITutoring } from '@/components/AITutoring';
import { MistakeNotebook } from '@/components/MistakeNotebook';

export default function Home() {
  const { 
    level, currentXp, maxXp, coins, shields, maxPower, 
    levelUpAlert, clearLevelUpAlert,
    soundEnabled, setSoundEnabled,
    focusMode, setFocusMode,
    hideBanner, setHideBanner,
    learningMode
  } = useGamification();
  

  const xpPercent = Math.min(100, (currentXp / maxXp) * 100);

  // Temporary fix for Next.js missing dynamic CSS imports via dynamic JSX
  const levelUpEffect = levelUpAlert ? (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center bg-black/50" onClick={clearLevelUpAlert}>
      <div className="bg-[#1b2533] p-8 rounded-2xl border-4 border-[#fbbf24] shadow-[0_0_50px_#fbbf24] text-center animate-bounce cursor-pointer">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-black text-white mb-2">CHÚC MỪNG!</h2>
        <p className="text-xl text-[#fbbf24]">Bạn đã thăng cấp lên Level {level}!</p>
        <p className="text-sm text-gray-400 mt-4">(Bấm để tiếp tục)</p>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 relative">
      {levelUpEffect}

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
                    <div style={{ background: "#ef4444", width: `${xpPercent}%`, height: "100%", transition: "width 0.5s ease" }}></div>
                  </div>
                  <div style={{ fontSize: "9px", color: "#94a3b8", width: "45px", textAlign: "right" }}>{currentXp}/{maxXp}</div>
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
            </div>

            <div className="hud-row" style={{ justifyContent: "flex-start", gap: "4px" }}>
              <span className="tag-pill" style={{ background: "rgba(59,130,246,0.2)", color: "#60a5fa", border: "1px solid #3b82f6" }}>
                {level >= 100 ? "Thần Thoại Học Thuật" : level >= 60 ? "Đỉnh Phong Thủ Khoa" : level >= 30 ? "Đại Pháp Sư SAT" : level >= 15 ? "Kiếm Khách SAT" : "Tân Sinh"}
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
