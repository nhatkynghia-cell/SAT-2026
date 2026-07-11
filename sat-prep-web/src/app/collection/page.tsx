'use client';
import { useGamification } from '@/context/GamificationContext';
import { COSMETIC_CATALOG, seasonKey, tierPerkCosmeticIds, type CosmeticItem } from '@/lib/cosmetics';

// Thứ hạng gói để so điều kiện mở khóa (free < premium < ultimate).
const TIER_RANK: Record<string, number> = { free: 0, premium: 1, ultimate: 2 };

// Nhãn loại cosmetic cho phụ đề thẻ (thẩm mỹ + danh vọng, KHÔNG chỉ số).
const KIND_LABEL: Record<CosmeticItem['kind'], string> = {
  skin: 'Trang phục',
  theme: 'Chủ đề',
  frame: 'Khung viền',
  title: 'Danh hiệu',
};

export default function CollectionPage() {
  const { inventory, tier, ownedCosmetics } = useGamification();

  // Quyền-sở-hữu HỢP NHẤT 3 nguồn:
  //  • inventory (id chuỗi): skin/theme ĐÃ MUA (Equipment là object → loại).
  //  • tierPerkCosmeticIds(tier): frame/title QUYỀN LỢI GÓI (auto theo gói).
  //  • ownedCosmetics: frame/title KIẾM ĐƯỢC (vô địch — server-authoritative).
  const ownedIds = new Set<string>([
    ...inventory.filter((i): i is string => typeof i === 'string'),
    ...tierPerkCosmeticIds(tier),
    ...ownedCosmetics,
  ]);

  // Mùa hiện tại (dẫn xuất tất định từ giờ client — chỉ để lọc HIỂN THỊ, danh vọng
  // thật do server cấp qua ownership ở B1b/B2). Món gắn mùa CŨ ẩn đi cho gọn; món
  // mùa hiện tại + vĩnh viễn (không mùa) đều hiện.
  const currentSeason = seasonKey(new Date().toISOString());
  const visible = COSMETIC_CATALOG.filter((c) => !c.season || c.season === currentSeason);

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
        {visible.map((item) => {
          const owned = ownedIds.has(item.id);
          const tierOk = TIER_RANK[tier] >= TIER_RANK[item.requiredTier];
          // Khóa nếu chưa sở hữu HOẶC chưa đạt gói (dù đã sở hữu vẫn cần đủ tier để
          // dùng — cosmetic là quyền lợi gói). Mở khi vừa đủ tier vừa sở hữu.
          const locked = !owned || !tierOk;
          const tierLabel = item.requiredTier === 'ultimate' ? 'Ultimate' : 'Premium';
          return (
            <div
              key={item.id}
              className={`bg-[#1b2533] p-6 rounded-xl border flex flex-col items-center justify-center text-center ${locked ? 'border-[#334155] opacity-50 grayscale' : `border-[#c084fc] shadow-[0_0_15px_rgba(192,132,252,0.2)] ${item.cssClass || ''}`}`}
            >
              <div className="text-5xl mb-4">{locked ? '🔒' : item.icon}</div>
              <h3 className="text-white font-bold text-sm">{locked ? 'Chưa mở khóa' : item.name}</h3>
              <span className="mt-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {KIND_LABEL[item.kind]} · {tierLabel}
              </span>
              {locked && !tierOk && (
                <span className="mt-1 text-[10px] text-[#94a3b8]">Cần gói {tierLabel}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
