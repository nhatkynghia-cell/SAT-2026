import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { recommendNext } from '@/lib/adaptive';
import type { Subject } from '@/lib/skill-taxonomy';

/**
 * ADAPTIVE API (implementation_plan.md §10.A.1, task #12)
 *
 * GET → đề xuất skill + độ khó kế tiếp nên luyện, dựa trên mastery hiện tại.
 *   ?subject=math|reading   lọc theo môn
 *   ?moduleType=math|vocab|literature|desmos   lọc theo loại module
 *
 * Ghép tầng I/O (mastery) với engine thuần (adaptive) — đúng ranh giới đã thiết kế.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const summary = await getMasterySummary(user.id);

  const params = new URL(request.url).searchParams;
  const subjectParam = params.get('subject');
  const subject =
    subjectParam === 'math' || subjectParam === 'reading'
      ? (subjectParam as Subject)
      : undefined;
  const moduleType = params.get('moduleType') ?? undefined;

  const recommendation = recommendNext(summary, { subject, moduleType });

  if (!recommendation) {
    return NextResponse.json(
      { error: 'Không tìm thấy kỹ năng phù hợp với bộ lọc' },
      { status: 404 }
    );
  }

  return NextResponse.json({ recommendation, overall: summary.overall });
}
