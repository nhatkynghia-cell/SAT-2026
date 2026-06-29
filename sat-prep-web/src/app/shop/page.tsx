'use client';

import { useGamification, ITEM_CATALOG } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';

export default function ShopPage() {
  const { coins, buyItem } = useGamification();
  const { showToast } = useToast();

  const handleBuyItem = (price: number, name: string, id: string) => {
    const success = buyItem(id, price);
    if (success) {
      showToast(`🎉 Mua thành công: ${name}!`, 'success');
    } else {
      showToast(`❌ Không đủ Xu để mua ${name}. Hãy cày cuốc thêm!`, 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 relative pb-20">
      
      {/* Header */}
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #14532d 0%, #064e3b 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">🛒</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #6ee7b7, #34d399)", WebkitBackgroundClip: "text" }}>CỬA HÀNG VẬT PHẨM</h1>
            <p className="math-subtitle text-green-200">Dùng Xu cày được để mua sắm vật phẩm hỗ trợ!</p>
          </div>
        </div>
        <div className="rpg-hud-container flex items-center justify-center">
          <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fbbf24" }}>
            Số dư hiện tại: 💰 {coins} Xu
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ITEM_CATALOG.map((item, idx) => (
          <div key={idx} className={`bg-[#1b2533] border border-[#262730] rounded-xl p-6 text-center hover:border-[#fbbf24] transition-all group ${item.effectClass || ''}`}>
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{item.icon}</div>
            <h3 className="text-lg font-bold text-white mb-2">{item.name}</h3>
            <p className="text-[#94a3b8] text-sm mb-6 h-10">Loại: {item.type.toUpperCase()}</p>
            <button 
              onClick={() => handleBuyItem(item.price, item.name, item.id)}
              className="w-full bg-[#fbbf24] hover:bg-[#f59e0b] text-[#78350f] font-bold py-2 rounded transition-colors flex justify-center items-center gap-2"
            >
              Mua ngay: {item.price} 💰
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
