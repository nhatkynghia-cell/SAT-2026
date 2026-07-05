# ▶️ CÂU LỆNH KHỞI ĐỘNG PHIÊN SAU

> Cập nhật 2026-07-05. HEAD `origin/main` = **27651d8**. Baseline: tsc sạch · test **178/178** · lint 0/0 · build **60 pages**.

Copy nguyên khối dưới đây, dán vào ô chat để mở phiên mới:

---

```
Đọc memory.md + master_task_list.md trong
D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\
rồi tiếp tục dự án. Đọc kỹ 2 block "ĐỌC ĐẦU TIÊN" đầu memory.md (PARENT DASHBOARD +
DIAGNOSTIC ONBOARDING). Trả lời tiếng Việt.

Trước khi làm gì: export PATH="$PATH:/c/Program Files/nodejs" rồi verify môi trường
(tsc + test + build + lint) trong sat-prep-web/. Baseline mong đợi:
tsc sạch · test 178/178 · lint 0/0 · build 60 pages. origin/main = 27651d8.

Token đã lưu: ~/.gitcreds-sat2026 (git push — format file = "https://user:token@github.com",
push phải GHÉP "/nhatkynghia-cell/SAT-2026.git" vào cuối) + ~/.vercel-token (Vercel API).
Team Vercel: sat-2027 | project: sat-2026 | app prod: https://sat-2026.vercel.app
Repo: github.com/nhatkynghia-cell/SAT-2026 (main). Account test: truongsonht.xd@gmail.com / Nghia@123 (UUID c43f015e-...).
DB direct: postgresql://postgres:SatPrep2026@db.yynszcfqcvbnuvguwtfy.supabase.co:5432/postgres
Service-role: trong .env.local + Vercel (sensitive) — KHÔNG ghi vào git.
Cài SQL/verify: npm i pg --no-save --legacy-peer-deps (đặt script TRONG sat-prep-web/, KHÔNG /tmp).

✅ ĐÃ ĐÓNG HẾT BLOCKER BẢO MẬT (ROOT A–E + rate-limit + ROOT E step2 revoke). KHÔNG còn nợ bảo mật.

SECRET chưa rotate (HỎI tôi đã đổi chưa rồi TICK):
[ ] GitHub PAT ghp_...HETIG (lộ ảnh)  [ ] Vercel token (lộ chat)  [ ] OpenAI key  [x] DB password (đã đổi)
Nếu đã đổi git/vercel token → token cũ HẾT hiệu lực → xin token MỚI lưu lại.

VIỆC PHIÊN SAU — theo THỨ TỰ (chi tiết từng việc ở NEXT_SESSION.md mục dưới):
1. 🟡 CỔNG THANH TOÁN (khung xong 55ff53b) — CẦN TÔI: (a) chốt giá 4 gói
   (placeholder 99k/990k/199k/1990k), (b) creds sandbox VNPay (TMN_CODE+HASH_SECRET) +
   MoMo (PARTNER_CODE+ACCESS_KEY+SECRET_KEY). Có → verify roundtrip LIVE + đối chiếu
   field-order chữ ký IPN MoMo (điểm dễ sai nhất, chưa có sample thật).
2. 🟢 ADMIN FULFILLMENT (phiếu quà pending→fulfilled) — TÔI chọn: (a) shared-secret env
   nhẹ (Claude làm NGAY, không cần gì thêm) hay (b) role system đầy đủ. Gợi ý: pattern
   service-role cross-user của Parent Dashboard tái dụng được.
3. ⏳ Beta 100 users (pháp lý trẻ vị thành niên + tuyển).

Việc user-side tôi đã làm trước phiên: [điền: chốt giá? / cấp creds? / chọn hướng admin (a/b)? / rotate secret nào?]
```

---

## 🔴 VIỆC CỦA TÔI (USER) — quyết ĐẦU PHIÊN, Claude KHÔNG tự làm được

### 1️⃣ CỔNG THANH TOÁN VNPay + MoMo — khung xong `55ff53b`, chỉ thiếu 2 đầu vào của tôi
- **(a) Chốt giá 4 gói** (đang placeholder): Premium tháng **99k** / Premium năm **990k** /
  Ultimate tháng **199k** / Ultimate năm **1990k** VND → giữ hay đổi số nào?
- **(b) Creds sandbox** (lấy ở trang merchant → dán cho Claude hoặc tự thêm `.env.local`+Vercel sensitive):
  - VNPay: `VNPAY_TMN_CODE` + `VNPAY_HASH_SECRET`
  - MoMo: `MOMO_PARTNER_CODE` + `MOMO_ACCESS_KEY` + `MOMO_SECRET_KEY`
- **Có 2 thứ này → Claude:** nạp env → verify roundtrip live (tạo đơn → redirect cổng →
  IPN cấp gói) + **đối chiếu field-order chữ ký IPN MoMo với payload thật** (unit test đã
  phủ theo spec v2 nhưng chưa có sample IPN thật — điểm dễ sai nhất). VNPay dùng lib nên yên tâm.

### 2️⃣ ADMIN FULFILLMENT (đánh dấu phiếu quà pending→fulfilled) — tôi CHỌN 1 hướng
- **(a) Shared-secret env nhẹ** (`ADMIN_SECRET` bảo vệ 1 route) — nhanh, đủ beta.
  👉 Chọn cái này → **Claude làm NGAY trong phiên, KHÔNG cần gì thêm từ tôi.**
- **(b) Role system đầy đủ** (cột role + RLS admin) — chuẩn dài hạn, nặng hơn.
  💡 Parent Dashboard vừa làm đã có pattern service-role đọc/ghi cross-user → tái dụng ý tưởng được.

### 3️⃣ ROTATE 3 SECRET còn lại (đã LỘ) — tôi làm trên dashboard
- [ ] GitHub PAT `ghp_...HETIG` → Delete + tạo mới → gửi Claude lưu `~/.gitcreds-sat2026`
- [ ] Vercel token `vcp_...` → xóa + tạo mới → gửi Claude lưu `~/.vercel-token`
- [ ] OpenAI key → thu hồi + tạo mới + cập nhật biến `OPENAI_API_KEY` trên Vercel
- [x] DB password Supabase — ĐÃ ĐỔI ✅

### 4️⃣ BETA LAUNCH 100 users — tôi chuẩn bị (không phải việc code)
- Pháp lý điều khoản trẻ vị thành niên + kênh tuyển user.

---

## 🟢 VIỆC CLAUDE TỰ LÀM ĐƯỢC (không chờ tôi) — nếu tôi chưa sẵn đầu vào trên
1. **[nếu tôi chọn admin hướng (a)]** Admin fulfillment route shared-secret — gọn 1 phiên.
2. Đánh bóng UI 3 feature mới (Diagnostic + Parent + panel xu hướng tuần) trên nhiều kích thước màn hình.
3. ✅ ~~Panel "xu hướng tuần" cho học sinh ở `/dashboard`~~ — ĐÃ LÀM (2026-07-05, `27651d8`):
   tách `WeeklyTrendPanel` dùng chung dashboard + ParentReport, route `/api/progress/weekly`.

---

## 📊 ĐỐI CHIẾU KẾ HOẠCH (sau phiên 2026-07-05)

### PHASE 2 — MVP LAUNCH
| Việc | Trạng thái |
|---|---|
| Tier foundation | ✅ `fd4d877` |
| Reward-to-real (xu→quà) | ✅ `acf2729` |
| Cổng thanh toán VNPay/MoMo (khung) | ✅ `55ff53b` — **verify live CHỜ creds+giá của tôi** |
| **Diagnostic Onboarding** | ✅ `df0a10e` (2026-07-05) |
| **Parent Dashboard** | ✅ `9fb1d46` (2026-07-05) |
| Admin fulfillment | ⏳ **CHỜ tôi chọn hướng (a/b)** |
| Beta 100 users | ⏳ chờ pháp lý + tuyển |

### ĐÃ ĐÓNG HOÀN TOÀN (nền + bảo mật)
- Phase 1 + 1.5 TRỌN · ROOT A–E + rate-limit + ROOT E step2 revoke (BLOCKER #1 đóng)
- Integration Sprint T1–T5 + Tower adaptive + PvP economy + Nhóm 7 (#6/#8/#9)

### PHASE 3+ (chưa bắt đầu)
- Mobile (React Native) · Social/Retention · Real PvP WebSocket · Season Pass · B2B/ACT/IELTS/Fundraising

---

## 🔧 Ghi chú kỹ thuật (nhớ trước khi code)
- **AGENTS.md:** Next.js 16 BIẾN ĐỔI (Turbopack, `proxy.ts` thay middleware) — đọc `node_modules/next/dist/docs/` khi nghi API.
- **Bảng prod đã tạo (Claude qua direct pg — user KHÔNG cần chạy SQL):** user_subscriptions,
  reward_redemptions, payment_transactions, **parent_share_codes, daily_snapshots** (mới phiên này).
  Tất cả RLS SELECT own + ghi service-role.
- **MUST-VERIFY khi có creds:** field-order chữ ký IPN MoMo (`payment-momo.ts`) với payload thật.
- **Money/cross-user surface — nguyên tắc:** client gửi ý định, SERVER quyết số liệu; ghi chỉ
  service-role; RPC atomic idempotent. Parent Dashboard: cross-user read gom vào `parent-report-store.ts` (chỉ tiến độ, không PII).
- **Bug deploy Vercel:** `NEXT_PUBLIC_*` env PHẢI `plain` không `sensitive`. SERVICE_ROLE_KEY + creds cổng = sensitive.
- **⚠️ Verify browser:** `preview_fill` set DOM value KHÔNG trigger React onChange → login form
  controlled-input không submit giá trị. Đường no-auth verify được không cần login; đường cần auth
  → seed pg + kiểm logic 401. (Nếu cần login browser thật: tìm cách set state qua devtools/API.)
- **Test lib thuần:** `node --test` KHÔNG resolve alias `@/` lẫn value-import extensionless `./x` →
  module thuần đọc JSON qua fs, inline hằng số thay vì import value, import type `.ts` đường tương đối.
- **`vnpay@2.5.0`** trong package.json (`--legacy-peer-deps`, react 19). `pg` KHÔNG trong lock (cài `--no-save`).
