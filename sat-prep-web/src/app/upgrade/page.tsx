'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PLANS, type PaidTier, type BillingPeriod } from '@/lib/subscription';
import { useToast } from '@/context/ToastContext';

// Cổng thanh toán: payOS (chuyển khoản QR, khuyên dùng VN cá nhân) + Stripe
// (thẻ quốc tế) + VNPay/MoMo (khi có creds doanh nghiệp). Cổng chưa cấu hình
// → backend trả 503, UI vẫn cho chọn (khi key sẵn sẽ tự chạy).
type Gateway = 'payos' | 'stripe' | 'vnpay' | 'momo';

type GatewayMeta = { id: Gateway; label: string; note: string; enabled: boolean; reassurance: string };

const GATEWAYS: GatewayMeta[] = [
  { id: 'payos', label: '🏦 Chuyển khoản QR', note: 'payOS — khuyên dùng (VN)', enabled: true, reassurance: 'Thanh toán qua chuyển khoản QR/VietQR. Gói kích hoạt tự động sau khi webhook xác nhận.' },
  { id: 'stripe', label: '💳 Thẻ quốc tế', note: 'Stripe (Visa/Master)', enabled: true, reassurance: 'Thanh toán an toàn qua Stripe (thẻ quốc tế). Gói kích hoạt tự động sau khi thanh toán thành công.' },
  { id: 'vnpay', label: '🔗 VNPay', note: 'sắp có', enabled: false, reassurance: 'VNPay sẽ mở sau khi có thông tin doanh nghiệp/credentials.' },
  { id: 'momo', label: '📱 MoMo', note: 'sắp có', enabled: false, reassurance: 'MoMo sẽ mở sau khi có thông tin doanh nghiệp/credentials.' },
];

// 3 CỘT so sánh: free (miễn phí) + 2 gói trả phí. Free KHÔNG mua được (nút ẩn).
type Tier = 'free' | PaidTier;

const TIER_META: Record<Tier, { label: string; icon: string; tagline: string; accent: string; highlight?: boolean }> = {
  free: {
    label: 'Free',
    icon: '🎒',
    accent: 'from-slate-500 to-slate-600',
    tagline: 'Bắt đầu miễn phí — trải nghiệm lõi học tập',
  },
  premium: {
    label: 'Premium',
    icon: '⭐',
    accent: 'from-amber-400 to-orange-500',
    tagline: 'Full lộ trình học + full game loop',
    highlight: true, // cột nổi bật (khuyên dùng)
  },
  ultimate: {
    label: 'Ultimate',
    icon: '👑',
    accent: 'from-amber-500 to-yellow-600',
    tagline: 'Cá nhân hóa cấp mentor — cho mục tiêu 1500+',
  },
};

/**
 * MA TRẬN SO SÁNH TÍNH NĂNG — mỗi hàng 1 tính năng, 3 cột free/premium/ultimate.
 * Giá trị: true (có ✓) · false (không ✗) · chuỗi (mô tả mức, vd "×1.5").
 * Nhóm để dễ đọc (label group in đậm). Nội dung khớp phân tầng đã chốt:
 * free trải nghiệm lõi có giới hạn; premium mở full; ultimate thêm mentor/adaptive.
 */
type CellValue = boolean | string;
interface FeatureRow { label: string; free: CellValue; premium: CellValue; ultimate: CellValue }
interface FeatureGroup { group: string; rows: FeatureRow[] }

const FEATURE_MATRIX: FeatureGroup[] = [
  {
    group: '📚 Học tập cốt lõi',
    rows: [
      { label: 'Diagnostic xếp lớp + điểm dự đoán tổng', free: true, premium: true, ultimate: true },
      { label: 'Luyện tập theo skill (Toán / Đọc-Viết / Từ vựng)', free: 'Domain miễn phí', premium: 'Toàn bộ', ultimate: 'Toàn bộ' },
      { label: 'Mở toàn bộ Cây Kỹ Năng + Cổng Khảo Thí', free: false, premium: true, ultimate: true },
      { label: 'Điểm dự đoán chi tiết theo môn + kỹ năng yếu', free: false, premium: true, ultimate: true },
      { label: 'Thi thử (mock) không giới hạn', free: 'Giới hạn', premium: 'Không giới hạn', ultimate: 'Không giới hạn' },
      { label: 'Thi Thật QAS full-length (đề mô phỏng sát thật)', free: false, premium: false, ultimate: true },
    ],
  },
  {
    group: '🤖 Gia sư AI',
    rows: [
      { label: 'Gia sư AI + sinh câu hỏi', free: 'Giới hạn lượt/ngày', premium: 'Không giới hạn', ultimate: 'Không giới hạn' },
      { label: 'Luyện thích ứng cá nhân hóa (adaptive) theo điểm yếu', free: false, premium: false, ultimate: true },
      { label: 'Giải thích sâu theo điểm yếu (model AI mạnh hơn)', free: false, premium: false, ultimate: true },
    ],
  },
  {
    group: '⚔️ RPG & động lực',
    rows: [
      { label: 'Kế hoạch hôm nay + đo tiến bộ (mastery delta)', free: true, premium: true, ultimate: true },
      { label: 'Hệ số xu RPG (tích lũy nhanh hơn)', free: '×1', premium: '×1.5', ultimate: '×2' },
      { label: 'Đấu trường Boss theo domain + leaderboard', free: true, premium: true, ultimate: true },
    ],
  },
  {
    group: '👨‍👩‍👧 Phụ huynh',
    rows: [
      { label: 'Báo cáo phụ huynh + xu hướng tiến bộ', free: false, premium: '30 ngày', ultimate: '90 ngày chuyên sâu' },
    ],
  },
];

const PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'semiannual', 'yearly'];

const PERIOD_LABEL: Record<BillingPeriod, string> =
  { monthly: 'Tháng', quarterly: '3 Tháng', semiannual: '6 Tháng', yearly: 'Năm' };

const PERIOD_SUFFIX: Record<BillingPeriod, string> =
  { monthly: '/tháng', quarterly: '/3 tháng', semiannual: '/6 tháng', yearly: '/năm' };

const PERIOD_SAVE: Record<BillingPeriod, string | null> =
  { monthly: null, quarterly: 'Tiết kiệm ~10%', semiannual: 'Tiết kiệm ~20%', yearly: 'Tiết kiệm ~33%' };

function formatVnd(n: number): string {
  return n.toLocaleString('vi-VN') + '₫';
}

function planFor(tier: PaidTier, period: BillingPeriod) {
  return PLANS.find((p) => p.tier === tier && p.period === period);
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

/** Ô giá trị 1 tính năng trong cột: ✓ / ✗ / chuỗi mức. */
function FeatureCell({ value, tone }: { value: CellValue; tone: 'free' | 'paid' }) {
  if (value === true) return <span className="text-emerald-400 font-bold" aria-label="Có">✓</span>;
  if (value === false) return <span className="text-[#475569]" aria-label="Không">✗</span>;
  return <span className={`text-xs font-semibold ${tone === 'paid' ? 'text-[#e2e8f0]' : 'text-[#94a3b8]'}`}>{value}</span>;
}

function UpgradeContent() {
  const { showToast } = useToast();
  const [gateway, setGateway] = useState<Gateway>('payos');
  const [period, setPeriod] = useState<BillingPeriod>('yearly'); // mặc định năm (tiết kiệm nhất)
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const selectedGateway = GATEWAYS.find((g) => g.id === gateway) ?? GATEWAYS[0];

  const handleBuy = async (tier: PaidTier) => {
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

  const tiers: Tier[] = ['free', 'premium', 'ultimate'];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #4c1d95 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">💎</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #93c5fd, #c4b5fd)', WebkitBackgroundClip: 'text' }}>NÂNG CẤP GÓI VIP</h1>
            <p className="math-subtitle text-indigo-200">So sánh 3 gói — chọn kỳ thanh toán phù hợp để chinh phục mục tiêu du học!</p>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <StatusBanner />
      </Suspense>

      {/* Chọn KỲ thanh toán (tháng / 3 tháng / 6 tháng / năm) */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[#94a3b8] text-sm font-bold">Kỳ thanh toán:</span>
        <div className="inline-flex flex-wrap gap-1 bg-[#0f172a] p-1 rounded-xl border border-[#262730]">
          {PERIODS.map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors relative ${
                  active ? 'bg-[#1b2533] text-[#fbbf24] shadow' : 'text-[#94a3b8] hover:text-[#e2e8f0]'
                }`}
              >
                {PERIOD_LABEL[p]}
                {PERIOD_SAVE[p] && (
                  <span className="ml-1 text-[10px] font-bold text-emerald-400">{PERIOD_SAVE[p]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chọn cổng thanh toán */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[#94a3b8] text-sm font-bold">Cổng thanh toán:</span>
        {GATEWAYS.map((g) => {
          const active = gateway === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => { if (g.enabled) setGateway(g.id); }}
              disabled={!g.enabled}
              className={`px-4 py-2 rounded-lg font-bold text-sm border-2 transition-colors ${
                active
                  ? 'bg-[#1b2533] border-[#fbbf24] text-[#fbbf24]'
                  : g.enabled
                  ? 'bg-[#1b2533] border-[#262730] text-[#94a3b8] hover:border-[#3b82f6]'
                  : 'bg-[#0f172a] border-[#262730] text-[#64748b] cursor-not-allowed opacity-60'
              }`}
            >
              {g.label}
              <span className="block text-[10px] font-normal opacity-70">{g.note}</span>
            </button>
          );
        })}
      </div>

      {/* BẢNG SO SÁNH 3 CỘT — free / premium / ultimate */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Hàng tiêu đề: tên gói + giá theo kỳ đã chọn + nút mua */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-3">
            <div /> {/* ô góc trống (cột nhãn tính năng) */}
            {tiers.map((tier) => {
              const meta = TIER_META[tier];
              const plan = tier === 'free' ? null : planFor(tier, period);
              const key = tier === 'free' ? 'free' : `${tier}-${period}`;
              return (
                <div
                  key={tier}
                  className={`rounded-2xl p-4 border flex flex-col ${
                    meta.highlight
                      ? 'bg-[#1b2533] border-[#fbbf24] shadow-[0_0_25px_rgba(251,191,36,0.15)]'
                      : 'bg-[#1b2533] border-[#262730]'
                  }`}
                >
                  {meta.highlight && (
                    <div className="self-start mb-2 text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 px-2 py-0.5 rounded-full">
                      Khuyên dùng
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{meta.icon}</span>
                    <h3 className="text-lg font-black text-white">{meta.label}</h3>
                  </div>
                  <p className="text-[11px] text-[#94a3b8] mt-1 min-h-[32px]">{meta.tagline}</p>

                  <div className="mt-3 mb-3">
                    {tier === 'free' ? (
                      <div>
                        <span className="text-2xl font-black text-[#e2e8f0]">Miễn phí</span>
                        <div className="text-[11px] text-[#94a3b8] mt-1">Không cần thẻ</div>
                      </div>
                    ) : plan ? (
                      <div>
                        <span className="text-2xl font-black text-[#fbbf24]">{formatVnd(plan.priceVnd)}</span>
                        <span className="text-[#94a3b8] text-xs">{PERIOD_SUFFIX[period]}</span>
                        {PERIOD_SAVE[period] && (
                          <div className="text-[11px] text-emerald-400 font-bold mt-1">{PERIOD_SAVE[period]}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-[#94a3b8]">Không có gói kỳ này</span>
                    )}
                  </div>

                  {tier === 'free' ? (
                    <button
                      disabled
                      className="mt-auto w-full bg-[#0f172a] text-[#64748b] border border-[#262730] font-bold py-2.5 rounded-lg cursor-default text-sm"
                    >
                      Gói hiện tại
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuy(tier)}
                      disabled={loadingKey !== null || !plan}
                      className={`mt-auto w-full bg-gradient-to-r ${meta.accent} text-white font-bold py-2.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 text-sm`}
                    >
                      {loadingKey === key ? 'Đang chuyển...' : `Nâng cấp ${meta.label}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Các nhóm tính năng */}
          {FEATURE_MATRIX.map((grp) => (
            <div key={grp.group} className="mt-5">
              <div className="text-sm font-bold text-[#93c5fd] mb-1 px-1">{grp.group}</div>
              <div className="rounded-xl overflow-hidden border border-[#262730]">
                {grp.rows.map((row, i) => (
                  <div
                    key={row.label}
                    className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 items-center px-3 py-2.5 ${
                      i % 2 === 0 ? 'bg-[#1b2533]' : 'bg-[#151e2b]'
                    }`}
                  >
                    <div className="text-xs text-[#cbd5e1]">{row.label}</div>
                    <div className="text-center"><FeatureCell value={row.free} tone="free" /></div>
                    <div className="text-center"><FeatureCell value={row.premium} tone="paid" /></div>
                    <div className="text-center"><FeatureCell value={row.ultimate} tone="paid" /></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[#64748b] text-center">
        {selectedGateway.reassurance}
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
