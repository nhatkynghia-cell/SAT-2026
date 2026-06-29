'use client';

import { useState } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { cn } from '@/lib/utils';

// Static Data for UI mockup (Logic sẽ được nối với DB ở Phase 2)
const BADGES = [
  { id: "b_1", title: "Tân Binh Xuất Thế", req_desc: "Cần đạt Cấp 5", icon: "🥉", category: "Tu Vi" },
  { id: "b_2", title: "Kiếm Khách SAT", req_desc: "Cần đạt Cấp 15", icon: "🗡️", category: "Tu Vi" },
  { id: "b_3", title: "Đại Pháp Sư SAT", req_desc: "Cần đạt Cấp 30", icon: "🧙‍♂️", category: "Tu Vi" },
  { id: "b_4", title: "Đỉnh Phong Thủ Khoa", req_desc: "Cần đạt Cấp 60", icon: "👑", category: "Tu Vi" },
  { id: "b_5", title: "Thần Thoại Học Thuật", req_desc: "Cần đạt Cấp 100", icon: "🌟", category: "Tu Vi" },
  
  { id: "l_1", title: "Sức Mạnh Đánh Thức", req_desc: "Cần 100 Lực chiến", icon: "🔥", category: "Lực Chiến" },
  { id: "l_2", title: "Kẻ Phá Vỡ Giới Hạn", req_desc: "Cần 300 Lực chiến", icon: "⚔️", category: "Lực Chiến" },
  { id: "l_3", title: "💥 Đòn Đánh Chí Mạng", req_desc: "Cần 500 Lực chiến", icon: "💥", category: "Lực Chiến" },
  { id: "l_4", title: "Chiến Thần Hủy Diệt", req_desc: "Cần 1000 Lực chiến", icon: "🌋", category: "Lực Chiến" },
  { id: "l_5", title: "Chúa Tể Sức Mạnh", req_desc: "Cần 2000 Lực chiến", icon: "⚡", category: "Lực Chiến" },
  
  { id: "c_1", title: "🏹 Thợ Săn Tập Sự", req_desc: "Diệt 10 Boss", icon: "🏹", category: "Chiến Tích" },
  { id: "c_2", title: "Sát Thần Giờ Vàng", req_desc: "Diệt 5 Boss Vàng", icon: "👹", category: "Chiến Tích" },
  { id: "c_3", title: "🛡️ Chiến Binh Kiên Trì", req_desc: "Chuỗi 30 ngày", icon: "🛡️", category: "Chiến Tích" },
  { id: "c_4", title: "🌌 Đại Sứ Bền Bỉ", req_desc: "Chuỗi 180 ngày", icon: "🌌", category: "Chiến Tích" },
  { id: "c_5", title: "💰 Phú Hộ Học Thuật", req_desc: "Tích lũy 500 Xu", icon: "💰", category: "Chiến Tích" }
];

export function BadgeSystem() {
  const { unlockedBadges } = useGamification();
  const [activeTab, setActiveTab] = useState("Tu Vi");
  
  const tabs = [
    { id: "Tu Vi", label: "🎖️ Huy Hiệu Tu Vi" },
    { id: "Lực Chiến", label: "⚔️ Huy Hiệu Lực Chiến" },
    { id: "Chiến Tích", label: "🏆 Huy Hiệu Chiến Tích" }
  ];

  return (
    <div className="my-6">
      <h3 className="text-[20px] font-bold text-white mb-2">🎁 HỘP QUÀ HUY HIỆU</h3>
      <p className="text-[14px] text-gray-300 mb-6">Thắp sáng huy hiệu bằng cách nâng cao sức mạnh và cày cuốc phó bản!</p>

      {/* Streamlit-like Tabs */}
      <div className="flex gap-1 border-b border-[#262730] mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-[14px] font-medium transition-colors border-b-2",
              activeTab === tab.id 
                ? "border-[#ff4b4b] text-[#ff4b4b]" 
                : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid of Badges */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {BADGES.filter(b => b.category === activeTab).map((badge, idx) => {
          const isUnlocked = unlockedBadges.includes(badge.id);
          if (isUnlocked) {
            return (
              <div key={idx} className="flex flex-col items-center">
                <div 
                  className="w-full flex flex-col items-center justify-center p-3 rounded-lg border-2 border-[#10b981] bg-gradient-to-br from-[#064e3b] to-[#022c22] transform scale-105 transition-all shadow-[0_0_15px_rgba(16,185,129,0.5)] min-h-[110px]"
                >
                  <div className="text-[28px]">{badge.icon}</div>
                  <div className="text-[13px] font-bold text-white mt-1 text-center leading-tight">{badge.title}</div>
                  <div className="text-[11px] text-[#34d399] mt-0.5">Đã mở 🔓</div>
                </div>
                {/* Button Nhận Quà Mock */}
                <button className="mt-2 text-xs font-bold bg-[#262730] border border-[#404353] hover:border-[#fbbf24] hover:text-[#fbbf24] text-white py-1 px-3 rounded w-full transition-colors">
                  🎁 Nhận Quà
                </button>
              </div>
            );
          } else {
            return (
              <div key={idx} className="flex flex-col items-center">
                <div 
                  className="w-full flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-[#30363d] bg-[#1e293b]/50 opacity-40 min-h-[110px]"
                >
                  <div className="text-[28px] grayscale">{badge.icon}</div>
                  <div className="text-[13px] font-bold text-[#94a3b8] mt-1 text-center leading-tight">{badge.title}</div>
                  <div className="text-[11px] text-[#808a9d] mt-0.5">{badge.req_desc}</div>
                </div>
                <div className="mt-2 text-[12px] text-[#64748b] text-center w-full">
                  🔒 Chưa Đạt
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}
