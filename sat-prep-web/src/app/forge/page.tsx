'use client';

import { useState } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { getForgeCost, type Equipment } from '@/helpers/forge';

export default function ForgePage() {
  const { inventory, upgradeItem, shields } = useGamification();
  const [log, setLog] = useState<{message: string, success: boolean} | null>(null);
  // Bùa Bảo Hộ: dùng Khiên Bảo Vệ Streak (mua ở shop) để chặn rớt cấp khi fail.
  const [useBua, setUseBua] = useState(false);

  const equipmentList = inventory.filter(
    (item): item is Equipment => typeof item === 'object' && 'instanceId' in item
  );

  const handleUpgrade = (instanceId: string) => {
    // Chỉ áp bùa khi bật toggle VÀ còn khiên (tránh gửi useBua vô nghĩa).
    const result = upgradeItem(instanceId, useBua && shields > 0);
    setLog(result);
    setTimeout(() => setLog(null), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">⚒️</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #fca5a5, #ef4444)", WebkitBackgroundClip: "text" }}>LÒ RÈN CHIẾN BINH</h1>
            <p className="math-subtitle text-red-200">Đúc kết kinh nghiệm thành sức mạnh hủy diệt!</p>
          </div>
        </div>
      </div>
      
      {log && (
        <div className={`p-4 rounded text-center font-bold ${log.success ? 'bg-green-900 text-green-300 border-green-500' : 'bg-red-900 text-red-300 border-red-500'} border animate-bounce`}>
          {log.message}
        </div>
      )}

      {/* Bùa Bảo Hộ — dùng Khiên Bảo Vệ Streak để chặn rớt cấp khi cường hóa fail */}
      <div className="bg-[#1b2533] p-5 rounded-xl border border-[#334155] flex items-center justify-between gap-4">
        <div>
          <div className="font-bold text-white flex items-center gap-2">🛡️ Bùa Bảo Hộ</div>
          <p className="text-sm text-gray-400">Bật để dùng 1 Khiên Bảo Vệ mỗi lần cường hóa thất bại — giữ nguyên cấp, không rớt. Hiện có: <span className="font-bold text-[#fbbf24]">{shields}</span> khiên.</p>
        </div>
        <button
          onClick={() => setUseBua(v => !v)}
          disabled={shields === 0}
          className={`px-5 py-2 rounded-full font-bold text-sm transition-colors shrink-0 ${
            shields === 0
              ? 'bg-[#1e293b] text-gray-500 cursor-not-allowed'
              : useBua
              ? 'bg-[#10b981] text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              : 'bg-[#334155] text-gray-300 hover:bg-[#475569]'
          }`}
        >
          {shields === 0 ? 'Hết khiên' : useBua ? 'ĐANG BẬT' : 'ĐANG TẮT'}
        </button>
      </div>

      <div className="bg-[#1b2533] p-8 rounded-xl border border-[#ef4444] shadow-[0_0_20px_rgba(239,68,68,0.2)]">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Trang Bị Của Bạn</h2>

        {equipmentList.length === 0 ? (
          <p className="text-gray-400 text-center">Bạn chưa có trang bị nào để cường hóa.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {equipmentList.map(item => {
              const { coins } = getForgeCost(item.tier, item.level);
              
              // CSS Glow Effect for high level Forge items
              let glowClass = "";
              if (item.level >= 10) glowClass = "shadow-[0_0_30px_#facc15] border-[#facc15] animate-pulse";
              else if (item.level >= 5) glowClass = "shadow-[0_0_15px_#3b82f6] border-[#3b82f6]";

              return (
                <div key={item.instanceId} className={`bg-[#0e1117] border-[#334155] border p-4 rounded flex justify-between items-center transition-all ${glowClass}`}>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{item.icon}</div>
                    <div>
                      <div className="font-bold text-white">{item.name} <span className="text-red-400">+{item.level}</span></div>
                      <div className="text-sm text-gray-400">Hạng: {item.tier} | Cần: 💰 {coins} Xu</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleUpgrade(item.instanceId)}
                    className="bg-[#ef4444] hover:bg-[#dc2626] text-white px-4 py-2 rounded font-bold transition-colors">
                    Đập Đồ
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
