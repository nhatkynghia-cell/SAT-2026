# 🔐 ROOT E — Thiết kế fix (judge-panel, 2026-07-03)

> Đóng lỗ hổng ROOT E (user PATCH thẳng `user_economy.coins`/`user_mastery.skills` qua PostgREST, bỏ qua `/api/economy`). Xem `SECURITY_AUDIT_2026-07-03.md` mục ROOT E.
> Nguồn: workflow `root-e-fix-design` (7 agent: 3 phương án × judge + Opus synthesis). **CHƯA IMPLEMENT — chờ user chốt 2 quyết định ở cuối.**

## KHUYẾN NGHỊ: Service-role admin client + REVOKE (kèm parameterize RPC bắt buộc)

**Vì sao service-role thắng, dù phải ôm 1 god-key:** gốc rễ là server ghi bằng CHÍNH JWT của user (role `authenticated`) → ở tầng DB KHÔNG phân biệt được "app-server thay mặt user" với "browser user ghi thẳng" (cùng credential). Điều này **giết chết phương án security-definer**: một setter `SECURITY DEFINER set_economy(p_user_id, p_coins)` grant cho `authenticated` chỉ chặn cross-user (`auth.uid()=p_user_id`), nhưng attacker gọi với uid CỦA MÌNH + `p_coins:999999999` vẫn qua → ROOT E y nguyên, chỉ chuyển từ PATCH sang rpc(). Muốn definer an toàn phải chuyển TOÀN BỘ logic tính coins/mastery (delta + cap) vào SQL = rewrite lớn, chồng lấn ROOT A/B, không khả thi làm point-fix.

Cách DUY NHẤT tách "danh tính server" khỏi "danh tính client" trong kiến trúc hiện tại: cho server một **credential khác mà client không có** — service-role key. Đúng là god-key, nhưng là pattern chuẩn Supabase cho mutation server-authoritative; Next.js giữ env non-`NEXT_PUBLIC_` chỉ ở server. Rủi ro lộ là THẬT nhưng KIỂM SOÁT ĐƯỢC, còn security-definer để lại lỗ hổng CHƯA đóng.

Column-grant (phương án C) tự judge kết luận non-viable đơn lẻ → loại.

## KẾ HOẠCH TRIỂN KHAI (thứ tự KHÔNG làm sập app đang chạy)

**Mẹo giữ app sống:** RPC parameterize cho `p_user_id uuid default auth.uid()` → code CŨ vẫn chạy sau khi chạy SQL nhưng trước khi deploy code mới; REVOKE chạy CUỐI CÙNG, chỉ sau khi code mới xác nhận sống.

**[CLAUDE code — chưa ảnh hưởng prod tới khi deploy]**
- `src/lib/supabase/admin.ts` (MỚI) — factory client service-role; đầu file `import 'server-only'` (build gãy to nếu client component lỡ import); throw rõ ràng nếu thiếu key.
- Chuyển đường GHI sang admin client: `economy-store.ts` (saveEconomy, savePvpState), `mastery-store.ts`, `gate-store.ts`, `ai-usage-store.ts`, `cost-ledger-store.ts`, `progress-store.ts`, `goals-store.ts`. GIỮ đường ĐỌC trên `createClient` per-request (không đổi quyền).
- **Parameterize RPC** (`consume_pvp_fight`, `increment_ai_usage`, `increment_ai_cost_ledger`) nhận `p_user_id uuid default auth.uid()`, dùng `p_user_id` thay `auth.uid()` bên trong — vì service-role KHÔNG có user JWT nên `auth.uid()` = NULL. Cập nhật call site truyền `userId` tường minh. **(Đây là lỗi CẢ 3 draft đều sót — chí mạng nếu quên.)**
- 2 SQL: `root_e_step1_rpc.sql` (tạo hàm parameterized + GRANT EXECUTE cho `service_role`) và `root_e_step2_revoke.sql` (khóa).
- Cập nhật `.env.example` doc `SUPABASE_SERVICE_ROLE_KEY` (server-only).

**[USER làm trên prod / thêm secret — ĐÚNG thứ tự này]**
1. Thêm `SUPABASE_SERVICE_ROLE_KEY` (Supabase Dashboard → Settings → API → `service_role`) vào env prod **và** `.env.local`. Vô hại khi code cũ chưa dùng. Xác nhận KHÔNG prefix `NEXT_PUBLIC_`.
2. Chạy `root_e_step1_rpc.sql` (hàm có `p_user_id default auth.uid()` → code cũ vẫn chạy).
3. Deploy code Claude mới. Giờ mọi ghi server đi qua service-role client.
4. **Soak 24–48h.** Theo log: ghi thành công, không fallback, không lỗi `auth.uid() null`, PvP/quota chạy.
5. Chạy `root_e_step2_revoke.sql`: `revoke insert,update,delete on user_economy,user_mastery,user_ai_usage,ai_cost_ledger,user_progress,user_goals from authenticated;` + `revoke execute on <RPC nhạy cảm> from authenticated;` (GIỮ SELECT để client đọc số dư).
6. Verify hết lỗ hổng: browser `PATCH user_economy.coins` → **403**, `rpc('set_economy',{coins:999})` → **403**. App vẫn chạy qua `/api/economy`.

Rollback: revert code trước bước 5; sau bước 5 thì re-GRANT bằng SQL.

## RỦI RO LỚN NHẤT + GIẢM THIỂU
**Service-role key lộ vào client bundle / log = toàn bộ DB bị chiếm (đọc/ghi mọi user, bỏ qua RLS)** — tệ hơn ROOT E nếu xảy ra.
- `import 'server-only'` đầu `admin.ts` → build gãy nếu client import.
- KHÔNG bao giờ `NEXT_PUBLIC_`; KHÔNG `console.log` key/config admin client.
- Sau build prod đầu: grep `.next/static` tìm prefix key để chắc KHÔNG có.
- `.env.local` giữ git-ignored; quét lịch sử git phòng lỡ commit.
- Coi là rotate-khi-nghi-ngờ (gộp vào task rotate secret sẵn có).

## CÓ GIÚP ROOT A/B KHÔNG?
**KHÔNG — là điều kiện tiên quyết, không phải fix.** ROOT E là master key: khi E hở, A (client tự khai isCorrect) và B (quest double-claim) vô nghĩa vì attacker ghi thẳng coins. Đóng E → A/B thành bề mặt còn lại, PHẢI đóng trước. Nhưng service-role vẫn ghi GIÁ TRỊ app tính từ input client → `saveEconomy(coins)` vẫn lưu số route được bảo. A/B cần việc riêng: grading server-side (server giữ đáp án, client không khai đúng/sai) + quest-claim-state server. Lên kế hoạch follow-up riêng. (Lưu ý: race `gate-store.ts` trên `user_mastery.skills` là ROOT C — không do đổi client giải quyết, cần hàm atomic.)

## ⬇️ QUYẾT ĐỊNH CẦN USER CHỐT (trước khi Claude code)
1. **Duyệt đưa `SUPABASE_SERVICE_ROLE_KEY` làm secret server-only?** Đây là tradeoff KHÔNG tránh được — thứ tách server khỏi client. Nếu không muốn ôm full-access key → phương án thay thế duy nhất đóng E là rewrite lớn logic economy/mastery vào SQL (hàng tuần, chồng A/B) — KHÔNG khuyến nghị làm point-fix.
2. **Xác nhận chạy được 2 SQL script theo thứ tự, soak 24–48h giữa deploy và REVOKE cuối?** Nếu cần khóa trong-ngày không soak → báo Claude test full sequence trên staging project trước.

Chốt 2 điều trên → Claude viết code + 2 SQL script.
