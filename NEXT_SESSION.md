# ▶️ CÂU LỆNH KHỞI ĐỘNG PHIÊN SAU

Copy nguyên khối dưới đây, dán vào ô chat để mở phiên mới:

---

```
Đọc memory.md, master_task_list.md, SECURITY_AUDIT_2026-07-03.md trong
D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\
rồi tiếp tục dự án. Đọc KỸ block "SECURITY AUDIT MONEY/ANTI-CHEAT" trong memory.md
(ROOT E = BLOCKER #1) và mục ROOT E + ROOT C trong SECURITY_AUDIT_2026-07-03.md.

Trước khi làm gì: export PATH="$PATH:/c/Program Files/nodejs" rồi verify môi trường
(tsc + test + build + lint) trong sat-prep-web/. Baseline mong đợi:
tsc sạch · test 123/123 · lint 0/0 · build 43 pages.

Token đã lưu: ~/.gitcreds-sat2026 (git push/GitHub API) + ~/.vercel-token (Vercel API).
Team Vercel: sat-2027 | project: sat-2026 | app prod: https://sat-2026.vercel.app
Repo: github.com/nhatkynghia-cell/SAT-2026 (main). Account test: truongsonht.xd@gmail.com / Nghia@123

BẢO MẬT — hỏi tôi 4 secret đã rotate chưa rồi TICK vào checklist memory:
[ ] GitHub PAT  [ ] Vercel token  [ ] OpenAI key  [ ] Supabase DB password
Nếu tôi đã đổi git/vercel token → xin token MỚI để lưu lại (token cũ hết hiệu lực).

VIỆC PHIÊN NÀY — theo THỨ TỰ BẮT BUỘC (đừng tự mở scope):
1. 🔴 ROOT E (BLOCKER #1) — THIẾT KẾ ĐÃ XONG, đọc ROOT_E_FIX_DESIGN.md.
   Hướng đã chốt: service-role admin client + REVOKE authenticated write.
   → HỎI tôi xác nhận duyệt SUPABASE_SERVICE_ROLE_KEY (server-only) → rồi CODE:
   src/lib/supabase/admin.ts (import 'server-only') + refactor 7 store (economy/
   mastery/gate/ai-usage/cost-ledger/progress/goals — ĐƯỜNG GHI sang admin, ĐỌC giữ
   createClient) + parameterize 3 RPC (p_user_id uuid default auth.uid() — vì
   service-role thì auth.uid() NULL) + 2 script root_e_step1_rpc.sql & root_e_step2_revoke.sql.
   Rollout không-gãy: step1 SQL → deploy → soak 24-48h → step2 REVOKE. Tôi thêm secret + chạy SQL.
   ⚠️ Rủi ro: key lộ = full DB → import 'server-only' + KHÔNG NEXT_PUBLIC + grep .next/static.
2. ⏳ Nhắc tôi chạy sat-prep-web/atomic_mutations.sql (bật ROOT C atomic — code sẵn, fail-safe).
3. Sau khi E xong: ROOT A (grading server-side, Phase 2 lớn) + ROOT B (quest
   claim-state) + rate-limit /api/mastery,/api/economy. Follow-up ROOT C #2/#3.

⚠️ GIỚI HẠN NGỮ CẢNH 80%: khi tới ~80% context → DỪNG việc mới, cập nhật memory.md
+ commit + push (thủ tục bàn giao) TRƯỚC khi bị compact. KHÔNG bắt đầu việc lớn khi quá 80%.

Việc user-side tôi đã làm: [điền: rotate secret nào / chạy atomic_mutations.sql chưa / chốt hướng ROOT E nào]
```

---

## Ghi chú nhanh (không cần paste)

- **Trạng thái cuối phiên 2026-07-03:** app sống `https://sat-2026.vercel.app`, mọi route 200. `main` = `30e1904`, đồng bộ GitHub, tree sạch. App XANH: tsc · test 123/123 · lint 0/0 · build 43 pages.
- **XONG phiên 2026-07-03:** authenticated verify (persist Supabase thật) + 2 nợ cũ (PvP win-path, Mistake variant) + security audit money/anti-cheat + ROOT C atomic (fail-safe, review GO) + ROOT D fix + phát hiện ROOT E.
- **CHẶN gắn tiền thật:** ROOT E (blocker #1) → A → B. Chi tiết `SECURITY_AUDIT_2026-07-03.md`.
- **[user] pending:** rotate 4 secret · chạy `atomic_mutations.sql` prod · chốt hướng fix ROOT E.
- **Bug deploy Vercel (đã fix, nhớ để tránh tái):** `NEXT_PUBLIC_*` env PHẢI `plain` không `sensitive`.
