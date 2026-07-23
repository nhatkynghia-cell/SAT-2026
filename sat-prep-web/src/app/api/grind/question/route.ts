import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMasterySummary, type Difficulty } from '@/lib/mastery';
import { recommendNext, selectDifficulty } from '@/lib/adaptive';
import { buildStudyQueue, pickNextSkillId } from '@/lib/study-queue';
import { loadMistakes } from '@/lib/mistakes-store';
import { loadVocab } from '@/lib/vocab-store';
import { isDue, todayStr } from '@/lib/leitner';
import { getUserTier } from '@/lib/subscription-store';
import { isValidSkill } from '@/lib/skill-taxonomy';

/**
 * GRIND QUESTION API — Khổ Luyện (nhồi 1 skill yếu nhất tới mastered).
 *
 * GET [?skillId=…] → chọn skill + độ khó theo MASTERY thật của user
 * (server-authoritative), rồi sinh câu qua /api/generate-practice. Câu trả về
 * mang skillId THẬT nên CorePracticeUI ghi mastery đúng skill (mirror pattern
 * /api/tower/question).
 *
 * Khác Tower: cho phép client TỰ CHỌN skill muốn nhồi (?skillId). Nếu không truyền
 * hoặc không hợp lệ → auto chọn skill YẾU NHẤT (recommendNext). Độ khó luôn theo
 * ZPD của skill đó (selectDifficulty) — không cộng áp lực như Tower vì mục tiêu là
 * củng cố cho tới thành thạo, không phải survival.
 *
 * PHÂN TẦNG: Khổ luyện là quyền lợi ULTIMATE. Không phải ultimate → 403 { locked:true }
 * để UI hiện upsell (đây là HÀNH ĐỘNG sinh câu, không chỉ đọc đề xuất → dùng 403).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  // GATE ultimate — khổ luyện là quyền lợi cao cấp nhất.
  const tier = await getUserTier(user.id);
  if (tier !== 'ultimate') {
    return NextResponse.json({ locked: true }, { status: 403 });
  }

  const summary = await getMasterySummary(user.id);

  // Client có thể chỉ định skill muốn nhồi; không hợp lệ → auto chọn yếu nhất.
  const requested = request.nextUrl.searchParams.get('skillId');

  let skillId: string;
  let label: string;
  let moduleType: string;
  let difficulty: Difficulty;

  if (requested && isValidSkill(requested)) {
    const s = summary.skills.find((x) => x.id === requested);
    if (!s) {
      return NextResponse.json({ error: 'Không tìm thấy kỹ năng để khổ luyện' }, { status: 404 });
    }
    skillId = s.id;
    label = s.label;
    moduleType = s.moduleType;
    difficulty = selectDifficulty(s.score);
  } else {
    // Không chỉ định skill → soạn hàng đợi học ưu tiên SRS due (chống quên) rồi
    // mới đến skill yếu nhất. Lỗi/vocab đến hạn ôn có giá trị học cao nhất nên đứng
    // trước. Fail-safe: lỗi đọc SRS → hàng đợi chỉ còn weakness (giữ hành vi cũ).
    const today = todayStr();
    let dueMistakes: { skill_id?: string | null }[] = [];
    let dueVocabCount = 0;
    try {
      const mistakes = await loadMistakes(user.id);
      dueMistakes = mistakes.filter((m) => isDue(m.next_review, today));
    } catch (e) {
      console.error('Grind: loadMistakes lỗi (fail-safe → không có due mistake):', e);
    }
    try {
      const vocab = await loadVocab(user.id);
      dueVocabCount = vocab.words.filter((w) => isDue(w.next_review, today)).length;
    } catch (e) {
      console.error('Grind: loadVocab lỗi (fail-safe → 0 due vocab):', e);
    }
    const rec = recommendNext(summary);
    const queue = buildStudyQueue(summary, dueMistakes, dueVocabCount, rec);
    const picked = pickNextSkillId(queue);

    if (picked && isValidSkill(picked)) {
      const s = summary.skills.find((x) => x.id === picked);
      if (s) {
        skillId = s.id;
        label = s.label;
        moduleType = s.moduleType;
        difficulty = selectDifficulty(s.score);
      } else {
        if (!rec) {
          return NextResponse.json({ error: 'Không tìm thấy kỹ năng để khổ luyện' }, { status: 404 });
        }
        skillId = rec.skillId;
        label = rec.label;
        moduleType = rec.moduleType;
        difficulty = rec.difficulty;
      }
    } else if (rec) {
      skillId = rec.skillId;
      label = rec.label;
      moduleType = rec.moduleType;
      difficulty = rec.difficulty;
    } else {
      return NextResponse.json({ error: 'Không tìm thấy kỹ năng để khổ luyện' }, { status: 404 });
    }
  }

  try {
    const res = await fetch(new URL('/api/generate-practice', request.nextUrl.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
      body: JSON.stringify({
        moduleType,
        topic: label,
        skillId,
        difficulty,
      }),
    });

    if (!res.ok) {
      // Chuyển nguyên trạng thái lỗi (quota 429 / budget 503 / cấu hình 500) để
      // client hiển thị đúng thông điệp thay vì nuốt mất.
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error ?? 'Không sinh được câu khổ luyện.' },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Gắn kèm difficulty + skillId đã chọn (đảm bảo client/Mastery dùng đúng mức,
    // không phụ thuộc field difficulty do AI tự ghi) — như Tower.
    return NextResponse.json({ ...data, difficulty, skillId });
  } catch (e) {
    console.error('Grind question: lỗi sinh câu hỏi', e);
    return NextResponse.json({ error: 'Lỗi sinh câu khổ luyện.' }, { status: 503 });
  }
}
