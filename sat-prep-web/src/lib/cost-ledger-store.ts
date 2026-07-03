import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * ============================================================================
 *  AI COST LEDGER STORE (Supabase) — implementation_plan.md §9.5 / task 5.1
 * ============================================================================
 *  Sổ cái chi phí AI TOÀN HỆ THỐNG theo ngày (1 dòng/ngày). Thay cho file
 *  `ai_cost_global.json` (file-based → reset mỗi cold-start trên Vercel
 *  serverless → kill-switch ngân sách MẤT TÁC DỤNG cộng dồn). Bảng Supabase
 *  giữ tổng chi phí bền vững qua mọi instance.
 *
 *  ⚠️ Giống ai_chat_cache: bảng DÙNG CHUNG toàn hệ thống (KHÔNG scope user_id)
 *  → RLS `authenticated using(true)`. Chỉ chứa số liệu vận hành, KHÔNG có PII.
 *  Xem `ai_cost_ledger.sql`.
 *
 *  🔓 FAIL-OPEN (quyết định thiết kế, memory 2026-07-02): khi bảng CHƯA tồn tại
 *  (pre-migration) hoặc lỗi đọc → trả sổ cái RỖNG (costUsd=0) → `checkBudget`
 *  cho phép (allowed=true). Đây ĐÚNG với hành vi hiện tại (không chặn nhầm dev
 *  khi chưa tạo bảng). ĐÁNH ĐỔI: deploy prod mà QUÊN tạo bảng → không có trần
 *  chi phí. Ghi (record) lỗi cũng no-op để KHÔNG vỡ luồng gọi AI.
 *
 *  🏁 RACE: đọc-sửa-ghi (không atomic increment) — giống bumpHitCount của
 *  chat-cache. Tránh thêm DB function vào schema PRODUCTION. Với sổ cái ngân
 *  sách MỀM, thiếu hụt nhỏ do race dưới tải cao là chấp nhận được.
 * ============================================================================
 */

export interface CostLedger {
  date: string;       // YYYY-MM-DD
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function emptyLedger(): CostLedger {
  return { date: today(), calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
}

/**
 * Đọc sổ cái chi phí AI HÔM NAY từ Supabase.
 * FAIL-OPEN: bảng chưa có / lỗi / chưa có dòng hôm nay → ledger rỗng (costUsd=0).
 */
export async function loadLedger(): Promise<CostLedger> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ai_cost_ledger')
      .select('ledger_date, calls, tokens_in, tokens_out, cost_usd')
      .eq('ledger_date', today())
      .single();

    if (error || !data) return emptyLedger();
    return {
      date: data.ledger_date,
      calls: data.calls ?? 0,
      tokensIn: data.tokens_in ?? 0,
      tokensOut: data.tokens_out ?? 0,
      costUsd: Number(data.cost_usd ?? 0),
    };
  } catch (e) {
    console.error('Lỗi đọc ai_cost_ledger:', e);
    return emptyLedger();
  }
}

/**
 * Cộng dồn chi phí 1 lời gọi AI vào sổ cái hôm nay (upsert theo ledger_date).
 * FAIL-SAFE: lỗi ghi / bảng chưa có → no-op (KHÔNG chặn luồng gọi AI).
 */
export async function recordCost(tokensIn: number, tokensOut: number, costUsd: number): Promise<void> {
  const admin = createAdminClient();

  const { error: rpcError } = await admin.rpc('increment_ai_cost_ledger', {
    p_date: today(),
    p_tokens_in: tokensIn,
    p_tokens_out: tokensOut,
    p_cost_usd: Number(costUsd.toFixed(6)),
  });
  if (!rpcError) return;

  if (rpcError.code !== '42883' && rpcError.code !== 'PGRST202') {
    console.error('increment_ai_cost_ledger RPC lỗi (KHÔNG fallback, tránh double-count):', rpcError.message);
    return;
  }

  // Fallback đọc-sửa-ghi (CHỈ pre-migration: hàm chưa tồn tại)
  try {
    const current = await loadLedger();
    const { error } = await admin
      .from('ai_cost_ledger')
      .upsert(
        {
          ledger_date: today(),
          calls: current.calls + 1,
          tokens_in: current.tokensIn + tokensIn,
          tokens_out: current.tokensOut + tokensOut,
          cost_usd: Number((current.costUsd + costUsd).toFixed(6)),
        },
        { onConflict: 'ledger_date' }
      );
    if (error) console.error('Lỗi ghi ai_cost_ledger (fallback):', error);
  } catch (e) {
    console.error('Lỗi ghi ai_cost_ledger (fallback):', e);
  }
}
