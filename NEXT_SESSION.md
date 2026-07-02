# ▶️ CÂU LỆNH KHỞI ĐỘNG PHIÊN SAU

Copy nguyên khối dưới đây, dán vào ô chat để mở phiên mới:

---

```
Đọc memory.md, master_task_list.md, implementation_plan.md trong
D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\
rồi tiếp tục dự án. Đọc kỹ block "▶️ CÂU LỆNH & CHECKLIST PHIÊN SAU" và
"🚀 ĐÃ DEPLOY VERCEL" trong memory.md trước.

Trước khi làm gì: export PATH="$PATH:/c/Program Files/nodejs" rồi verify môi trường
(tsc + test + build) trong sat-prep-web/.

Token đã lưu sẵn: ~/.gitcreds-sat2026 (git push/GitHub API) + ~/.vercel-token (Vercel API).
Team Vercel: sat-2027 | project: sat-2026 | app prod: https://sat-2026.vercel.app

BẢO MẬT — hỏi tôi 4 secret dưới đã rotate chưa, rồi TICK vào checklist trong memory:
[ ] GitHub PAT  [ ] Vercel token  [ ] OpenAI key  [ ] Supabase DB password
Nếu tôi đã đổi git/vercel token → xin token MỚI để lưu lại (token cũ đã hết hiệu lực).

VIỆC PHIÊN NÀY (tôi sẽ nói cụ thể; mặc định):
1. Authenticated verify — tôi login https://sat-2026.vercel.app/login
   (truongsonht.xd@gmail.com) → bạn kiểm persist THẬT qua Supabase:
   streak qua reload (user_progress), question bank hit-rate>0 (questions),
   kill-switch cộng dồn (ai_cost_ledger), coins/mastery.
2. Nợ cũ: PvP win-path (login→thắng→leo rank→cap 10 trận/ngày),
   Mistake variant full-loop (làm biến thể SAI→mastery+SRS box gốc).

⚠️ GIỚI HẠN NGỮ CẢNH 80%: khi dùng tới ~80% context, DỪNG việc mới,
cập nhật memory.md + commit + push (thủ tục bàn giao) TRƯỚC khi bị compact.
KHÔNG bắt đầu việc lớn khi đã quá 80%.

Việc user-side tôi đã làm: [điền: rotate secret nào / login / chưa làm gì]
```

---

## Ghi chú nhanh (không cần paste)

- **Trạng thái cuối phiên 2026-07-02(B):** app đã deploy sống ở `https://sat-2026.vercel.app`, mọi route 200. Repo `main` = commit mới nhất, đồng bộ GitHub `nhatkynghia-cell/SAT-2026`. CI xanh (job `verify`).
- **Bug deploy đã fix:** biến `NEXT_PUBLIC_*` trên Vercel PHẢI để `plain`, KHÔNG `sensitive` (sensitive → không nhúng lúc build → middleware crash 500). Chi tiết trong memory block "🚀 ĐÃ DEPLOY VERCEL".
- **Verify môi trường mong đợi:** tsc sạch · test 122/122 · lint 0/0 · build 43 pages.
