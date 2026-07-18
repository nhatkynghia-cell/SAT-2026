'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PLANS, type PaidTier, type BillingPeriod } from '@/lib/subscription';
import { useToast } from '@/context/ToastContext';

// VNPay/MoMo đã disable (chờ creds doanh nghiệp) → chỉ còn Stripe.
type Gateway = 'stripe';

const TIER_META: Record<PaidTier, { label: string; icon: string; tagline: string; perks: string[]; accent: string }> = {
  premium: {
    label: 'Premium',
    icon: '⭐',
    accent: 'from-amber-400 to-orange-500',
    tagline: 'Full lộ trình học + full game loop',
    perks: [
      '🤖 Gia sư AI + sinh câu không giới hạn lượt/ngày',
      '📚 Mở toàn bộ Cây Kỹ Năng + Cổng Khảo Thí',
      '📈 Điểm dự đoán chi tiết theo môn + kỹ năng cần cải thiện',
      '📝 Thi thử (mock) không giới hạn',
      '⚔️ Hệ số xu RPG ×1.5 — tích lũy nhanh hơn',
      '👨‍👩‍👧 Báo cáo phụ huynh + xu hướng 30 ngày',
    ],
  },
  ultimate: {
    label: 'Ultimate',
    icon: '👑',
    accent: 'from-amber-500 to-yellow-600',
    tagline: 'Cá nhân hóa cấp mentor — cho mục tiêu 1500+',
    perks: [
      '✨ Tất cả quyền lợi Premium',
      '🎯 Luyện thích ứng cá nhân hóa (adaptive) theo điểm yếu',
      '📝 Chế độ Thi Thật QAS full-length — bộ đề mô phỏng sát đề thi thật',
      '🧠 Gia sư AI — giải thích sâu hơn theo điểm yếu',
      '⚔️ Hệ số xu RPG ×2 — tích lũy nhanh gấp đôi',
      '👨‍👩‍👧 Báo cáo phụ huynh chuyên sâu + xu hướng 90 ngày',
    ],
  },
};

const PERIOD_LABEL: Record<BillingPeriod, string> =
  { monthly: '/tháng', quarterly: '/3 tháng', semiannual: '/6 tháng', yearly: '/năm' };

const PERIOD_TAG: Record<BillingPeriod, string> =
  { monthly: '(tháng)', quarterly: '(3 tháng)', semiannual: '(6 tháng)', yearly: '(năm)' };

const PERIOD_SAVE: Record<BillingPeriod, string | null> =
  { monthly: null, quarterly: 'Tiết kiệm ~10%', semiannual: 'Tiết kiệm ~20%', yearly: 'Tiết kiệm ~33%' };

function formatVnd(n: number): string {
  return n.toLocaleString('vi-VN') + '₫';
}

function StatusBanner() {
  const params = useSearchParams();
  const status = params.get('status');
  if (!status) return null;

  const map: Record<string, { cls: string; msg: string }> = {
    paid: { cls: 'bg-[#064e3b] border-[#10b981] text-[#34d399]', msg: '🎉 Thanh toán thành công! Gói của bạn đã được kích hoạt.' },
    pending: { cls: 'bg-[#1e293b] border-[#3b82f6] text-[#93c5fd]', msg: '⏳ Đang xác nhận thanh toán. Gói sẽ kích hoạt ngay khi cổng xác nhận (thường trong ít phút).' },
    unknown: { cls: 'bg-[#450a0a] border-[#ef4444] text-[#fca5a5]', msg: '❌ Không tìm thấy giao dịch. Nếu đã bị trừ tiền, vui lòng liên hệ hỗ trợ.' },
  };
  const meta = map[status] ?? map.unknown;
  return <div className={`px-4 py-3 rounded-xl border-2 font-bold text-sm ${meta.cls}`}>{meta.msg}</div>;
}

function UpgradeContent() {
  const { showToast } = useToast();
  const [gateway] = useState<Gateway>('stripe');
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const handleBuy = async (tier: PaidTier, period: BillingPeriod) => {
    const key = `${tier}-${period}`;
    if (loadingKey) return;
    setLoadingKey(key);
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway, tier, period }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.payUrl) {
        window.location.assign(data.payUrl); // redirect sang cổng thanh toán
        return;
      }
      showToast(`❌ ${data?.error ?? 'Không thể tạo giao dịch.'}`, 'error');
    } catch {
      showToast('❌ Lỗi kết nối, vui lòng thử lại sau.', 'error');
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #4c1d95 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">💎</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #93c5fd, #c4b5fd)', WebkitBackgroundClip: 'text' }}>NÂNG CẤP GÓI VIP</h1>
            <p className="math-subtitle text-indigo-200">Mở toàn bộ lộ trình học + game — chinh phục mục tiêu du học!</p>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <StatusBanner />
      </Suspense>

      {/* Cổng thanh toán — hiện chỉ Stripe (VNPay/MoMo chờ creds doanh nghiệp). */}
      <div className="flex items-center gap-3">
        <span className="text-[#94a3b8] text-sm font-bold">Cổng thanh toán:</span>
        <span className="px-4 py-2 rounded-lg font-bold text-sm border-2 bg-[#1b2533] border-[#fbbf24] text-[#fbbf24]">
          💳 Stripe (thẻ quốc tế)
        </span>
      </div>

      {/* Danh sách gói */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANS.map((plan) => {
          const meta = TIER_META[plan.tier];
          const key = `${plan.tier}-${plan.period}`;
          return (
            <div key={key} className="bg-[#1b2533] border border-[#262730] rounded-xl p-6 hover:border-[#fbbf24] transition-all">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <span className="text-2xl">{meta.icon}</span> {meta.label}
                    <span className="text-xs font-normal text-[#94a3b8]">{PERIOD_TAG[plan.period]}</span>
                  </h3>
                  <p className="text-xs text-[#94a3b8] mt-1">{meta.tagline}</p>
                </div>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-black text-[#fbbf24]">{formatVnd(plan.priceVnd)}</span>
                <span className="text-[#94a3b8] text-sm">{PERIOD_LABEL[plan.period]}</span>
                {PERIOD_SAVE[plan.period] && (
                  <span className="ml-2 text-xs text-emerald-400 font-bold">{PERIOD_SAVE[plan.period]}</span>
                )}
              </div>
              <ul className="space-y-2 mb-6">
                {meta.perks.map((p, i) => (
                  <li key={i} className="text-sm text-[#e2e8f0] flex items-start gap-2">
                    <span className="text-emerald-400">✓</span> {p}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleBuy(plan.tier, plan.period)}
                disabled={loadingKey !== null}
                className={`w-full bg-gradient-to-r ${meta.accent} text-white font-bold py-3 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50`}
              >
                {loadingKey === key ? 'Đang chuyển tới cổng...' : `Nâng cấp ${meta.label}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[#64748b] text-center">
        Thanh toán an toàn qua Stripe (thẻ quốc tế). Gói kích hoạt tự động sau khi thanh toán thành công.
      </p>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="text-center text-[#94a3b8] py-20">Đang tải...</div>}>
      <UpgradeContent />
    </Suspense>
  );
}
