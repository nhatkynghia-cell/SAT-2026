/**
 * ============================================================================
 *  REWARDS CATALOG (server-authoritative) — Phase 2, Bước 3: xu → quà THẬT
 * ============================================================================
 *  Nguồn sự thật về GIÁ (số xu) + tên + loại của các phần thưởng đổi bằng xu.
 *  Đây là bản sao SERVER-SIDE của các item type:'reward' trong ITEM_CATALOG
 *  (GamificationContext.tsx). Client chỉ gửi `rewardId` — SERVER tra bảng này
 *  để lấy `cost` → client KHÔNG được gửi số xu tùy ý (giống nguyên tắc §9.1 của
 *  economy: client gửi HÀNH ĐỘNG, server quyết con số).
 *
 *  Vì sao trọng yếu: xu đổi được quà THẬT (voucher lệ phí thi, tài liệu, gói AI
 *  VIP). Nếu client gửi cost thì có thể đổi voucher 50.000 xu bằng cách khai 1 xu.
 *  Bảng này + RPC atomic `redeem_reward` (khóa dòng, trừ xu + ghi phiếu trong 1
 *  transaction) đóng lỗ đó.
 *
 *  ⚠️ THUẦN (pure) — không I/O, để unit-test xác định. Tầng I/O ở
 *  redemption-store.ts; RLS + RPC ở reward_redemptions.sql.
 *
 *  ⚠️ ĐỒNG BỘ GIÁ: các `cost` dưới đây PHẢI khớp `price` của item cùng id trong
 *  ITEM_CATALOG (client hiển thị). Nếu lệch, giá client hiện khác giá server trừ
 *  → server luôn thắng (trừ đúng `cost` ở đây). Test `rewards.test.ts` chốt giá.
 * ============================================================================
 */

/** Loại hình thực hiện phần thưởng — quyết định admin cần làm gì để giao quà. */
export type FulfillmentKind = 'voucher' | 'material' | 'ai_perk';

export interface RewardItem {
  /** id khớp ITEM_CATALOG (rw_1/rw_2/rw_3). */
  id: string;
  /** Tên hiển thị (snapshot vào phiếu đổi lúc redeem). */
  name: string;
  /** Giá bằng xu — SERVER quyết, client không gửi. */
  cost: number;
  /** Loại thực hiện (admin fulfil thủ công: cấp mã voucher / gửi tài liệu / bật gói). */
  kind: FulfillmentKind;
}

/**
 * DANH MỤC QUÀ THẬT đổi bằng xu, keyed theo id. Chỉ 3 item type:'reward' trong
 * shop được đổi qua đường này; các item ảo (skin/equipment/consumable) vẫn mua
 * qua buyItem → applySpend thường (không tạo phiếu fulfillment).
 */
export const REWARDS: Record<string, RewardItem> = {
  rw_1: { id: 'rw_1', name: 'Voucher Lệ Phí Thi Cambridge KET/PET (100%)', cost: 50000, kind: 'voucher' },
  rw_2: { id: 'rw_2', name: 'Bộ Tài Liệu Giải Bẫy Toán Thủ Khoa', cost: 10000, kind: 'material' },
  rw_3: { id: 'rw_3', name: 'Thẻ Đặc Quyền Gia Sư AI VIP', cost: 20000, kind: 'ai_perk' },
};

/** Tra 1 phần thưởng theo id. rewardId lạ → undefined (route trả 400). */
export function getReward(rewardId: string): RewardItem | undefined {
  return REWARDS[rewardId];
}

/** Trạng thái 1 phiếu đổi quà (fulfillment queue admin xử lý thủ công). */
export type RedemptionStatus = 'pending' | 'fulfilled' | 'cancelled';

/** 1 bản ghi đổi quà (đọc lại từ reward_redemptions). */
export interface RedemptionRecord {
  id: string;
  rewardId: string;
  rewardName: string;
  costCoins: number;
  status: RedemptionStatus;
  createdAt: string;
  fulfilledAt: string | null;
}
