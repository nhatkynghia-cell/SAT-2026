import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { buildSkillTree } from '@/lib/skill-tree';

/**
 * SKILL TREE API (implementation_plan.md §10.B.1, task #17)
 *
 * GET → bản đồ năng lực SAT: trạng thái từng node (locked/available/in_progress/
 *       mastered), tiến độ từng chương, số node đã mastered.
 *
 * Đây là HỆ TIẾN TRÌNH DUY NHẤT (đã bỏ Level phẳng) — tiến trình = độ phủ +
 * thành thạo chương trình SAT thật.
 */
export async function GET() {
  const user = await getCurrentUser();
  const summary = await getMasterySummary(user.id);
  return NextResponse.json(buildSkillTree(summary));
}
