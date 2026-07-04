'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PLANS, type PaidTier, type BillingPeriod } from '@/lib/subscription';
import { useToast } from '@/context/ToastContext';

type Gateway = 'vnpay' | 'momo';

const TIER_META: Record<PaidTier, { label: string; icon: string; perks: string[]; accent: string }> = {
  premium: {
    label: 'Premium',
    icon: '⭐',
    accent: 'from-blue-500 to-indigo-600',
    perks: ['Gia sư AI không giới hạn lượt/ngày', 'Sinh câu hỏi cá nhân hóa thả ga', 'Ưu tiên tính năng mới'],
  },
  ultimate: {
    label: 'Ultimate',
    icon: '👑',
    accent: 'from-amber-500 to-yellow-600',
    perks: ['Tất cả quyền lợi Premium', 'Giới hạn AI cao nhất', 'Hỗ trợ ưu tiên'],
  },
};

const PERIOD_LABEL: Record<BillingPeriod, string> = { monthly: '/tháng', yearly: '/năm' };

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
  const [gateway, setGateway] = useState<Gateway>('vnpay');
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
            <p className="math-subtitle text-indigo-200">Mở khóa Gia sư AI không giới hạn — học nhanh hơn, xa hơn!</p>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <StatusBanner />
      </Suspense>

      {/* Chọn cổng thanh toán */}
      <div className="flex items-center gap-3">
        <span className="text-[#94a3b8] text-sm font-bold">Cổng thanh toán:</span>
        {(['vnpay', 'momo'] as Gateway[]).map((g) => (
          <button
            key={g}
            onClick={() => setGateway(g)}
            className={`px-4 py-2 rounded-lg font-bold text-sm border-2 transition-colors ${
              gateway === g
                ? 'bg-[#1b2533] border-[#fbbf24] text-[#fbbf24]'
                : 'bg-[#0f172a] border-[#262730] text-[#94a3b8] hover:border-[#475569]'
            }`}
          >
            {g === 'vnpay' ? '🏦 VNPay' : '🟣 MoMo'}
          </button>
        ))}
      </div>

      {/* Danh sách gói */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANS.map((plan) => {
          const meta = TIER_META[plan.tier];
          const key = `${plan.tier}-${plan.period}`;
          return (
            <div key={key} className="bg-[#1b2533] border border-[#262730] rounded-xl p-6 hover:border-[#fbbf24] transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <span className="text-2xl">{meta.icon}</span> {meta.label}
                  <span className="text-xs font-normal text-[#94a3b8]">{plan.period === 'yearly' ? '(năm)' : '(tháng)'}</span>
                </h3>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-black text-[#fbbf24]">{formatVnd(plan.priceVnd)}</span>
                <span className="text-[#94a3b8] text-sm">{PERIOD_LABEL[plan.period]}</span>
                {plan.period === 'yearly' && (
                  <span className="ml-2 text-xs text-emerald-400 font-bold">Tiết kiệm ~2 tháng</span>
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
        Thanh toán an toàn qua cổng {gateway === 'vnpay' ? 'VNPay' : 'MoMo'}. Gói kích hoạt tự động sau khi thanh toán thành công.
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
