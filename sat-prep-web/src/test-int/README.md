# Integration tests — money-path endpoints (task 9.8)

Bộ integration test cho các endpoint **gắn tiền thật** (coins/XP đổi quà, cấp gói trả phí).
Chạy **THẬT** route handler + store + pure logic của app trên một **fake Supabase in-memory**
(không cần DB/creds), nên CI chạy được offline.

## Chạy

```bash
npm test          # chạy cả unit (src/**/*.test.ts) + integration (src/test-int/**/*.test.mjs)
# hoặc riêng integration:
node --import ./src/test-int/loader-register.mjs --test "src/test-int/**/*.test.mjs"
```

## Cách hoạt động

`node --test` KHÔNG resolve alias `@/` và một số specifier chỉ sống trong Next runtime.
`loader.mjs` (đăng ký qua `loader-register.mjs`) là **resolve hook** remap:

| specifier | → |
|---|---|
| `@/lib/supabase/server` · `@/lib/supabase/admin` | fake client in-memory (`fake-db.mjs`) |
| `next/server` | stub `NextResponse` (kế thừa `Response`) |
| `server-only` | no-op |
| `@/xxx` | `src/xxx` (+ thử `.ts`/`/index.ts`) |

→ route + store + engine THẬT chạy nguyên vẹn; chỉ **driver Supabase** bị thay bằng RAM.
`fake-db.mjs` mô phỏng query-builder + 3 RPC atomic (`redeem_reward`, `confirm_payment`,
`consume_pvp_fight`) theo đúng semantics file SQL, **deep-clone** ở mọi ranh giới đọc/ghi
(giống PostgREST trả JSON mới mỗi lần → mutate object trả về KHÔNG đụng "DB"; chỉ
UPDATE/UPSERT round-trip mới persist).

## Bất biến được phủ (money-safety)

- **grade / exams-grade**: chấm từ đáp án server (không tin client `isCorrect`), cộng thưởng
  đúng 1 lần, replay → 404/bỏ qua, combo streak kẹp 1.5×, ownership, thiếu field → 400.
- **economy**: `answer`/`exam` đã gỡ → 400; quest double-claim → 409; spend kiểm số dư;
  spin 1 lượt/ngày; **PvP** win-path (reward đúng rank kế), thua giữ rank, cap 10 trận,
  `targetRank` client bị bỏ qua (không nhảy rank ăn jackpot), fail-safe khi chưa migration.
- **redeem**: giá từ REWARDS (bỏ qua `cost` client), thiếu xu/forge/no_row → 400,
  RPC chưa có → 503 fail-closed (không trừ xu), GET chỉ phiếu của mình + mới-nhất-trước.
- **vocab**: chỉ thưởng khi từ đến hạn + "đã nhớ"; farm chặn (ôn lại → không due); box Leitner.
- **payment IPN (momo + vnpay)**: CHỈ chữ ký hợp lệ + success mới cấp gói; chữ ký giả → từ chối;
  idempotent (retry → không double-grant); sai số tiền → không cấp; chưa cấu hình/chưa migration
  → không cấp. VNPay ký thật bằng lib (HMAC-SHA512, amount ÷100).
- **payment/create**: giá từ PLANS (bỏ qua `amount` client), phải đăng nhập, gói/cổng sai → 400.

## ⚠️ GIỚI HẠN FIDELITY (đọc kỹ — tránh tự-tin-giả)

1. **KHÔNG kiểm được race đồng thời THẬT.** Fake single-threaded (mỗi call resolve tuần tự).
   Các chốt atomic (`.eq('answered',false)` CAS ở grade, `FOR UPDATE` trong 3 RPC) được kiểm
   ở dạng **tuần tự / đã-commit**, KHÔNG phải hai request đua nhau in-flight. Bằng chứng race
   an toàn thật đã có ở tầng SQL + verify live prod (memory: RACE 5 concurrent redeem/pvp →
   không double-grant). Bộ test này KHÔNG thay thế điều đó; đừng viết test tự nhận "chống race".
2. **KHÔNG mô phỏng RLS.** Fake dùng chung 1 store cho anon + admin. Isolation cross-user ở
   tầng app (`.eq('user_id', …)`) có kiểm (vd redeem GET), nhưng RLS Postgres (`auth.uid()`)
   đã verify RIÊNG (memory 1.3: cả 7 bảng `rls_enabled=true`, anon REST → `[]`).
3. **Rate-limit** dùng state process-global; test đặt user id riêng mỗi case để tránh nhiễu.
   Chưa có test drive >N request để bắt 429 (guard throttle — nice-to-have).

## Ngoài phạm vi (rủi ro APP đã ghi nhận, KHÔNG viết test ở đây)

- `GET /api/migrate-data`: công cụ migrate 1-lần từ Streamlit cũ. Upsert coins/xp từ file JSON
  cục bộ, GET + không auth-gate + không rate-limit + ghi đè (không merge). Trên prod TRƠ vì
  file bị gitignore (`fs.existsSync` → no-op). Là smell thật nhưng việc xử lý (xóa/khoá) do
  user quyết — viết test = ngầm chứng thực hành vi rủi ro nên cố ý KHÔNG làm.
