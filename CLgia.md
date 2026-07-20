# 💰 CLgia.md — Bàn giao NGHIÊN CỨU ĐỊNH GIÁ THEO PHỄU (2026-07-06)

> File này gói trọn nghiên cứu định giá phiên 2026-07-06 (context đã full) để mở phiên mới tiếp tục.
> Chi tiết cũng lưu ở memory Claude: `sat-prep-funnel-pricing.md`.

---

## 🎯 CHIẾN LƯỢC GIÁ — BẢN ĐỂ TINH CHỈNH (chốt lưu 2026-07-06) — ĐỌC ĐẦU TIÊN

> **Trạng thái:** Giá + Wave 1 gating + hệ số xu ĐÃ XONG (commit `ad03bf8`). User quyết **GÁC affiliate + Top-5 để app chạy ổn trước**, chỉ LƯU chiến lược giá làm bản tham chiếu → phiên sau mở ra là tinh chỉnh ngay. **CHƯA code gì thêm cho định giá.**

### A. Ba tầng + giá niêm yết (list price, neo cao cho tệp du học)
| Gói | Tháng | Năm (≈8 tháng) | Vai trò |
|---|---|---|---|
| 🆓 Free | 0 | 0 | Mồi / hook đầu phễu |
| ⭐ Premium | 499k | 3.990k | Chủ lực |
| 💎 Ultimate | 990k | 7.990k | Elite |

Nguồn sự thật: `src/lib/subscription.ts` PLANS (dòng 70–75). Giá chỉ là dữ liệu bảng, không ảnh hưởng logic tier.

### B. Ma trận quyền lợi (✅ đã code · 📝 chưa code · 🔬 gác)
| Trục | Free | Premium | Ultimate | TT |
|---|---|---|---|---|
| AI/ngày | 5 | ∞ | ∞ | ✅ |
| Điểm dự đoán | tổng 400–1600 | +breakdown+focus | =Premium | ✅ |
| Skill tree | 2 chương đầu | toàn bộ | toàn bộ | ✅ |
| Adaptive "Luyện mục tiêu" | 🔒 | ✅ | ✅ | ✅ |
| Thi thật/QAS | 🔒 | ✅ (level≥7) | ✅ +đề độc quyền | ✅ (đề độc quyền 📝) |
| Báo cáo phụ huynh | 7 ngày·5 bài | 30 ngày·10 bài | 90 ngày·20 bài | ✅ |
| Hệ số xu RPG | ×1 | ×1.5 | ×2 | ✅ |
| Model AI cao cấp | – | – | ✅ | 📝 |
| Giải Top-5 toàn quốc | – | – | ✅ | 🔬 gác |

### C. Điểm mỏng đã nhận diện (cần tinh chỉnh)
Khác biệt Premium↔Ultimate **đã chạy thật** mới có 2: báo cáo 90 ngày + hệ số xu ×2. "Model AI xịn + đề độc quyền + Top-5" mới là chữ trên trang bán → **Ultimate chưa "đáng gấp đôi"**. Cần quyết làm dày trục nào trước.

### D. Affiliate 35% (thiết kế đã chốt, chưa code — chi tiết ở mục "THIẾT KẾ AFFILIATE" dưới)
- 35% tổng ngân sách = KOL 25% hoa hồng + người mua giảm 10% → giữ 65% biên.
- VD Premium tháng 499k: mua trả ~449k · KOL ~125k · giữ ~324k.
- Mỗi mã 2 nút chỉnh (discount%/commission%), mặc định 10/25.

### E. 5 điểm để ngỏ user tinh chỉnh (phiên sau trả lời rồi mới code)
1. **Giá** 4 con số (499k/3.990k/990k/7.990k) — giữ hay đổi?
2. **Tỉ lệ chia affiliate** 10/25 (giữ 65%) — giữ hay đổi?
3. **Ranh giới quyền lợi** Free/Premium/Ultimate — Free đang mở 2 chương skill-tree (nhiều/ít?); thi thật đang chặn level<7 (giữ?).
4. **Ưu tiên làm dày Ultimate**: model AI cao cấp / đề độc quyền / Top-5 — cái nào trước? (hay để affiliate + Top-5 gánh)
5. **Khuyến mãi ra mắt**: Premium mồi 49k×3 tháng đầu + gói mùa thi 3 tháng (canh lịch Digital SAT Mar/May/Aug/Oct/Dec)?

---

## 📋 CÂU LỆNH MỞ PHIÊN MỚI (copy nguyên khối)

```
Đọc memory.md + master_task_list.md + CLgia.md trong
D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\
rồi tiếp tục: (1) NGHIÊN CỨU giải thưởng Top-5 học sinh toàn quốc (tiêu chí xếp
hạng chống gian lận + chu kỳ + bảng leaderboard cross-user), (2) TRIỂN KHAI
affiliate 35% (KOL 25% + người mua giảm 10%). Trả lời tiếng Việt.

Trước khi làm gì: export PATH="$PATH:/c/Program Files/nodejs" rồi verify môi trường
(tsc + test + lint) trong sat-prep-web/. Baseline: tsc sạch · test 269/269 · lint 0/0.
origin/main = commit docs mới nhất (git log --oneline -3).

Token: ~/.gitcreds-sat2026 (git push — ghép "/nhatkynghia-cell/SAT-2026.git" vào cuối)
+ ~/.vercel-token. Repo: github.com/nhatkynghia-cell/SAT-2026 (main).
DB direct: postgresql://postgres:SatPrep2026@db.yynszcfqcvbnuvguwtfy.supabase.co:5432/postgres

GIÁ + WAVE 1 gating + HỆ SỐ XU đã XONG (xem CLgia.md mục dưới). AFFILIATE đã
nghiên cứu kỹ thuật đủ để code luôn theo thiết kế đã chốt. Top-5 prize cần nghiên
cứu thêm. Đọc CLgia.md rồi bắt tay.
```

---

## 🔴 PHÁT HIỆN GỐC (từ workflow 6-agent map toàn codebase)

App hiện **chỉ gate 2 route AI** (`chat`, `generate-practice`) theo tier. `DAILY_LIMITS` (`src/lib/ai-quota.ts:18`):
```
free: 5   ·   premium: -1 (∞)   ·   ultimate: -1 (∞)
```
→ **Premium = Ultimate về quyền lợi** → Ultimate đắt gấp đôi (199k vs 99k) nhưng KHÔNG cho gì hơn → **không ai có lý do mua Ultimate.**

Mọi feature khác (skill-tree, adaptive, score prediction, thi thật, parent report, RPG) **mở toàn bộ** cho bất kỳ user đã login — chưa hề phân tầng.

**Nguyên tắc vàng:** luôn GHI dữ liệu full ở free (mastery POST, daily-snapshot) — chỉ gate tầng ĐỌC/HIỂN THỊ. Nâng cấp = "mở khóa lịch sử đã có". TUYỆT ĐỐI không gate diagnostic (hook đầu phễu).

---

## 📊 MA TRẬN PHỄU ĐỀ XUẤT (feature-gated funnel)

_(CẬP NHẬT 2026-07-06 theo quyết định cuối — bản đề xuất cũ có AI 5/30/∞ đã BÁC.)_

| Trục | 🆓 Free (mồi) | ⭐ Premium (chủ lực) | 💎 Ultimate (elite) | Trạng thái |
|---|---|---|---|---|
| **AI/ngày** | 5 | **∞** | **∞** | ✅ (cả 2 gói ∞, KHÔNG đụng DAILY_LIMITS) |
| **Điểm dự đoán** | Chỉ tổng 400–1600 | + breakdown môn + focus skills | Giống Premium | ✅ |
| **Skill tree** | 2 chương đầu | Toàn bộ cây | Toàn bộ | ✅ |
| **Adaptive "Luyện mục tiêu"** | 🔒 Khóa | Cá nhân hóa đầy đủ | Đầy đủ | ✅ |
| **Thi thật / QAS** | 🔒 Khóa | ✅ Mở | ✅ + đề độc quyền📝 | ✅ (đề độc quyền chưa code) |
| **Báo cáo phụ huynh** | trend 7 ngày | Full + trend 30 ngày + 10 bài | trend 90 ngày + 20 bài | ✅ |
| **🎮 Hệ số xu RPG** | ×1 | **×1.5** | **×2** | ✅ (commit ad03bf8) |
| **Model AI cao cấp** | – | – | ✅ | 📝 chưa code |
| **Giải thưởng Top-5 toàn quốc** | – | – | ✅ (THAY voucher/user) | 🔬 nghiên cứu phiên sau |

*= phụ thuộc quyết định #2 bên dưới.

**Khác biệt Ultimate (CẬP NHẬT 2026-07-06):** (1) hệ số xu ×2 (Premium ×1.5) — ĐÃ code; (2) báo cáo phụ huynh 90 ngày (Premium 30) — ĐÃ code; (3) 🔬 **giải thưởng Top-5 học sinh toàn quốc** (THAY cho voucher/user đã BỎ — xem quyết định (c) dưới); (4) 📝 model AI cao cấp + đề độc quyền — CHƯA code. ~~AI ∞ vs trần~~ KHÔNG áp dụng (cả 2 gói ∞ AI).

---

## ✅ 2 QUYẾT ĐỊNH ĐÃ CHỐT (user 2026-07-06) + WAVE 1 TRIỂN KHAI XONG (commit `6eab3bd`)

### ① GIÁ — CHỐT "Premium-elite" (neo cao cho tệp du học + nuôi affiliate 30-40%)
- `PLANS` (`subscription.ts`) ĐÃ đổi: Premium **499k/th · 3.990k/năm** · Ultimate **990k/th · 7.990k/năm** (list price NIÊM YẾT).
- Logic: tệp học sinh du học có điều kiện + KHÔNG app SAT nào gamified RPG (không bị neo giá đối thủ) → neo cao. Sau mã KOL -35% về ~324k/644k (vùng impulse). Anchor cao → KOL có mã giảm gây sốc tốt cho content.
- Neo cao chừa đủ headroom cho affiliate 35% mà vẫn giữ 65% biên. (~~"tự hoàn vốn bằng voucher"~~ ĐÃ BỎ — voucher/user gỡ; đòn "elite" của Ultimate chuyển sang giải thưởng Top-5 toàn quốc + đặc quyền độc quyền.)
- **✅ Affiliate 35% CHỐT ngữ nghĩa (user 2026-07-06):** 35% = TỔNG ngân sách affiliate, chia **KOL 25% hoa hồng + người mua giảm 10%** → giữ 65% list price. Ví dụ Premium tháng 499k: người mua trả ~449k, KOL nhận ~125k, giữ ~324k. Mỗi mã 2 nút chỉnh (discount%/commission%), mặc định 10/25. **Đã nghiên cứu kỹ thuật đủ (xem mục "THIẾT KẾ AFFILIATE" dưới) — code phiên sau.**

### ② VALUE-LADDER — CHỐT phương án B (cả Premium & Ultimate đều ∞ AI)
- **KHÔNG đụng `DAILY_LIMITS`** — cả 2 gói giữ ∞ AI. Phân tầng bằng RPG (hệ số xu, đề độc quyền) + chương trình học (skill-tree/adaptive/thi thật) + mentor (report 90d, model AI xịn).
- Lý do: tệp có điều kiện không nên siết AI; HS phổ thông hiếm chạm trần → khác biệt AI "không cảm nhận được".
- `/upgrade` copy đã viết lại theo trục RPG+học+mentor (bỏ "AI không giới hạn" làm điểm khác biệt).

**✅ WAVE 1 (pure-read gating) XONG:** score/adaptive/skill-tree/thi-thật/parent-report gate theo tier server-side + UI upsell. Đóng lỗ hổng gate-level client ở exam. tsc·test 263/263·lint 0/0·build 62. Chi tiết: memory.md block đầu + memory Claude `sat-prep-funnel-pricing.md`.

---

## 🛠️ KẾ HOẠCH TRIỂN KHAI (khi user chốt)

**Wave 1 — easy, pure-read, KHÔNG migration (làm ngay, đảo ngược được):**
| Thay đổi | File | Ghi chú |
|---|---|---|
| `DAILY_LIMITS` tách 3 tầng (free5/prem30/ult∞) | `src/lib/ai-quota.ts` | CHỈ nếu chọn phương án A. Fix ROOT BUG. |
| getUserTier ở GET → free đề xuất chung, prem+ cá nhân hóa | `src/app/api/adaptive/route.ts` | pure read |
| getUserTier ở GET → free tổng, prem+ breakdown | `src/app/api/score/route.ts` | pure read |
| Gate chương skill-tree theo tier | `skill-tree/route.ts`, `gate-exam/route.ts`, `lib/skill-tree.ts` | free 2 chương |
| Cắt field report theo studentTier | `lib/parent-report-store.ts`, `components/ParentReport.tsx` | field optional + fallback UI |
| Trend window theo tier (7/30/90d) | `lib/daily-snapshot.ts`, `progress/weekly/route.ts`, `parent-report-store.ts` | sửa NHẤT QUÁN 3 nơi tính `since` |

**Wave 2 — TRẠNG THÁI CẬP NHẬT (2026-07-06):**
- ✅ **Hệ số nhân xu theo tier — XONG** (commit `ad03bf8`): free 1/prem 1.5/ult 2, CHỈ nhân xu, 5 faucet + 4 route. Spin giữ nguyên.
- ✅ **Thi QAS gate tier + chuyển gate-level lên server — XONG** (trong Wave 1, commit `6eab3bd`): `/api/exams/start` `mode:'real'` gate premium+ VÀ level≥7 server-side.
- ❌ **BỎ HẲN "bonus xu → voucher thi/user"** (user chốt): tiền mặt ~2.7tr/user không kiểm soát nổi (faucet/multi-account).
- 🔬 **THAY: Giải thưởng Top-5 học sinh toàn quốc** — CHI PHÍ CỐ ĐỊNH 5 suất → hạng mục NGHIÊN CỨU phiên sau (tiêu chí xếp hạng chống gian lận: điểm dự đoán? mastery? phải chống bơm leaderboard; chu kỳ tháng/mùa thi; phần thưởng gì; cần bảng leaderboard + snapshot toàn hệ thống cross-user service-role như parent-report).
- 🔨 **Affiliate 35% (25/10)** — thiết kế đã chốt, xem mục dưới.
- Cap PvP/tower theo tier (truyền cap xuống RPC `tryConsumePvpFightAtomic`) — chưa làm.
- Model AI cao cấp cho Ultimate + đề độc quyền — làm Ultimate "đáng gấp đôi", chưa code.

**🔨 THIẾT KẾ AFFILIATE (nghiên cứu xong 2026-07-06 qua 3 Explore agent — code phiên sau):**
- **Chuỗi verify tiền AN TOÀN cho discount:** IPN (vnpay-ipn/momo-ipn) so `amount` cổng trả với `amount_vnd` ĐÃ LƯU lúc create (KHÔNG so PLANS) → ghi giá-đã-giảm vào CẢ `payment_transactions.amount_vnd` LẪN URL cổng thì chuỗi khớp. RPC `confirm_payment` check `p_amount>0 and p_amount<>v_amount → amount_mismatch`.
- **Điểm ghi hoa hồng:** trong IPN SAU `confirmPaymentAtomic` ok && !alreadyConfirmed (vnpay-ipn:57-59, momo-ipn:49-51). IPN KHÔNG có session → đọc coupon từ txn qua service-role.
- **Migration:** bảng `affiliate_codes` (code unique, kol_name, discount_percent default 10, commission_percent default 25, active) + `affiliate_referrals` (order_id, code_id, buyer_user_id, gross_vnd, commission_vnd, payout_status). ADD COLUMN `payment_transactions.coupon_code text`. RLS service-role ghi (mẫu `payment_transactions.sql`).
- **Flow:** `payment/create` nhận optional `coupon` → tra code active → áp discount 10% → ghi amount-giảm vào txn+URL. IPN sau confirm → RPC atomic `record_affiliate_referral` (tính commission = gross × 25%). Admin `/admin/affiliate` (mẫu shared-secret `admin-auth.ts`+`admin/redemptions`) tạo/thu hồi mã + báo cáo. `/upgrade` thêm ô coupon.
- Tái dụng: `verifyAdminSecret`, RPC FOR UPDATE trả jsonb, fail-closed 42883/PGRST202.

**⚠️ RỦI RO nhớ khi code:**
- Diagnostic + ghi mastery/snapshot: TUYỆT ĐỐI không gate (giết conversion).
- `ParentReport.tsx` hiện kỳ vọng đủ field → phải cho optional + fallback trước khi cắt, kẻo crash.
- Forge/pets/equipment/shop chạy CLIENT-side → gate tier lên vô nghĩa bảo mật + phá nguyên tắc chống pay-to-win (equipmentBonus=0 cố ý). KHÔNG gate.
- Nếu Ultimate dùng model xịn + prefer=ai bypass bank + AI ∞ → chi phí OpenAI tăng, đụng kill-switch $5/ngày → cập nhật PRICING `ai-cost.ts`.
- Question Bank return trước checkQuota → free vẫn luyện câu bank không giới hạn (chấp nhận được; cái siết là "câu MỚI hoàn toàn" prefer=ai).

**UI cần sửa khi đổi quyền lợi:** `src/app/upgrade/page.tsx:15,81` hiện ghi "Gia sư AI không giới hạn" cho Premium — nếu chọn phương án A (Premium 30/ngày) phải sửa copy.

---

## 📈 NEO THỊ TRƯỜNG VN (~2026, cần user spot-check)
- Lệ phí thi Digital SAT quốc tế ~$110 ≈ **2.7–2.9tr/lần** (neo voucher rw_1 = 50.000 xu).
- Khóa luyện SAT offline VN: **15–40tr**/khóa → framing "app rẻ hơn 20-30 lần".
- App subscription VN (neo tâm lý): Spotify 59k · YouTube Premium 79k · Netflix ~70-108k · Duolingo Super ~200k/th. → 99k = ngưỡng impulse chuẩn.
- ⚠️ WebSearch trong phiên KHÔNG phản hồi (backend US-only) → số đối thủ là từ kiến thức, user nên spot-check.

**Khuyến mãi đề xuất:** giá ra mắt Premium 49k/tháng 3 tháng đầu (bơm base + review); **gói mùa thi 3 tháng** canh lịch Digital SAT (Mar/May/Aug/Oct/Dec).

---

## 🔧 TRẠNG THÁI (đầu phiên mới)
- **Git:** origin/main = `13db3d7`, đồng bộ 0/0, tree sạch. (Admin fulfillment `27d1caf` từ phiên song song đã merge.)
- **Verify:** tsc sạch · test **254/254** · lint 0/0.
- **CHƯA code gì cho định giá** — mới nghiên cứu + lưu memory. Đang định sửa `DAILY_LIMITS` thì user dừng để lưu bàn giao.
- **Secret chưa rotate:** GitHub PAT / Vercel token / OpenAI key (chỉ DB pw đã đổi).
