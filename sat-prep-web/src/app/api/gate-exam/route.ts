import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary } from '@/lib/mastery';
import { SKILL_TREE } from '@/lib/skill-taxonomy';
import { loadGates, saveGateResult } from '@/lib/gate-store';
import { isGateEligible, evaluateGateResult, GATE_QUESTIONS } from '@/lib/gate-exam';
import { DOMAIN_PREREQS } from '@/lib/skill-tree';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MasterySummary } from '@/lib/mastery';

const VALID_DOMAINS = Object.keys(DOMAIN_PREREQS);

/** Mastery trung bình của 1 chương — DÙNG CHUNG GET/POST để eligibility nhất quán. */
function computeDomainAvg(summary: MasterySummary, domain: string): number {
  const domainSkills = summary.skills.filter((s) => s.domainId === domain);
  return domainSkills.length
    ? Math.round(domainSkills.reduce((sum, s) => sum + s.score, 0) / domainSkills.length)
    : 0;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const domain = request.nextUrl.searchParams.get('domain');

  if (!domain || !VALID_DOMAINS.includes(domain)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
  }

  const [summary, gates] = await Promise.all([
    getMasterySummary(user.id),
    loadGates(user.id),
  ]);

  const domainAvg = computeDomainAvg(summary, domain);

  const gate = gates[domain];
  const eligible = isGateEligible(domainAvg, gate);

  if (!eligible) {
    return NextResponse.json({
      eligible: false,
      gateProgress: gate ?? null,
      domainAvg,
    });
  }

  const domainDef = SKILL_TREE.find((d) => d.id === domain);
  if (!domainDef) {
    return NextResponse.json({ error: 'Domain not found in taxonomy' }, { status: 400 });
  }

  const questions = [];
  const skillPool = domainDef.skills;

  for (let i = 0; i < GATE_QUESTIONS; i++) {
    const skill = skillPool[i % skillPool.length];
    const difficulty = i < 2 ? 'Medium' : 'Hard';

    try {
      const res = await fetch(new URL('/api/generate-practice', request.nextUrl.origin), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
        body: JSON.stringify({
          moduleType: skill.moduleType,
          topic: skill.label,
          skillId: skill.id,
          difficulty,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        questions.push({ ...data, difficulty });
      }
    } catch (e) {
      console.error(`Gate exam: failed to generate question ${i + 1}`, e);
    }
  }

  if (questions.length < GATE_QUESTIONS) {
    return NextResponse.json(
      { error: 'Không thể sinh đủ câu hỏi cho đề thi cổng. Vui lòng thử lại.' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    eligible: true,
    gateProgress: gate ?? null,
    domainAvg,
    questions,
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const body = await request.json();
  const { domain, questionIds } = body;

  if (!domain || !VALID_DOMAINS.includes(domain)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
  }

  // Server-side grading: ĐẾM số câu đúng TỪ issued_questions (was_correct do
  // /api/grade set qua CAS). 🔴 ROOT A: KHÔNG có nhánh tin `body.correctCount`
  // client gửi — trước đây POST {domain, correctCount:5} (bỏ questionIds) là vượt
  // cổng không cần trả lời (cổng = mở khoá chương/Premium). Bắt buộc questionIds.
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    return NextResponse.json(
      { error: 'Thiếu danh sách câu hỏi đã làm (questionIds).' },
      { status: 400 }
    );
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from('issued_questions')
    .select('was_correct')
    .in('id', questionIds.slice(0, GATE_QUESTIONS))
    .eq('user_id', user.id)
    .eq('answered', true);
  const correctCount = data?.filter((r: { was_correct: boolean }) => r.was_correct).length ?? 0;

  // RE-CHECK eligibility server-side
  const [summary, gates] = await Promise.all([
    getMasterySummary(user.id),
    loadGates(user.id),
  ]);
  const domainAvg = computeDomainAvg(summary, domain);
  if (!isGateEligible(domainAvg, gates[domain])) {
    return NextResponse.json(
      { error: 'Chưa đủ điều kiện thi cổng (mastery chưa đạt hoặc đang trong thời gian luyện lại).' },
      { status: 403 }
    );
  }

  const result = evaluateGateResult(correctCount);
  await saveGateResult(user.id, domain, result);

  return NextResponse.json({
    result,
    gateProgress: {
      passed: result.passed,
      lastAttempt: new Date().toISOString(),
      score: result.score,
      correctSinceFail: 0,
    },
  });
}
