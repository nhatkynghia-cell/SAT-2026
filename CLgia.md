# 💰 CLgia.md — Bàn giao NGHIÊN CỨU ĐỊNH GIÁ THEO PHỄU (2026-07-06)

> File này gói trọn nghiên cứu định giá phiên 2026-07-06 (context đã full) để mở phiên mới tiếp tục.
> Chi tiết cũng lưu ở memory Claude: `sat-prep-funnel-pricing.md`.

---

## 📋 CÂU LỆNH MỞ PHIÊN MỚI (copy nguyên khối)

```
Đọc memory.md + master_task_list.md + CLgia.md trong
D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\
rồi tiếp tục NGHIÊN CỨU + TRIỂN KHAI ĐỊNH GIÁ THEO PHỄU. Trả lời tiếng Việt.

Trước khi làm gì: export PATH="$PATH:/c/Program Files/nodejs" rồi verify môi trường
(tsc + test + lint) trong sat-prep-web/. Baseline: tsc sạch · test 254/254 · lint 0/0.
origin/main = 13db3d7.

Token: ~/.gitcreds-sat2026 (git push — ghép "/nhatkynghia-cell/SAT-2026.git" vào cuối)
+ ~/.vercel-token. Repo: github.com/nhatkynghia-cell/SAT-2026 (main).
DB direct: postgresql://postgres:SatPrep2026@db.yynszcfqcvbnuvguwtfy.supabase.co:5432/postgres

CLgia.md có 2 QUYẾT ĐỊNH TÔI CẦN TRẢ LỜI (giá + value-ladder fork). Đọc rồi hỏi tôi.
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

| Trục | 🆓 Free (mồi) | ⭐ Premium (chủ lực) | 💎 Ultimate (cao cấp) |
|---|---|---|---|
| **AI/ngày** | 5 | **30** (có trần)* | **∞** |
| **Điểm dự đoán** | Chỉ tổng 400–1600 | + breakdown môn + focus skills | + dự báo theo thời gian |
| **Skill tree** | 2 chương đầu | Toàn bộ cây | Toàn bộ |
| **Adaptive "Luyện mục tiêu"** | Đề xuất chung | Cá nhân hóa đầy đủ | Đầy đủ |
| **Thi thật / QAS** | 🔒 Khóa | ✅ Mở | ✅ + đề độc quyền |
| **Sổ tay câu sai + SRS** | 20 câu, không SRS | Không giới hạn + SRS | Đầy đủ |
| **Báo cáo phụ huynh** | Cơ bản + trend 7 ngày | Full radar + trend 30 ngày | + trend 90 ngày + 20 bài |
| **Bonus xu/tháng** | – | – | **~4.500 xu → voucher thi thật** |
| **RPG (PvP/tower/spin)** | Rộng rãi (giữ chân) | + hệ số xu ×1.5 | ×2 |

*= phụ thuộc quyết định #2 bên dưới.

**3 khác biệt "cảm nhận được" của Ultimate** (sửa lỗi gốc): (1) AI ∞ vs trần Premium; (2) **bonus xu/tháng → voucher thi SAT thật** (reward-to-real đã có sẵn code): 199k×12=2.39tr đổi được voucher ~2.7tr → "tự hoàn vốn", đòn bán mạnh nhất với phụ huynh; (3) báo cáo phụ huynh 90 ngày.

---

## 🔴 2 QUYẾT ĐỊNH USER CẦN TRẢ LỜI (chưa chốt)

### ① GIÁ — user nói "tính cao lên sau, còn làm Affiliate" (2026-07-06)
- Giữ `PLANS` placeholder hiện tại (99k/990k · 199k/1.990k) — **CHƯA chốt cứng.**
- **Affiliate reshapes giá:** KOL/affiliate EdTech VN ăn hoa hồng **20–40%** → cần **list price cao hơn** + đòn "giá niêm yết cao + phát mã giảm 20-30% qua affiliate" (người mua thấy deal, affiliate ăn hoa hồng, vẫn lãi trên anchor thổi cao).
- **⚠️ Kỹ thuật CHƯA có:** `payment/create` chốt giá cứng từ `PLANS`, KHÔNG nhận coupon. Affiliate cần subsystem mới: (a) tracking mã referral, (b) áp discount ở payment/create, (c) quy hoa hồng + payout. → Hạng mục tương lai, xây trước khi chạy affiliate.
- **Cần hỏi user:** % hoa hồng affiliate dự kiến? → quyết list price cuối + có xây discount/referral ngay không.

### ② VALUE-LADDER FORK (AskUserQuestion bị lỗi phiên trước → CHƯA trả lời)
**Premium có nên bị TRẦN AI (30/ngày) để Ultimate khác biệt, hay giữ Premium ∞?**
- **Phương án A** — Premium 30/ngày, Ultimate ∞: khác biệt AI rõ ràng, người học nặng mùa thi chạm trần → lên Ultimate. → CHỈ phương án này mới sửa `DAILY_LIMITS`.
- **Phương án B** — Premium giữ ∞, Ultimate khác biệt bằng bonus xu + report 90d + đề độc quyền (không đụng AI quota).
- ⚠️ Neo tâm lý VN: hiếm học sinh phổ thông chạm 30 câu AI/ngày → nếu chọn A, khác biệt AI có thể "không cảm nhận được" → bonus xu + report vẫn phải gánh thuyết phục.

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

**Wave 2 — cần migration DB / mô hình tài chính:**
- Bonus xu/tháng Ultimate (cột `last_bonus_month` + lazy-grant) — cần mô hình tài chính voucher + chống multi-account farm + trần fulfillment/tháng TRƯỚC khi bật (chi phí tiền mặt thật 2.7tr/voucher).
- Cap PvP/tower theo tier (truyền cap xuống RPC `tryConsumePvpFightAtomic`, không chỉ nhánh non-atomic).
- Thi QAS: gate tier + CHUYỂN gate-level từ client lên server (đang có lỗ hổng `/api/exams/start`) — một công đôi việc.
- Hệ số nhân xu theo tier (sửa đồng bộ mọi faucet: grade/exams-grade/vocab).

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
