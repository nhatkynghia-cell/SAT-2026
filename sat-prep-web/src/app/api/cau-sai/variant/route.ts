import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSkillMastery } from '@/lib/mastery';
import { getSkill } from '@/lib/skill-taxonomy';
import { selectDifficulty } from '@/lib/adaptive';
import { buildVariantRequest } from '@/lib/mistake-variant';

/**
 * MISTAKE VARIANT API — sinh câu BIẾN THỂ để ôn câu sai (Nhóm 7 #6).
 *
 * GET ?skillId=algebra.linear_eq → chọn độ khó theo mastery THẬT của skill đó
 * (ZPD), rồi sinh câu CÙNG skill khác số liệu qua /api/generate-practice. Câu
 * trả về mang skillId THẬT → khi làm lại, CorePracticeUI ghi mastery đúng chỗ
 * (active recall trên biến thể là tín hiệu SRS mạnh hơn tự đánh giá).
 *
 * Vì sao server-side: client KHÔNG tự chọn skill/độ khó (chống chơi xấu) và
 * mastery chỉ đọc ở server (§9.1). Mirror pattern /api/tower/question.
 *
 * skillId không hợp lệ (câu sai cũ chưa gắn skill_id) → 400 để client ẩn nút.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  const skillId = request.nextUrl.searchParams.get('skillId') ?? '';
  const skill = getSkill(skillId);
  if (!skill) {
    return NextResponse.json(
      { error: 'Câu sai này chưa gắn kỹ năng nên không tạo được biến thể.' },
      { status: 400 }
    );
  }

  // Độ khó ZPD theo mastery THẬT của skill (getSkillMastery trả rỗng nếu chưa làm).
  const mastery = await getSkillMastery(user.id, skillId).catch(() => null);
  const difficulty = selectDifficulty(mastery?.score ?? 0);
  const req = buildVariantRequest(skill, difficulty)!;

  try {
    const res = await fetch(new URL('/api/generate-practice', request.nextUrl.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
      body: JSON.stringify({
        moduleType: req.moduleType,
        topic: req.topic,
        skillId: req.skillId,
        difficulty: req.difficulty,
      }),
    });

    if (!res.ok) {
      // Chuyển nguyên trạng thái lỗi (quota 429 / budget 503 / cấu hình 500) để
      // client hiển thị đúng thông điệp thay vì nuốt mất.
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error ?? 'Không sinh được câu biến thể.' },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Gắn kèm difficulty + skillId đã chọn (đảm bảo client/Mastery dùng đúng mức,
    // không phụ thuộc field difficulty do AI tự ghi).
    return NextResponse.json({ ...data, difficulty: req.difficulty, skillId: req.skillId });
  } catch (e) {
    console.error('Mistake variant: lỗi sinh câu hỏi', e);
    return NextResponse.json({ error: 'Lỗi sinh câu biến thể.' }, { status: 503 });
  }
}
