import fs from 'fs';
import { getSharedDataPath } from './user-data';
import { acquireLock } from '@/helpers/mutex';

/**
 * ============================================================================
 *  AI COST METER + BUDGET KILL-SWITCH (implementation_plan.md §9.5, task #5)
 * ============================================================================
 *  • Ước tính chi phí mỗi lời gọi AI theo bảng giá model.
 *  • Cộng dồn vào SỔ CÁI TOÀN HỆ THỐNG theo ngày (file chia sẻ, ghi có khóa).
 *  • Kill-switch: khi chi phí ngày vượt trần → chặn gọi AI mới. Các route có
 *    Question Bank (generate-practice) degrade mềm về bank (§9.4) thay vì lỗi.
 *
 *  Model đang dùng: OpenAI gpt-4o-mini (KHÔNG phải Claude). Giá đặt thành hằng
 *  số rõ ràng — cập nhật ở đây khi nhà cung cấp đổi giá.
 *
 *  Khi lên Supabase/Postgres (Phase 2): thay sổ cái file bằng bảng + truy vấn
 *  tổng hợp; chữ ký hàm giữ nguyên.
 * ============================================================================
 */

/** Giá USD cho mỗi 1 TRIỆU token (input / output). Nguồn: OpenAI pricing. */
export const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
};

const DEFAULT_MODEL = 'gpt-4o-mini';

/** Ngân sách AI mỗi ngày toàn hệ thống (USD). Override qua env AI_DAILY_BUDGET_USD. */
export const DAILY_BUDGET_USD = Number(process.env.AI_DAILY_BUDGET_USD ?? 5);

const LEDGER_FILE = getSharedDataPath('ai_cost_global.json');

interface CostLedger {
  date: string;       // YYYY-MM-DD
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

const EMPTY_LEDGER: CostLedger = { date: '', calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Ước tính chi phí USD cho 1 lời gọi. */
export function estimateCost(tokensIn: number, tokensOut: number, model = DEFAULT_MODEL): number {
  const p = PRICING[model] ?? PRICING[DEFAULT_MODEL];
  return (tokensIn / 1_000_000) * p.inputPer1M + (tokensOut / 1_000_000) * p.outputPer1M;
}

function loadLedger(): CostLedger {
  try {
    if (!fs.existsSync(LEDGER_FILE)) return { ...EMPTY_LEDGER, date: today() };
    const content = fs.readFileSync(LEDGER_FILE, 'utf-8');
    const led = content.trim() ? (JSON.parse(content) as CostLedger) : EMPTY_LEDGER;
    if (led.date !== today()) return { ...EMPTY_LEDGER, date: today() }; // reset sang ngày mới
    return led;
  } catch (e) {
    console.error('Lỗi đọc ai_cost_global.json:', e);
    return { ...EMPTY_LEDGER, date: today() };
  }
}

export interface BudgetCheck {
  allowed: boolean;
  spentUsd: number;
  budgetUsd: number;
  remainingUsd: number;
}

/** Kiểm tra ngân sách AI ngày còn không (gọi TRƯỚC khi tốn tiền cho OpenAI). */
export function checkBudget(): BudgetCheck {
  const led = loadLedger();
  const remaining = DAILY_BUDGET_USD - led.costUsd;
  return {
    allowed: remaining > 0,
    spentUsd: Number(led.costUsd.toFixed(4)),
    budgetUsd: DAILY_BUDGET_USD,
    remainingUsd: Number(Math.max(0, remaining).toFixed(4)),
  };
}

/** Ghi nhận chi phí 1 lời gọi AI vào sổ cái toàn hệ thống (an toàn concurrency). */
export async function recordGlobalCost(tokensIn: number, tokensOut: number, model = DEFAULT_MODEL): Promise<void> {
  let release;
  try {
    release = await acquireLock(LEDGER_FILE);
    const led = loadLedger();
    led.calls += 1;
    led.tokensIn += tokensIn;
    led.tokensOut += tokensOut;
    led.costUsd = Number((led.costUsd + estimateCost(tokensIn, tokensOut, model)).toFixed(6));
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(led, null, 2), 'utf-8');
  } catch (e) {
    console.error('Lỗi ghi sổ cái chi phí AI:', e);
  } finally {
    if (release) release();
  }
}

/** Báo cáo chi phí AI hôm nay (cho admin/report endpoint). */
export function getCostReport(): CostLedger & { budgetUsd: number; remainingUsd: number } {
  const led = loadLedger();
  return {
    ...led,
    costUsd: Number(led.costUsd.toFixed(4)),
    budgetUsd: DAILY_BUDGET_USD,
    remainingUsd: Number(Math.max(0, DAILY_BUDGET_USD - led.costUsd).toFixed(4)),
  };
}
