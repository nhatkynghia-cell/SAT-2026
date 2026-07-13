# 🔧 OAUTH SETUP — Việc cần làm để bật đăng nhập Google / Facebook

> Trạng thái: code đã sẵn sàng (nút social + callback `/auth/callback` + middleware public prefix).
> Nút social **tự ẩn** khi provider chưa bật, **tự hiện** khi bật xong — không cần sửa code.
> Chỉ cần làm các bước dưới đây bằng tài khoản của bạn (Claude không tự làm được: cần Google/Meta developer account).

Supabase project ref: `yynszcfqcvbnuvguwtfy`
Redirect URI cố định (Supabase): `https://yynszcfqcvbnuvguwtfy.supabase.co/auth/v1/callback`

---

## 1️⃣ GOOGLE

### A. Tạo OAuth Client (console.cloud.google.com)
- [ ] Tạo / chọn project
- [ ] **OAuth consent screen**: External · tên app "Nghia Guru SAT" · email hỗ trợ · (có thể để Testing lúc beta)
- [ ] **APIs & Services → Credentials → Create Credentials → OAuth client ID**
- [ ] Application type: **Web application**
- [ ] **Authorized redirect URIs** — dán CHÍNH XÁC:
  ```
  https://yynszcfqcvbnuvguwtfy.supabase.co/auth/v1/callback
  ```
- [ ] Copy **Client ID** + **Client Secret**

### B. Bật trong Supabase (supabase.com/dashboard → project)
- [ ] **Authentication → Providers → Google** → bật toggle → dán Client ID + Secret → **Save**

---

## 2️⃣ FACEBOOK (tùy chọn — làm sau cũng được)

### A. Tạo App (developers.facebook.com)
- [ ] Create App → loại "Consumer" → thêm sản phẩm **Facebook Login**
- [ ] Settings → Basic: copy **App ID** + **App Secret**
- [ ] Facebook Login → Settings → **Valid OAuth Redirect URIs**:
  ```
  https://yynszcfqcvbnuvguwtfy.supabase.co/auth/v1/callback
  ```

### B. Bật trong Supabase
- [ ] **Authentication → Providers → Facebook** → bật → dán App ID (Client ID) + App Secret → **Save**

---

## 3️⃣ REDIRECT URLS CỦA APP (làm 1 lần, dùng chung cho mọi provider)

Supabase → **Authentication → URL Configuration → Redirect URLs** → thêm cả 2:
```
http://localhost:3000/auth/callback
https://sat-2026.vercel.app/auth/callback
```
(Nếu deploy domain khác thì thêm domain đó + `/auth/callback`.)

---

## ✅ SAU KHI XONG
- Nút Google/Facebook TỰ hiện lại trên trang `/login` (app query trạng thái provider lúc load).
- Test: bấm nút → chọn tài khoản → quay về app đã đăng nhập.
- Nếu lỗi "redirect_uri_mismatch": kiểm tra URI ở bước 1A/2A phải khớp TUYỆT ĐỐI (kể cả https, không dấu `/` thừa).
