# 🔧 CLtinhchinh.md — BACKLOG TINH CHỈNH CẤU TRÚC (trước khi chốt giá)

> **Bối cảnh:** User muốn tinh chỉnh cấu trúc app TRƯỚC khi chốt giá, vì chiến lược giá gắn với cấu trúc quyền lợi (đặc biệt: Ultimate 990k = 2× Premium 499k — phải "đáng gấp đôi").
> **Nguồn:** audit read-only 4 chiều song song (workflow 4 Explore agent, 2026-07-06) đọc code THẬT. Xem cũng [CLgia.md](CLgia.md) (chiến lược giá) + memory `sat-prep-funnel-pricing.md`.
> **Trạng thái:** CHƯA code gì — đây là danh mục để user duyệt + quyết build/gỡ từng mục, rồi mới triển khai. Verify hiện tại: tsc·test 272/272·lint 0/0.

---

## 🔴 NHÓM A — ULTIMATE "BÁN KHỐNG" (quyết định TRƯỚC khi chốt giá)

Trang bán `/upgrade` hứa 4 quyền lợi Ultimate mà **code CHƯA triển khai**. Vì Ultimate = 2× giá Premium, đây là trục quyết định "Ultimate đáng bao nhiêu". Mỗi mục: **hoặc LÀM, hoặc GỠ khỏi trang bán** trước khi thu tiền (tránh rủi ro pháp lý + churn).

| # | Lời hứa (upgrade/page.tsx) | Hiện trạng code | File bằng chứng | Mức |
|---|---|---|---|---|
| A1 | 🧠 "Model AI cao cấp hơn — giải thích sâu hơn" | Cả 3 tier đều hardcode `gpt-4o-mini`, KHÔNG switch theo tier | `chat/route.ts:32`, `generate-practice/route.ts:285`, hứa ở `upgrade/page.tsx:33` | **high** |
| A2 | 🗺️ "Đề luyện độc quyền" | `generate-practice` gọi `getUserTier()` nhưng KHÔNG dùng để lọc câu; không có pool/cột "exclusive"; mọi tier dùng chung bank | `generate-practice/route.ts:81-120`, `upgrade/page.tsx:34` | **high** |
| A3 | ⚔️ "Trang bị & skin độc quyền" | `ITEM_CATALOG` không có field tier; spin/`buyItem` không kiểm gói → free tích xu vẫn quay ra skin y hệt | `economy.ts:204` (SPIN_VIRTUAL_ITEMS), `GamificationContext.tsx:32-38`, `upgrade/page.tsx:35` | **high** |
| A4 | 🎁 "Thưởng xu độc quyền hằng tháng" | Không có logic monthly/recurring reward, không cron, không tier check | grep 0 hit `monthly_reward`; `upgrade/page.tsx:36` | **medium** |
| ✅ | "Báo cáo 90 ngày" (Ultimate) | ĐÃ LÀM ĐỦ — `TREND_WINDOW_DAYS {free7/prem30/ult90}` | `parent-report-store.ts:15` | (ok) |

**Hệ quả định giá:** Khác biệt Premium↔Ultimate **đang chạy thật** chỉ có 2 trục: hệ số xu ×2 (vs ×1.5) + báo cáo 90 ngày (vs 30). → Ultimate hiện KHÔNG "đáng gấp đôi". Muốn giữ giá 990k phải làm dày ≥1-2 mục A1-A4; hoặc hạ định vị/giá Ultimate.

**👉 Cần user quyết:** với mỗi A1-A4 → **LÀM** (mục nào trước?) hay **GỠ khỏi trang bán**? (khớp điểm để ngỏ #4 trong CLgia.md)

---

## 🟠 NHÓM B — RANH GIỚI FREE QUÁ LỎNG (đóng lỗ hổng, gắn định giá trực tiếp)

| # | Vấn đề | Hiện trạng | File | Mức |
|---|---|---|---|---|
| B1 | Gate domain chỉ ở **tầng hiển thị**, không ở API | `applyTierGate` đánh dấu `tierLocked` cho UI, nhưng `/api/generate-practice` nhận `moduleType='advanced_math'` từ free → qua quota là trả câu. Free dựng request tay → luyện chương "khóa" | `generate-practice/route.ts:106`, `skill-tree.ts:202-220` | **medium** |

**Hệ quả:** "Free chỉ 2 chương" là lời hứa bán hàng nhưng chưa chặn ở data layer → người rành kỹ thuật vượt được. Nên đóng gate ở API (kiểm `moduleType ∈ FREE_DOMAINS` khi tier=free) để ranh giới Free/Premium là THẬT. **Nguyên tắc vàng vẫn giữ:** không gate diagnostic + không gate ghi mastery/snapshot.

---

## 🟡 NHÓM C — PHỄU CHUYỂN ĐỔI FREE→PAID (đòn bẩy doanh thu, ít rủi ro kỹ thuật)

Các mục pure-UI/pure-read, đảo ngược được, làm tăng tỉ lệ nâng cấp mà KHÔNG đụng logic tiền.

| # | Vấn đề | File | Mức |
|---|---|---|---|
| C1 | **Diagnostic không dẫn tới /upgrade** — kết thúc diagnostic (aha moment mạnh nhất: điểm dự đoán + kỹ năng yếu) chỉ có CTA "Xem Cây Năng Lực", bỏ lỡ đúng lúc user "sốc" | `diagnostic/page.tsx:281-285` | **high** |
| C2 | **Focus skills bị lấy lại sau diagnostic** — diagnostic hiện focus skills, nhưng vào dashboard `/api/score` free trả `detailLocked+focusSkills:[]` → user nhầm "điểm đâu rồi?". Friction lớn, phản tác dụng | `score/route.ts:26-34`, `dashboard/page.tsx:220-226` | **high** |
| C3 | **Adaptive "Luyện Mục Tiêu" khóa free nhưng KHÔNG có nút upsell** — panel chỉ hiện text tĩnh, không button dẫn /upgrade | `adaptive/route.ts:26-29`, `skill-tree/page.tsx` | **high** |
| C4 | **Login muộn → mất dữ liệu diagnostic** — unauth chạy dưới `local-default-user`; làm diagnostic xong, tới payment mới bắt login → dữ liệu diagnostic (user cũ) KHÔNG chuyển sang tài khoản thật | `auth.ts:44-46`, `payment/create/route.ts:48` | **medium→high** |
| C5 | Skill-tree node khóa không có CTA "Mở khóa chương" trên từng node | `skill-tree/page.tsx:284-304` | medium |
| C6 | Real-exams gate 403 không trả `redirectUrl`/CTA → user tự mò /upgrade | `exams/start/route.ts:56-60`, `real-exams/page.tsx:24-33` | medium |
| C7 | AI quota không hiện "còn N lượt" TRƯỚC khi hết → 429 rồi mới biết, lỡ upsell | `AITutoring.tsx`, `chat/route.ts:102-110` | medium |
| C8 | Empty dashboard (chưa làm diagnostic) không có CTA "Làm bài xếp lớp ngay" | `dashboard/page.tsx:218-227` | low |

**Ghi chú:** C1+C2+C3 cùng một gốc — aha moment của diagnostic không được "chuyển hoá" thành lời mời nâng cấp đúng thời điểm. Sửa cụm này rẻ (UI + thêm CTA) mà tác động conversion lớn nhất. C4 nghiêm trọng hơn vẻ ngoài: mất dữ liệu = mất niềm tin ngay cửa thanh toán.

---

## 🔵 NHÓM D — NỢ KỸ THUẬT KIỂM SOÁT CHI PHÍ (làm trước khi bật AI trả phí)

| # | Vấn đề | File | Mức |
|---|---|---|---|
| D1 | **Kill-switch ngân sách $5/ngày có thể vượt trần** — `recordCost` fallback đọc-sửa-ghi không atomic (race → đếm thiếu) + comment tự cảnh báo fire-and-forget trên Vercel có thể bị kill trước khi ghi | `cost-ledger-store.ts:76-111`, `chat/route.ts:186`, `generate-practice:323-327` | **high** |
| D2 | `ai_chat_cache` — store viết xong, tích hợp rồi, nhưng bảng CHƯA xác nhận tạo trên prod → cache chết (miss → tốn token thật) | `chat-cache-store.ts`, `database_schema.md:128-136` | medium |

**Liên quan định giá:** nếu chốt A1 (Ultimate dùng model xịn hơn) → chi phí OpenAI tăng mạnh → D1 phải chắc TRƯỚC, kẻo cả 2 tier ∞ AI + model đắt → cháy ngân sách. Cập nhật `PRICING` trong `ai-cost.ts` cho model mới.

---

## ⚪ NHÓM E — DỌN NHỎ (pre-launch hygiene)

| # | Vấn đề | File | Mức |
|---|---|---|---|
| E1 | TODO cũ đã resolve nhưng comment chưa xoá (getUserTier đã nối) | `subscription.ts:8` | low |
| E2 | `migrate-data` route legacy — 4 lớp phòng thủ rồi, nhưng nên xoá hẳn + file JSON cũ trước prod | `migrate-data/route.ts:15-26` | low (đã theo dõi) |
| E3 | `cf154ab` vá auth `/api/admin/ai-cost` — đã xong phiên này, chưa push (kẹt sau 3 commit định giá chưa push của phiên khác) | — | (chờ push) |

---

## 📌 BẢNG QUYẾT ĐỊNH USER (nối vào "5 điểm để ngỏ" của CLgia.md)

Trước khi chốt giá, cần bạn quyết:

1. **Ultimate value-ladder (Nhóm A):** với A1 model xịn / A2 đề độc quyền / A3 skin độc quyền / A4 thưởng xu tháng — mỗi cái **LÀM hay GỠ**? Nếu làm, thứ tự ưu tiên? (Đây là câu quyết định "Ultimate đáng gấp đôi" hay không.)
2. **Đóng gate Free ở API (B1)** — làm luôn (nên) hay chấp nhận lỏng ở beta?
3. **Cụm conversion C1-C3** — ưu tiên cao, rẻ, nên làm sớm để đo conversion thật khi beta. Đồng ý làm trước?
4. **C4 (mất dữ liệu diagnostic khi login)** — cần quyết hướng: ép login TRƯỚC diagnostic, hay merge dữ liệu `local-default-user` → tài khoản thật sau login?
5. **D1 kill-switch** — làm chắc trước khi bật thanh toán (bắt buộc nếu chọn A1).

> Sau khi bạn đánh dấu build/gỡ + thứ tự, phiên sau triển khai theo từng nhóm (mỗi nhóm 1 commit, verify gates, không đụng vùng đang khoá của phễu giá).
