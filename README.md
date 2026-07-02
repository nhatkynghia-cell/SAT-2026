# SAT-2026 — Ivy League Math Academy (SAT Prep RPG)

Ứng dụng luyện thi **Digital SAT** (Toán + Reading/Writing) kết hợp cơ chế **game nhập vai (RPG)** cho học sinh Việt Nam. Bài giảng & câu hỏi cá nhân hóa bằng AI, giao diện tiếng Việt, đề bài SAT giữ chuẩn tiếng Anh.

> ⚠️ **App nằm trong thư mục con [`sat-prep-web/`](sat-prep-web/)** — không phải ở gốc repo. Mọi lệnh dev/build/deploy đều chạy trong đó.

---

## Tech stack

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js 16.2.9 (App Router + Turbopack, `proxy.ts` thay middleware) |
| Ngôn ngữ | TypeScript, React 19 |
| AI | OpenAI `gpt-4o-mini` (proxy server-side, ẩn key) |
| DB + Auth | Supabase (PostgreSQL + RLS) |
| Test | `node --test` (native TS, cần Node ≥ 23.6) |

---

## Chạy local

```bash
cd sat-prep-web
npm ci --legacy-peer-deps      # ⚠️ cần --legacy-peer-deps (xem Gotchas)
cp .env.example .env.local     # rồi điền giá trị (xem Env vars)
npm run dev                    # http://localhost:3000
```

Kiểm tra chất lượng (giống CI):

```bash
npx tsc --noEmit && npm test && npm run lint    # tsc sạch · 122 test · lint 0/0
npm run build                                    # 43 pages
```

---

## Env vars (bắt buộc)

Điền vào `sat-prep-web/.env.local` (local) hoặc Environment Variables (Vercel):

| Biến | Ghi chú |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `SAT_PREP_SECRET` | Chữ ký HMAC chống sửa save. ⚠️ **THIẾU → app crash khi khởi động** (không có fallback). Sinh: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `OPENAI_MODEL` | (tùy chọn) mặc định `gpt-4o-mini` |

---

## Database (Supabase)

Chạy các file SQL trong [`sat-prep-web/`](sat-prep-web/) qua **Supabase → SQL Editor** (mỗi file 1 lần, an toàn chạy lại):

| File | Bảng | RLS |
|---|---|---|
| `phase1_5_tables.sql` | `user_mastery`, `user_goals`, `user_ai_usage`, `user_vocab_srs` + cột SRS | `auth.uid()=user_id` |
| `phase1_5_pvp_mistakes.sql` | cột PvP + `user_mistakes.skill_id` | — |
| `ai_cost_ledger.sql` | `ai_cost_ledger` (kill-switch chi phí AI) | `authenticated` (dùng chung) |
| `questions.sql` | `questions` (Question Bank tái dùng) | `authenticated` (dùng chung) |
| `user_progress.sql` | `user_progress` (streak/inventory, `data_json` TEXT giữ chữ ký HMAC) | `auth.uid()=user_id` |
| `ai_chat_cache.sql` | `ai_chat_cache` (cache Gia sư AI) | `authenticated` (dùng chung) |

> Store đọc/ghi Supabase đều **fail-safe**: bảng chưa tạo → degrade về hành vi cũ (file/AI), không crash.

---

## Deploy (Vercel)

1. Import repo → ⚠️ **Root Directory = `sat-prep-web`** (không để mặc định gốc repo).
2. Thêm 4 env vars ở trên.
3. Deploy. Build command mặc định `next build` là đủ.

---

## Gotchas

- **`npm ci` phải kèm `--legacy-peer-deps`** — `lucide-react@0.344.0` khai báo peer `react ^16/17/18` nhưng dự án dùng React 19 → `npm ci` trơn sẽ `ERESOLVE` fail (CI cũng dùng cờ này).
- **Node ≥ 23.6** — test chạy `node --test "src/**/*.test.ts"` cần native TypeScript type-stripping. Node 22 không parse được `.ts`.
- **Đây là Next.js "biến đổi"** — xem [`sat-prep-web/AGENTS.md`](sat-prep-web/AGENTS.md); một số API/convention khác bản Next.js thường (đọc `node_modules/next/dist/docs/` khi nghi ngờ).

---

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) chạy trên mỗi push/PR đụng `sat-prep-web/`: **tsc + test + lint** (3 cổng chặn), Node 24, `npm ci --legacy-peer-deps`.
