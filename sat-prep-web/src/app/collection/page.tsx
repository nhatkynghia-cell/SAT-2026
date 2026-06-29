'use client';
import { useGamification } from '@/context/GamificationContext';

export default function CollectionPage() {
  const { inventory, level } = useGamification();

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #4c1d95 0%, #1e1b4b 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">🗺️</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #e879f9, #c084fc)", WebkitBackgroundClip: "text" }}>BẢN ĐỒ SƯU TẬP</h1>
            <p className="math-subtitle text-purple-200">Lưu giữ những cổ vật và vinh quang bạn đạt được!</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { name: "Cúp Vô Địch Toán", icon: "🏆", locked: level < 5 },
          { name: "Sách Cổ Ngữ", icon: "📖", locked: level < 10 },
          { name: "Kiếm Ánh Sáng", icon: "⚔️", locked: level < 20 },
          { name: "Vương Miện Trí Tuệ", icon: "👑", locked: !inventory.includes('title_gold') },
          { name: "Khiên Rồng", icon: "🐉", locked: !inventory.includes('shield_1') },
          { name: "Nhẫn Càn Khôn", icon: "💍", locked: level < 50 },
          { name: "Đá Vô Cực", icon: "🔮", locked: level < 100 },
          { name: "Áo Choàng Bóng Tối", icon: "🦇", locked: !inventory.includes('theme_fire') }
        ].map((item, idx) => (
          <div key={idx} className={`bg-[#1b2533] p-6 rounded-xl border flex flex-col items-center justify-center text-center ${item.locked ? 'border-[#334155] opacity-50 grayscale' : 'border-[#c084fc] shadow-[0_0_15px_rgba(192,132,252,0.2)]'}`}>
            <div className="text-5xl mb-4">{item.locked ? '🔒' : item.icon}</div>
            <h3 className="text-white font-bold text-sm">{item.locked ? 'Chưa mở khóa' : item.name}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
