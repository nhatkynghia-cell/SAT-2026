import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { buildSkillTree, applyTierGate } from '@/lib/skill-tree';
import { loadGates } from '@/lib/gate-store';
import { getUserTier } from '@/lib/subscription-store';

export async function GET() {
  const user = await getCurrentUser();
  const [summary, gates, tier] = await Promise.all([
    getMasterySummary(user.id),
    loadGates(user.id),
    getUserTier(user.id),
  ]);
  // PHÂN TẦNG: free chỉ mở 2 chương đầu; Premium+ toàn bộ cây (applyTierGate no-op).
  return NextResponse.json(applyTierGate(buildSkillTree(summary, gates), tier));
}
