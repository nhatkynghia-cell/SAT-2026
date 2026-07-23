# 📘 HƯỚNG DẪN USER — Làm từng bước để bán được gói (deploy production)

> Cập nhật 2026-07-21. File này viết cho BẠN (không phải lập trình viên). Làm theo đúng thứ tự. Chỗ nào gửi được cho Claude thì Claude ráp vào code + verify hộ.

---

## 🎯 BỨC TRANH TỔNG QUÁT (đọc 1 phút)

App đã chạy tốt, code sạch (test 521/521 pass). Nhưng để **bán gói thu tiền thật** còn thiếu 3 nhóm việc mà Claude KHÔNG tự làm được vì cần **tài khoản/mật khẩu của bạn**:

1. **Cổng thanh toán Stripe** — để khách quẹt thẻ trả tiền.
2. **Vài lệnh SQL trên Supabase** — mở khóa vài tính năng + siết bảo mật.
3. **Đổi lại vài mật khẩu bí mật (secret)** đã lỡ lộ trước đây.

Mỗi nhóm mình chia thành các bước bấm-là-xong bên dưới.

---

## 🟦 NHÓM 1 — CỔNG THANH TOÁN (thu tiền) — QUAN TRỌNG NHẤT

App hỗ trợ **4 cổng**: payOS (khuyên dùng VN cá nhân), Stripe (thẻ quốc tế), VNPay, MoMo.
Dưới 100tr/tháng chạy payOS cá nhân (CCCD), trên 100tr chuyển doanh nghiệp, thuế nộp đầy đủ.

### Bước 1A — payOS (chuyển khoản QR, **khuyên dùng cho khách VN**)
> payOS cho CÁ NHÂN đăng ký bằng **CCCD**, dùng chính tài khoản ngân hàng cá nhân + VietQR. Khách quét QR chuyển khoản → app cấp gói. Tiền về thẳng tài khoản bạn, không phí %.

1. Vào https://payos.vn → **Đăng ký** bằng CCCD (khoảng 5 phút, không hợp đồng/thẩm định).
2. Liên kết tài khoản ngân hàng cá nhân (MB/OCB/ACB/BIDV/KienlongBank — tên TK khớp tên đăng ký).
3. Vào **Tài khoản / API** lấy 3 chìa khóa: **Client ID**, **API Key**, **Checksum Key**.
4. Mở **Webhook** (trong dashboard payOS): dán URL `https://sat-2026.vercel.app/api/payment/payos-webhook` → bật.
5. **Gửi Claude** 3 chìa khóa trên (Client ID / API Key / Checksum Key).
6. Chạy **`migration_payos_gateway.sql`** trên Supabase SQL Editor (mở CHECK thêm 'payOS'; chưa chạy → đơn payOS vỡ dù đã chuyển khoản).

### Bước 1B — Stripe (thẻ quốc tế Visa/Master, cho khách du học)
1. Vào https://dashboard.stripe.com/register
2. Đăng ký bằng email. Không cần nhập thông tin công ty ngay — dùng **Test mode** (chế độ thử) trước.
3. Sau khi đăng nhập, ở góc trên bên phải gạt sang **"Test mode"** (có chữ Test màu cam).

### Bước 1.2 — Lấy 2 chìa khóa API
1. Vào https://dashboard.stripe.com/test/apikeys
2. Bạn sẽ thấy 2 dòng:
   - **Publishable key** — bắt đầu bằng `pk_test_...`
   - **Secret key** — bấm "Reveal" để hiện, bắt đầu bằng `sk_test_...`
3. Copy cả 2, **gửi cho Claude** (hoặc tự dán vào file `.env.local` — xem Bước 1.5).

> ⚠️ `sk_test_` là chìa khóa BÍ MẬT — đừng đăng lên mạng/ảnh chụp màn hình công khai.

### Bước 1.3 — Tạo Webhook (để Stripe báo app khi khách trả tiền xong)
1. Vào https://dashboard.stripe.com/test/webhooks
2. Bấm **"Add endpoint"**.
3. Ô **Endpoint URL** dán: `https://sat-2026.vercel.app/api/payment/stripe-webhook`
4. Ô **Select events**: tìm và tick **`checkout.session.completed`**.
5. Bấm **"Add endpoint"**.
6. Trang webhook vừa tạo có mục **"Signing secret"** → bấm "Reveal", copy chuỗi bắt đầu bằng `whsec_...`.
7. **Gửi cho Claude** chuỗi `whsec_...` này.

### Bước 1.4 — Chạy 1 lệnh SQL mở khóa cổng trên Supabase
> Không chạy bước này thì dù khách trả tiền, app sẽ báo lỗi khi ghi đơn (với mỗi cổng một file).
1. Vào https://supabase.com → mở project của bạn.
2. Menu trái chọn **SQL Editor** → **New query**.
3. Mở file **`migration_stripe_gateway.sql`** (cho Stripe) **và** `migration_payos_gateway.sql` (cho payOS), copy toàn bộ dán vào ô.
4. Bấm **Run** (góc dưới phải). Thấy "Success" là xong. (payOS file đã gồm cả vnpay/momo trong CHECK.)

### Bước 1.5 — (Nếu tự làm) Dán chìa khóa vào file cấu hình
Nếu bạn muốn tự dán thay vì gửi Claude:
1. Mở file `sat-prep-web/.env.local` bằng Notepad.
2. Thêm các dòng (thay `...` bằng chìa khóa thật):
   ```
   # payOS (cá nhân VN — khuyên dùng)
   PAYOS_CLIENT_ID=...
   PAYOS_API_KEY=...
   PAYOS_CHECKSUM_KEY=...
   # Stripe (thẻ quốc tế)
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   APP_BASE_URL=https://sat-2026.vercel.app
   ```
3. Lưu file. Báo Claude để Claude verify.

### Bước 1.6 — Thử mua bằng thẻ giả (Claude làm cùng bạn)
Stripe cho thẻ test: số **4242 4242 4242 4242**, ngày hết hạn bất kỳ tương lai (vd 12/34), CVC bất kỳ (vd 123).
→ Claude sẽ chạy thử: tạo đơn → sang Stripe → nhập thẻ giả → kiểm app có tự nâng gói không.

**✅ Xong Nhóm 1 = app bán được gói (chế độ test). Khi thật sự bán tiền thật thì đổi sang "Live mode" và lấy chìa khóa `sk_live_`/`pk_live_` tương tự.**

---

## 🟩 NHÓM 2 — CHẠY SQL TRÊN SUPABASE (mở tính năng + siết bảo mật)

Tất cả làm ở **Supabase → SQL Editor → New query → dán → Run**. Mỗi file 1 lần.

| # | File SQL cần chạy | Để làm gì | Nếu không chạy |
|---|---|---|---|
| 2.1 | `quest_claim_atomic.sql` | Chống nhận thưởng nhiệm vụ 2 lần khi bấm nhanh | Vẫn chạy được, nhưng hở lỗ cộng xu đôi khi mạng chập chờn |
| 2.2 | `migration_exam_economy_atomic.sql` | Chống cộng/trừ xu sai khi nộp bài dồn dập | Tương tự trên |
| 2.3 | RLS cho bảng `ai_chat_cache` | Chặn user đọc cache chat của người khác | Cache dùng chung, rủi ro lộ nội dung |
| 2.4 | Cột `pvp_*` (nếu muốn mở PvP) | Bật đấu trường PvP | PvP hiện tắt an toàn (báo "đang nâng cấp") |

> Các file `.sql` nằm trong thư mục dự án. Nếu không tìm thấy, nhờ Claude: "gửi nội dung file X.sql để tôi chạy". Claude đọc được file, chỉ không có quyền tự chạy trên DB của bạn.

**Cách kiểm tra đã chạy đúng:** sau khi Run thấy chữ **Success**. Nếu báo đỏ (lỗi), copy dòng lỗi gửi Claude.

---

## 🟥 NHÓM 3 — ĐỔI MẬT KHẨU BÍ MẬT ĐÃ LỘ (bảo mật)

Vài "secret" (giống mật khẩu cho máy móc) từng bị lộ trong ảnh/chat cũ. Đổi mới để an toàn.

### Bước 3.1 — Đổi `SAT_PREP_SECRET`
1. Tạo 1 chuỗi ngẫu nhiên dài (32+ ký tự). Cách nhanh: vào https://generate-secret.vercel.app/32 copy chuỗi.
2. Mở `sat-prep-web/.env.local`, sửa dòng `SAT_PREP_SECRET=...` thành chuỗi mới.
3. Lên Vercel (https://vercel.com → project sat-2026 → Settings → Environment Variables) sửa `SAT_PREP_SECRET` = chuỗi mới, đánh dấu **Sensitive**.
4. ⚠️ Chuỗi này dùng để "đóng dấu" dữ liệu streak cũ → đổi xong báo Claude chạy script ký lại, nếu không streak cũ của user sẽ bị coi là "giả" và reset.

### Bước 3.2 — Xóa GitHub token cũ
1. Vào https://github.com/settings/tokens
2. Tìm token cũ (tên có thể là `sat` gì đó) → bấm **Delete**.
3. Nếu Claude cần push code, tạo token mới (Generate new token → classic → tick `repo`) → gửi Claude.

### Bước 3.3 — Xóa Vercel token cũ
1. Vào https://vercel.com/account/tokens
2. Xóa token cũ đã lộ. (Không cần tạo mới trừ khi Claude cần deploy tự động.)

> ✅ OpenAI key và mật khẩu database Supabase — BẠN ĐÃ ĐỔI RỒI, khỏi làm lại.

---

## 🟨 NHÓM 4 — TÙY CHỌN (làm sau cũng được)

- **`chkdsk F:`** — ổ F: có lỗi phần cứng. Mở Command Prompt (bấm chuột phải → Run as administrator), gõ `chkdsk F: /f /r`, Enter, gõ `Y`, khởi động lại máy. (Nếu đã bỏ hẳn ổ F: dùng ổ C: thì bỏ qua.)
- **OAuth Google** ("Đăng nhập bằng Google") — cần tạo project Google Cloud. Xem file `OAUTH_SETUP.md`. Code đã sẵn, nút tự hiện khi bật.
- **MoMo/VNPay** — cần pháp nhân doanh nghiệp mới lấy được. Để sau, dùng Stripe trước.

---

## 🧩 GIẢI THÍCH KỸ: "VIỆC USER CHỐT → CLAUDE LÀM" (Admin Fulfillment)

Bạn hỏi phần này chưa hiểu — giải thích chậm:

### Bối cảnh
App có tính năng **đổi xu lấy quà thật**: học sinh cày xu → đổi lấy quà (voucher, đồ...). Khi học sinh bấm "đổi quà", hệ thống tạo 1 **phiếu chờ xử lý** (pending). Ai đó (admin = bạn hoặc trợ lý) phải **duyệt phiếu** rồi gửi quà thật cho học sinh, sau đó bấm "đã giao" (fulfilled).

### Vấn đề cần bạn chốt
Trang admin để duyệt phiếu này cần **khóa lại** — không thể để ai cũng vào bấm "đã giao" hay "hủy + hoàn xu". Có 2 cách khóa, bạn chọn 1:

**Cách (a) — Mật khẩu chung đơn giản** ⭐ (khuyên dùng cho giai đoạn beta)
- Đặt 1 mật khẩu bí mật (gọi là `ADMIN_SECRET`). Ai biết mật khẩu đó mới vào được trang duyệt phiếu.
- Giống như 1 cái khóa số: đúng mã thì mở.
- **Ưu:** Claude làm xong trong 1 buổi, không cần gì thêm từ bạn ngoài việc nghĩ ra 1 mật khẩu.
- **Nhược:** ai biết mật khẩu đều là "admin" — không phân biệt được nhiều người.
- Hợp lý khi chỉ có mình bạn (hoặc 1-2 người) duyệt phiếu.

**Cách (b) — Hệ thống phân quyền đầy đủ**
- Mỗi tài khoản có "vai trò" (role): học sinh / admin. Chỉ tài khoản gắn cờ admin mới vào được.
- **Ưu:** chuẩn dài hạn, nhiều admin, biết ai làm gì.
- **Nhược:** phải thêm cột database + cấu hình phân quyền → lâu hơn, phức tạp hơn.
- Hợp lý khi app lớn, có đội ngũ vận hành.

### 👉 Bạn chỉ cần trả lời: **"chọn (a)"** hoặc **"chọn (b)"**
- Chọn (a): Claude làm ngay, bạn chỉ cần nghĩ 1 mật khẩu (vd `PhuGia@Admin2026`) đặt vào `.env.local` + Vercel.
- Chọn (b): Claude sẽ hỏi thêm vài chi tiết rồi làm dài hơn.

> **Thực tế: trang admin duyệt phiếu ĐÃ được làm bằng cách (a) ở phiên trước rồi** (`ADMIN_SECRET`). Nên nếu bạn hài lòng cách (a), coi như xong — chỉ cần đặt 1 mật khẩu `ADMIN_SECRET` mạnh vào cấu hình. Nếu muốn nâng lên (b) sau này thì báo Claude.

---

## 🧩 GIẢI THÍCH KỸ: "CHỐT GIÁ 4 GÓI"

Trong code đang để giá **đề xuất** (chưa phải giá chính thức):

| Gói | Tháng | Năm |
|-----|-------|-----|
| Premium | 499.000₫ | 3.990.000₫ |
| Ultimate | 990.000₫ | 7.990.000₫ |

- Đây chỉ là **số gợi ý**, đổi được dễ dàng (chỉ sửa 1 bảng trong code).
- Bạn cần **chốt con số cuối** trước khi tạo sản phẩm trên Stripe (vì Stripe cần biết giá để hiển thị cho khách).
- Gửi Claude: "Premium tháng X, năm Y; Ultimate tháng Z, năm W" → Claude cập nhật.

> Gợi ý: giá cao neo giá trị (tệp du học có điều kiện) + chừa chỗ giảm giá cho mã KOL/affiliate sau này. Nhưng quyết định là của bạn.

---

## ✅ CHECKLIST NHANH (in ra, tick dần)

**Bán được gói (tối thiểu):**
- [ ] 1A Đăng ký payOS bằng CCCD → liên kết TK ngân hàng → lấy Client ID/API Key/Checksum Key → gửi Claude
- [ ] 1B Tạo tài khoản Stripe (Test mode) → lấy `pk_test_` + `sk_test_` → gửi Claude
- [ ] 1B Tạo webhook Stripe → lấy `whsec_` → gửi Claude
- [ ] 1A payOS: bật webhook URL `.../api/payment/payos-webhook` trong dashboard
- [ ] 1.4 Chạy `migration_payos_gateway.sql` + `migration_stripe_gateway.sql`
- [ ] Claude verify mua thử (payOS: quét QR chuyển khoản vài nghìn; Stripe: thẻ 4242...)
- [ ] Chốt giá 4 gói → gửi Claude
- [ ] Đặt `ADMIN_SECRET` (mật khẩu admin) → xác nhận cách (a)

**Bảo mật (nên làm sớm):**
- [ ] 3.1 Đổi `SAT_PREP_SECRET` + báo Claude ký lại streak
- [ ] 3.2 Xóa GitHub token cũ
- [ ] 3.3 Xóa Vercel token cũ

**Tối ưu (làm sau):**
- [ ] 2.1–2.3 Chạy SQL atomic + RLS
- [ ] 4. chkdsk F: / OAuth Google / MoMo

---

*Cần Claude làm gì thì cứ nói. Hầu hết bước trên bạn chỉ cần copy chìa khóa gửi Claude, phần ráp code + kiểm thử Claude lo.*
