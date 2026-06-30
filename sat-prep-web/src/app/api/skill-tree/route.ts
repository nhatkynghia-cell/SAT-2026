import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { buildSkillTree } from '@/lib/skill-tree';
import { loadGates } from '@/lib/gate-store';

export async function GET() {
  const user = await getCurrentUser();
  const [summary, gates] = await Promise.all([
    getMasterySummary(user.id),
    loadGates(user.id),
  ]);
  return NextResponse.json(buildSkillTree(summary, gates));
}
