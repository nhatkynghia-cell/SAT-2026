'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useGamification, ITEM_CATALOG } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import type { RedemptionRecord, RedemptionStatus } from '@/lib/rewards';

// Nhãn + màu cho trạng thái phiếu đổi quà (khớp bảng màu toast/banner của app).
const STATUS_META: Record<RedemptionStatus, { label: string; cls: string }> = {
  pending: { label: '⏳ Đang xử lý', cls: 'bg-[#1e293b] border-[#3b82f6] text-[#93c5fd]' },
  fulfilled: { label: '✅ Đã giao', cls: 'bg-[#064e3b] border-[#10b981] text-[#34d399]' },
  cancelled: { label: '✖ Đã hủy', cls: 'bg-[#450a0a] border-[#ef4444] text-[#fca5a5]' },
};

// Thứ hạng gói để so điều kiện gate hiển thị (free < premium < ultimate).
const TIER_RANK: Record<string, number> = { free: 0, premium: 1, ultimate: 2 };

export default function ShopPage() {
  const { coins, buyItem, redeemReward, tier } = useGamification();
  const { showToast } = useToast();

  // Quà THẬT cần xác nhận (đổi xong không hoàn) + tránh double-click khi đang gọi API.
  const [confirmReward, setConfirmReward] = useState<{ id: string; name: string; price: number } | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // Lịch sử phiếu đổi quà của user (GET /api/redeem).
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);

  const loadRedemptions = async () => {
    try {
      const res = await fetch('/api/redeem');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.redemptions)) setRedemptions(data.redemptions);
      }
    } catch (e) {
      console.error('Failed to load redemptions', e);
    }
  };

  // Tải lịch sử phiếu 1 lần khi vào trang. Mẫu như GamificationContext: async
  // ĐỊNH NGHĨA TRONG effect (không gọi hàm component-scope) → setState post-await
  // hợp lệ với react-hooks/set-state-in-effect.
  useEffect(() => {
    async function initLoad() {
      try {
        const res = await fetch('/api/redeem');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.redemptions)) setRedemptions(data.redemptions);
        }
      } catch (e) {
        console.error('Failed to load redemptions', e);
      }
    }
    initLoad();
  }, []);

  const handleBuyItem = (price: number, name: string, id: string) => {
    const result = buyItem(id, price);
    if (result.success) {
      const powerMsg = result.maxPowerGained ? ` (+${result.maxPowerGained} Lực chiến)` : '';
      showToast(`🎉 Mua thành công: ${name}!${powerMsg}`, 'success');
    } else if (result.reason === 'already_owned') {
      showToast(`⚠️ Bạn đã sở hữu ${name} rồi. Trang bị chỉ cần mua một lần.`, 'error');
    } else if (result.reason === 'tier_locked') {
      showToast(`🔒 ${name} là vật phẩm độc quyền của gói cao hơn. Hãy nâng cấp để mở khóa!`, 'error');
    } else {
      showToast(`❌ Không đủ Xu để mua ${name}. Hãy cày cuốc thêm!`, 'error');
    }
  };

  const handleConfirmRedeem = async () => {
    if (!confirmReward || redeeming) return;
    setRedeeming(true);
    const result = await redeemReward(confirmReward.id);
    setRedeeming(false);
    setConfirmReward(null);
    showToast(result.success ? `🎟️ ${result.message}` : `❌ ${result.message}`, result.success ? 'success' : 'error');
    if (result.success) loadRedemptions(); // làm mới lịch sử sau khi đổi thành công
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
        {ITEM_CATALOG.map((item, idx) => {
          const isReward = item.type === 'reward';
          // Gate HIỂN THỊ: item có requiredTier mà gói user chưa đạt → khóa, hiện
          // nhãn gói + link /upgrade thay nút mua (chốt bảo mật thật ở server).
          const requiredTier = (item as { requiredTier?: 'premium' | 'ultimate' }).requiredTier;
          const tierLocked = !!requiredTier && TIER_RANK[tier] < TIER_RANK[requiredTier];
          const tierLabel = requiredTier === 'ultimate' ? 'Ultimate' : 'Premium';
          return (
            <div key={idx} className={`bg-[#1b2533] border border-[#262730] rounded-xl p-6 text-center hover:border-[#fbbf24] transition-all group ${tierLocked ? 'opacity-70' : ''} ${item.effectClass || ''}`}>
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{tierLocked ? '🔒' : item.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center justify-center gap-2">
                {item.name}
                {requiredTier && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {tierLabel}
                  </span>
                )}
              </h3>
              <p className="text-[#94a3b8] text-sm mb-6 h-10">
                {isReward ? '🎁 QUÀ THẬT — đổi bằng Xu (nhận sau khi duyệt)' : `Loại: ${item.type.toUpperCase()}`}
              </p>
              {tierLocked ? (
                <Link
                  href="/upgrade"
                  className="w-full inline-flex justify-center items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-bold py-2 rounded transition-colors"
                >
                  🔒 Mở khóa với {tierLabel}
                </Link>
              ) : isReward ? (
                <button
                  onClick={() => setConfirmReward({ id: item.id, name: item.name, price: item.price })}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-2 rounded transition-colors flex justify-center items-center gap-2"
                >
                  Đổi quà: {item.price} 💰
                </button>
              ) : (
                <button
                  onClick={() => handleBuyItem(item.price, item.name, item.id)}
                  className="w-full bg-[#fbbf24] hover:bg-[#f59e0b] text-[#78350f] font-bold py-2 rounded transition-colors flex justify-center items-center gap-2"
                >
                  Mua ngay: {item.price} 💰
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Lịch sử đổi quà thật — user theo dõi trạng thái phiếu */}
      {redemptions.length > 0 && (
        <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-6">
          <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">🎟️ Lịch sử đổi quà</h2>
          <div className="space-y-3">
            {redemptions.map((r) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.pending;
              return (
                <div key={r.id} className="flex items-center justify-between gap-4 bg-[#0f172a] border border-[#262730] rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-white font-bold truncate">{r.rewardName}</div>
                    <div className="text-[#94a3b8] text-xs">
                      {new Date(r.createdAt).toLocaleString('vi-VN')} · {r.costCoins} 💰
                    </div>
                  </div>
                  <span className={`shrink-0 px-3 py-1 rounded-full border text-xs font-bold ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Xác nhận đổi quà THẬT — hành động không hoàn lại */}
      {confirmReward && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1b2533] border-2 border-emerald-500 rounded-2xl p-8 max-w-md mx-4 shadow-[0_0_40px_#10b981]">
            <div className="text-4xl text-center mb-4">🎟️</div>
            <h3 className="text-xl font-black text-white text-center mb-2">Xác nhận đổi quà thật</h3>
            <p className="text-[#94a3b8] text-center mb-2">
              Đổi <span className="text-emerald-400 font-bold">{confirmReward.name}</span>
            </p>
            <p className="text-center mb-6">
              <span className="text-[#fbbf24] font-black text-lg">{confirmReward.price} 💰</span>
              <span className="text-[#94a3b8] text-sm block mt-1">
                Xu sẽ bị trừ ngay; phiếu đổi sẽ được đội ngũ xử lý thủ công. Hành động không thể hoàn lại.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReward(null)}
                disabled={redeeming}
                className="flex-1 bg-[#334155] hover:bg-[#475569] text-white font-bold py-2 rounded transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmRedeem}
                disabled={redeeming}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-2 rounded transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {redeeming ? 'Đang đổi...' : 'Xác nhận đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
