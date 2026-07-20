import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkQuota, recordUsage } from '@/lib/ai-quota';
import { getUserTier } from '@/lib/subscription-store';
import { checkBudget, recordGlobalCost } from '@/lib/ai-cost';
import { OPENAI_CHAT_COMPLETIONS_URL } from '@/lib/openai';

/**
 * ============================================================================
 *  AI-JUDGE CHẤM WRITING / SPEAKING theo rubric CEFR (KET/PET) — Phase 2
 * ============================================================================
 *  Kỹ năng SẢN XUẤT (writing/speaking) không chấm bằng trắc nghiệm được. Route
 *  này nhận bài viết (hoặc transcript nói) + đề + kỹ năng → gọi gpt-4o-mini với
 *  json_schema strict → trả band CEFR + điểm 4 tiêu chí + sửa lỗi + feedback VN.
 *
 *  SERVER-AUTHORITATIVE: điểm do server chấm; client CHỈ gửi bài + đề. Quota +
 *  budget enforce như /api/chat. (Chưa gắn faucet thưởng ở phase này — thưởng
 *  productive sẽ nối vào /api/economy sau khi ổn định.)
 * ============================================================================
 */

const MODEL = 'gpt-4o-mini';
const MAX_TEXT_LEN = 2000;

interface GradeWritingRequest {
  moduleType?: 'writing' | 'speaking';
  skillId?: string;
  taskPrompt?: string; // đề bài
  answer?: string; // bài viết hoặc transcript nói của học sinh
  targetLevel?: 'A2' | 'B1';
}

const RUBRIC_SCHEMA = {
  type: 'object',
  properties: {
    band: { type: 'string', description: 'Pre-A1, A1, A2, or B1' },
    scores: {
      type: 'object',
      properties: {
        task: { type: 'integer', description: '0-5: hoàn thành yêu cầu đề' },
        vocabulary: { type: 'integer', description: '0-5: vốn từ' },
        grammar: { type: 'integer', description: '0-5: ngữ pháp' },
        coherence: { type: 'integer', description: '0-5: mạch lạc / trôi chảy' },
      },
      required: ['task', 'vocabulary', 'grammar', 'coherence'],
      additionalProperties: false,
    },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          original: { type: 'string' },
          fixed: { type: 'string' },
          note_vi: { type: 'string' },
        },
        required: ['original', 'fixed', 'note_vi'],
        additionalProperties: false,
      },
    },
    feedback_vi: { type: 'string', description: 'Nhận xét tổng thể tiếng Việt, động viên + gợi ý cải thiện' },
  },
  required: ['band', 'scores', 'corrections', 'feedback_vi'],
  additionalProperties: false,
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GradeWritingRequest;
    const user = await getCurrentUser();

    const answer = (body.answer ?? '').trim().slice(0, MAX_TEXT_LEN);
    const taskPrompt = (body.taskPrompt ?? '').trim().slice(0, MAX_TEXT_LEN);
    const moduleType = body.moduleType === 'speaking' ? 'speaking' : 'writing';
    const targetLevel = body.targetLevel === 'B1' ? 'B1' : 'A2';

    if (answer.length < 3) {
      return NextResponse.json({ error: 'Bài làm quá ngắn để chấm.' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Chưa cấu hình OPENAI_API_KEY' }, { status: 500 });
    }

    if (!(await checkBudget()).allowed) {
      return NextResponse.json(
        { error: 'Hệ thống AI tạm đạt giới hạn vận hành trong ngày. Vui lòng thử lại sau.', budgetExceeded: true },
        { status: 503 }
      );
    }

    const tier = await getUserTier(user.id);
    const quota = await checkQuota(user.id, tier, 'gen');
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `Bạn đã dùng hết ${quota.limit} lượt AI hôm nay. Nâng cấp Premium để luyện không giới hạn nhé!`, quotaExceeded: true, used: quota.used, limit: quota.limit },
        { status: 429 }
      );
    }

    const skillKind = moduleType === 'speaking' ? 'bài NÓI (transcript lời nói)' : 'bài VIẾT';
    const systemPrompt = `Bạn là giám khảo Cambridge English chấm ${skillKind} trình độ ${targetLevel} (KET/PET) cho học sinh cấp 2 Việt Nam.
Đề bài: "${taskPrompt || '(không có đề cụ thể — chấm theo nội dung bài làm)'}"
Bài làm của học sinh: "${answer}"

Hãy chấm theo rubric CEFR:
- band: xếp cấp độ tổng thể (Pre-A1 / A1 / A2 / B1) — công bằng, phù hợp học sinh cấp 2, khích lệ tiến bộ.
- scores: 4 tiêu chí, mỗi tiêu chí 0-5 điểm (task=bám đề, vocabulary=vốn từ, grammar=ngữ pháp, coherence=mạch lạc/trôi chảy).
- corrections: liệt kê 1-4 lỗi tiêu biểu, mỗi lỗi gồm original (đoạn sai), fixed (sửa đúng), note_vi (giải thích ngắn TIẾNG VIỆT).
- feedback_vi: nhận xét tổng thể TIẾNG VIỆT 100%, vừa động viên vừa chỉ ra 1-2 điểm cần cải thiện cụ thể.
TRẢ JSON đúng schema.`;

    const requestBody = {
      model: MODEL,
      messages: [{ role: 'system', content: systemPrompt }],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'cambridge_writing_rubric', strict: true, schema: RUBRIC_SCHEMA },
      },
      temperature: 0.2,
    };

    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('grade-writing OpenAI error:', errText);
      return NextResponse.json({ error: 'Lỗi gọi OpenAI API' }, { status: response.status });
    }

    const responseData = await response.json();
    const content = responseData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content generated');

    await Promise.allSettled([
      recordGlobalCost(responseData.usage?.prompt_tokens ?? 0, responseData.usage?.completion_tokens ?? 0, MODEL).catch((e) => console.error('recordGlobalCost:', e)),
      recordUsage(user.id, 'gen', responseData.usage?.prompt_tokens ?? 0, responseData.usage?.completion_tokens ?? 0).catch((e) => console.error('recordUsage:', e)),
    ]);

    const result = JSON.parse(content);
    return NextResponse.json({ ...result, skillId: body.skillId ?? null, moduleType });
  } catch (error) {
    console.error('grade-writing error:', error);
    return NextResponse.json({ error: (error as Error)?.message || 'Failed to grade' }, { status: 500 });
  }
}
