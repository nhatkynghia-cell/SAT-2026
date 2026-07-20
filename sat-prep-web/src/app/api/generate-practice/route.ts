import { NextResponse } from 'next/server';
import { getFromBank, saveToBank, poolSize, MIN_POOL } from '@/lib/question-bank';
import { checkBudget, recordGlobalCost } from '@/lib/ai-cost';
import { getCurrentUser } from '@/lib/auth';
import { reserveQuota, finalizeUsage, releaseUsage } from '@/lib/ai-quota';
import { getUserTier } from '@/lib/subscription-store';
import { isValidSkill } from '@/lib/skill-taxonomy';
import { issueQuestion, type ChoiceAnalysis } from '@/lib/issued-questions';
import { validateQuestion } from '@/lib/question-validate';
import { OPENAI_CHAT_COMPLETIONS_URL } from '@/lib/openai';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Map (moduleType, topic) → skillId chuẩn trong skill-taxonomy Cambridge.
 * Chỉ là FALLBACK khi client không gửi skillId tường minh (UI trang kỹ năng
 * gửi skillId chính xác). Trả undefined nếu không khớp.
 */
function resolveSkillId(moduleType: string, topic: string): string | undefined {
  const t = (topic || '').normalize('NFC').toLowerCase();

  switch (moduleType) {
    case 'reading':
      if (/matching|ghép/.test(t)) return 'reading.matching';
      if (/gap|gapped|điền câu/.test(t)) return 'reading.gapped_text';
      if (/cloze|điền từ vựng/.test(t)) return 'reading.cloze_vocab';
      if (/open cloze|điền từ tự do/.test(t)) return 'reading.open_cloze';
      if (/detail|chi tiết|đoạn dài/.test(t)) return 'reading.detail_mcq';
      return 'reading.notice_mcq';
    case 'writing':
      if (/email/.test(t)) return 'writing.email_100';
      if (/story|truyện|tranh/.test(t)) return 'writing.story_pictures';
      if (/article|bài báo/.test(t)) return 'writing.article_or_story';
      return 'writing.short_message';
    case 'listening':
      if (/matching|ghép/.test(t)) return 'listening.matching';
      if (/gap|form|điền/.test(t)) return 'listening.gap_fill';
      if (/long|dài/.test(t)) return 'listening.long_convo';
      return 'listening.short_convo';
    case 'speaking':
      if (/collaborative|thảo luận cặp/.test(t)) return 'speaking.collaborative';
      if (/long turn|mô tả ảnh/.test(t)) return 'speaking.long_turn';
      if (/discussion|thảo luận/.test(t)) return 'speaking.discussion';
      return 'speaking.interview';
    case 'grammar':
      return /b1|pet|hoàn thành|điều kiện|bị động|quan hệ/.test(t) ? 'grammar.b1' : 'grammar.a2';
    case 'vocabulary':
      return /b1|pet/.test(t) ? 'vocabulary.b1' : 'vocabulary.a2';
    default:
      return undefined;
  }
}

/**
 * Phát 1 câu từ Question Bank an toàn (ROOT A): lưu correct_choice + choice_analysis
 * SERVER-SIDE (issued_questions), rồi trả payload đã GIẤU cả hai → client không đọc
 * được đáp án qua network. choice_analysis chỉ lộ lại sau khi chấm (/api/grade).
 */
async function issueBankResponse(
  userId: string,
  cached: Record<string, unknown>,
  skillId: string | undefined,
  extra: Record<string, unknown>
) {
  const ca = Array.isArray(cached.choice_analysis)
    ? (cached.choice_analysis as ChoiceAnalysis[])
    : undefined;
  const qId = await issueQuestion(
    userId,
    String(cached.correct_choice ?? ''),
    skillId,
    String(cached.difficulty ?? 'Medium'),
    { src: 'bank', choiceAnalysis: ca }
  );
  const { correct_choice: _h, choice_analysis: _ca, ...safe } = cached;
  return NextResponse.json({ ...safe, skillId, questionId: qId, ...extra });
}

export async function POST(req: Request) {
  try {
    const { moduleType, topic, prefer = 'auto', skillId: clientSkillId, difficulty: reqDiffRaw } = await req.json();
    const user = await getCurrentUser();

    // Độ khó YÊU CẦU (Easy/Medium/Hard) — tham số adaptive (Tower/Gate). Khi caller
    // KHÔNG truyền → reqDifficulty = undefined → giữ NGUYÊN hành vi cũ (math mặc định
    // "SIÊU KHÓ" như trước), nên 4 trang math/desmos/literature/vocab không đổi gì.
    const VALID_DIFFICULTY = ['Easy', 'Medium', 'Hard'];
    const reqDifficulty =
      typeof reqDiffRaw === 'string' && VALID_DIFFICULTY.includes(reqDiffRaw)
        ? (reqDiffRaw as 'Easy' | 'Medium' | 'Hard')
        : undefined;

    // Gắn skillId cho câu hỏi (mọi nguồn: bank lẫn AI) để client POST /api/mastery.
    // Ưu tiên skillId tường minh do UI gửi (chính xác — UI biết user chọn skill nào);
    // chỉ suy luận theo từ khóa khi client không gửi (caller cũ / desmos).
    const skillId =
      typeof clientSkillId === 'string' && isValidSkill(clientSkillId)
        ? clientSkillId
        : resolveSkillId(moduleType, topic);

    // CHIẾN LƯỢC LAI (implementation_plan.md §9.4):
    // Ưu tiên lấy câu từ Question Bank khi pool đã đủ lớn → cắt chi phí OpenAI.
    // prefer='ai' để ép sinh câu mới (nút "câu mới hoàn toàn"); mặc định 'auto'.
    if (prefer !== 'ai' && (await poolSize(moduleType)) >= MIN_POOL) {
      const cached = await getFromBank(moduleType, topic, reqDifficulty) as Record<string, unknown> | null;
      if (cached) {
        return issueBankResponse(user.id, cached, skillId, { _source: 'bank' });
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const fallback = (await getFromBank(moduleType, topic, reqDifficulty) ?? await getFromBank(moduleType, topic)) as Record<string, unknown> | null;
      if (fallback) {
        return issueBankResponse(user.id, fallback, skillId, { _source: 'bank' });
      }
      return NextResponse.json({ error: "Chưa cấu hình OPENAI_API_KEY" }, { status: 500 });
    }

    // Kill-switch ngân sách (§9.5): nếu đã vượt trần chi phí ngày, degrade mềm
    // về Question Bank thay vì gọi OpenAI. Nếu bank trống → báo bận.
    if (!(await checkBudget()).allowed) {
      const fallback = (await getFromBank(moduleType, topic, reqDifficulty) ?? await getFromBank(moduleType, topic)) as Record<string, unknown> | null;
      if (fallback) {
        return issueBankResponse(user.id, fallback, skillId, { _source: 'bank', _degraded: 'budget' });
      }
      return NextResponse.json(
        { error: "Hệ thống AI tạm đạt giới hạn vận hành trong ngày. Vui lòng thử lại sau.", budgetExceeded: true },
        { status: 503 }
      );
    }

    // Chặn burst đốt OpenAI: rate-limit nhanh + reserve quota trước khi gọi AI.
    const rl = rateLimit(`genpractice:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít giây.' }, { status: 429 });
    }

    // Phase 2: tier THẬT từ subscription (fail-safe → 'free' khi lỗi/không có gói).
    // Reserve-before-call đóng TOCTOU: nhiều request song song không thể cùng vượt quota.
    const tier = await getUserTier(user.id);
    const reservation = await reserveQuota(user.id, tier, 'gen');
    if (!reservation.allowed) {
      return NextResponse.json(
        {
          error: `Bạn đã dùng hết ${reservation.limit} lượt sinh câu hỏi AI hôm nay. Nâng cấp Premium để luyện tập không giới hạn nhé!`,
          quotaExceeded: true,
          used: reservation.used,
          limit: reservation.limit,
        },
        { status: 429 }
      );
    }

    const CEFR_HINT: Record<'Easy' | 'Medium' | 'Hard', string> = {
      Easy: 'A1 (rất cơ bản, câu ngắn, từ vựng thông dụng nhất)',
      Medium: 'A2 (trình độ KET, câu đơn giản đời thường)',
      Hard: 'B1 (trình độ PET, câu phức hơn, từ vựng đa dạng hơn)',
    };
    const level = CEFR_HINT[reqDifficulty ?? 'Medium'];

    const MODULE_TASK: Record<string, string> = {
      reading: `Tạo 1 câu ĐỌC HIỂU trắc nghiệm tiếng Anh trình độ ${level}. Nếu là đoạn văn, đặt vào full_passage (2-4 câu ngắn) rồi hỏi ở practice_question; nếu là điền từ, để full_passage rỗng.`,
      listening: `Tạo 1 câu NGHE HIỂU trắc nghiệm trình độ ${level}. Vì chưa có audio, ĐẶT transcript đoạn hội thoại/thông báo NGAY TRONG practice_question (VD: 'Nghe đoạn hội thoại: "A: ... B: ..." Câu hỏi: ...'). full_passage để rỗng.`,
      grammar: `Tạo 1 câu NGỮ PHÁP trắc nghiệm trình độ ${level} (chia thì, giới từ, mạo từ, so sánh, modal...). Dạng điền vào chỗ trống hoặc chọn câu đúng ngữ pháp. full_passage rỗng.`,
      vocabulary: `Tạo 1 câu TỪ VỰNG trắc nghiệm trình độ ${level}: điền từ hợp ngữ cảnh, hoặc chọn nghĩa/từ đồng nghĩa. full_passage rỗng.`,
    };
    const task = MODULE_TASK[moduleType] ?? MODULE_TASK.reading;

    let systemPrompt = `Bạn là chuyên gia soạn đề luyện thi Cambridge English KET (A2) / PET (B1) cho học sinh cấp 2 Việt Nam.
Chủ đề yêu cầu: ${topic || 'tự chọn phù hợp trình độ'}
Nhiệm vụ: ${task}

QUY TẮC BẮT BUỘC:
- practice_question, full_passage, choices, correct_choice PHẢI BẰNG TIẾNG ANH, đúng trình độ ${level}.
- explanation PHẢI BẰNG TIẾNG VIỆT 100% (giải thích ngắn gọn, dễ hiểu cho học sinh cấp 2).
- KHÔNG dùng LaTeX, KHÔNG toán học, KHÔNG thành ngữ phương Tây hiếm gặp.
- Đúng 4 lựa chọn, format "A) ...", "B) ...", "C) ...", "D) ...". correct_choice COPY NGUYÊN VĂN 1 phần tử trong choices.
- Trường "difficulty" = "${reqDifficulty ?? 'Medium'}". trapRate là số (VD 40).`;

    // choice_analysis (giữ nguyên cơ chế dạy loại trừ bẫy).
    systemPrompt += `

BẮT BUỘC thêm trường "choice_analysis": MẢNG 4 phần tử ứng với 4 đáp án theo ĐÚNG thứ tự, gồm:
- "choice_letter": chữ cái đáp án (A, B, C, D).
- "is_correct": true nếu đúng, false nếu sai. CHỈ ĐÚNG 1 phần tử is_correct=true, khớp correct_choice.
- "analysis": 1-2 câu TIẾNG VIỆT. Nếu đúng: vì sao đúng. Nếu sai: chỉ rõ lỗi/hiểu nhầm khiến học sinh dễ chọn nhầm.`;

    const choiceAnalysisSchema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          choice_letter: { type: "string", description: "A, B, C, or D" },
          is_correct: { type: "boolean" },
          analysis: { type: "string", description: "1-2 câu tiếng Việt giải thích vì sao đúng hoặc sai" }
        },
        required: ["choice_letter", "is_correct", "analysis"],
        additionalProperties: false
      }
    };

    const cambridgeSchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        full_passage: { type: "string" },
        practice_question: { type: "string" },
        choices: { type: "array", items: { type: "string" } },
        correct_choice: { type: "string" },
        explanation: { type: "string" },
        cefr_level: { type: "string", description: "A1, A2, or B1" },
        difficulty: { type: "string", description: "Easy, Medium, or Hard" },
        trapRate: { type: "integer", description: "Percentage of students who fall for traps, e.g. 40" },
        choice_analysis: choiceAnalysisSchema
      },
      required: ["title", "full_passage", "practice_question", "choices", "correct_choice", "explanation", "cefr_level", "difficulty", "trapRate", "choice_analysis"],
      additionalProperties: false
    };

    const requestBody = {
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "cambridge_choice_question",
          strict: true,
          schema: cambridgeSchema
        }
      },
      temperature: 0.4
    };

    let response: Response;
    try {
      response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
    } catch (e) {
      await releaseUsage(user.id, 'gen', reservation.reserved, reservation.date);
      throw e;
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API Error:", errorData);
      await releaseUsage(user.id, 'gen', reservation.reserved, reservation.date);
      return NextResponse.json({ error: "Lỗi gọi OpenAI API" }, { status: response.status });
    }

    const responseData = await response.json();
    const content = responseData.choices?.[0]?.message?.content;

    if (!content) {
      await releaseUsage(user.id, 'gen', reservation.reserved, reservation.date);
      throw new Error("No content generated");
    }

    // Ghi kế toán cost + quota TRƯỚC khi trả response. AWAIT (audit 2026-07-03,
    // ROOT D): fire-and-forget trên serverless có thể bị freeze/kill sau khi
    // response trả về → mất bản ghi → thất thoát trần ngân sách/quota. Vẫn giữ
    // .catch để lỗi DB KHÔNG làm hỏng câu trả lời AI đã sinh thành công.
    await Promise.allSettled([
      recordGlobalCost(
        responseData.usage?.prompt_tokens ?? 0,
        responseData.usage?.completion_tokens ?? 0,
        'gpt-4o-mini'
      ).catch((e) => console.error('recordGlobalCost:', e)),
      finalizeUsage(
        user.id,
        'gen',
        responseData.usage?.prompt_tokens ?? 0,
        responseData.usage?.completion_tokens ?? 0,
        reservation.reserved,
        reservation.date
      ).catch((e) => console.error('finalizeUsage:', e)),
    ]);

    const data = JSON.parse(content);
    
    // Áp dụng thuật toán cleanAiText để chuẩn hóa LaTeX
    const { cleanAiText } = await import('@/helpers/ai-formatter');
    if (data.full_passage) data.full_passage = cleanAiText(data.full_passage);
    if (data.theory) data.theory = cleanAiText(data.theory);
    if (data.sample_example) data.sample_example = cleanAiText(data.sample_example);
    if (data.practice_question) data.practice_question = cleanAiText(data.practice_question);
    if (data.explanation) data.explanation = cleanAiText(data.explanation);
    if (data.choices && Array.isArray(data.choices)) {
      data.choices = data.choices.map((c: string) => cleanAiText(c));
    }
    // Phân tích từng đáp án (Nhóm 7 #9): chuẩn hóa LaTeX trong phần phân tích Toán.
    if (Array.isArray(data.choice_analysis)) {
      data.choice_analysis = data.choice_analysis.map(
        (c: { choice_letter?: string; is_correct?: boolean; analysis?: string }) => ({
          ...c,
          analysis: typeof c.analysis === 'string' ? cleanAiText(c.analysis) : c.analysis,
        })
      );
    }

    // VALIDATE LOGIC (tối ưu #2): json_schema đảm bảo cấu trúc nhưng KHÔNG đảm bảo
    // logic (2 đáp án đúng, correct_choice không nằm trong choices...). Câu lỗi lọt
    // vào bank sẽ lan cho nhiều học sinh → ghi nhớ SAI. Fail → KHÔNG saveToBank +
    // KHÔNG issue; báo lỗi để client thử lại (fallback bank ở lần sau).
    const validation = validateQuestion(data);
    if (!validation.ok) {
      console.error('Câu AI sinh KHÔNG hợp lệ, bỏ qua:', validation.reasons.join('; '));
      const fb = (await getFromBank(moduleType, topic, reqDifficulty)) as Record<string, unknown> | null;
      if (fb) return issueBankResponse(user.id, fb, skillId, { _source: 'bank', _degraded: 'invalid_ai' });
      return NextResponse.json({ error: 'Câu hỏi vừa sinh chưa đạt chuẩn. Vui lòng thử lại.' }, { status: 502 });
    }

    // KIỂM CEFR LEVEL chặt hơn (Cambridge KET/PET chỉ dùng A1/A2/B1). json_schema
    // yêu cầu cefr_level nhưng GPT có thể trả 'B2'/'C1'/thiếu/không khớp độ khó.
    // ƯU TIÊN sửa nhẹ: nếu cefr_level lệch nhưng difficulty đúng → override theo
    // difficulty (Easy→'A2', Medium→'A2', Hard→'B1') thay vì reject (tránh fallback
    // thừa + vẫn dùng được câu AI đã tốn token). Chỉ reject (bank/502) khi cefr_level
    // KHÔNG thuộc 3 giá trị hợp lệ VÀ không suy được từ difficulty.
    const VALID_CEFR = ['A1', 'A2', 'B1'] as const;
    const CEFR_BY_DIFFICULTY: Record<'Easy' | 'Medium' | 'Hard', string> = {
      Easy: 'A2',
      Medium: 'A2',
      Hard: 'B1',
    };
    const rawCefr = typeof data.cefr_level === 'string' ? (data.cefr_level as string).trim().toUpperCase() : '';
    const diffFromAi = typeof data.difficulty === 'string' && VALID_DIFFICULTY.includes(data.difficulty as string)
      ? (data.difficulty as 'Easy' | 'Medium' | 'Hard')
      : (reqDifficulty ?? 'Medium');

    if (!VALID_CEFR.includes(rawCefr as typeof VALID_CEFR[number])) {
      // cefr_level lạ/thiếu → thử suy từ difficulty (ưu tiên sửa nhẹ, không reject).
      const inferred = CEFR_BY_DIFFICULTY[diffFromAi];
      if (inferred) {
        data.cefr_level = inferred;
        console.error(`cefr_level lạ: "${rawCefr}" → override theo difficulty (${diffFromAi}) thành "${inferred}"`);
      } else {
        // Không suy được → reject (không saveToBank/issue).
        console.error(`cefr_level lạ: "${rawCefr}" và không suy được từ difficulty "${String(data.difficulty)}"`);
        const fb = (await getFromBank(moduleType, topic, reqDifficulty)) as Record<string, unknown> | null;
        if (fb) return issueBankResponse(user.id, fb, skillId, { _source: 'bank', _degraded: 'invalid_cefr' });
        return NextResponse.json({ error: 'Câu hỏi vừa sinh không đúng trình độ Cambridge. Vui lòng thử lại.' }, { status: 502 });
      }
    } else {
      // cefr_level hợp lệ nhưng lệch difficulty (VD difficulty='Hard' mà cefr='A1')
      // → override cefr theo difficulty để nhất quán chấm band.
      const expected = CEFR_BY_DIFFICULTY[diffFromAi];
      if (rawCefr !== expected) {
        data.cefr_level = expected;
        console.error(`cefr_level lệch difficulty: "${rawCefr}" vs "${diffFromAi}" → override thành "${expected}"`);
      }
    }

    // Lưu câu mới vào Question Bank để tái sử dụng (§9.4). Không chặn response
    // nếu lưu lỗi — chỉ là tối ưu chi phí, không phải đường tới hạn.
    saveToBank(moduleType, topic ?? '', data, skillId).catch((e) =>
      console.error('Không lưu được vào question bank:', e)
    );

    // ROOT A: lưu đáp án + choice_analysis SERVER-SIDE, GIẤU cả hai khỏi payload
    // (choice_analysis chứa is_correct = lộ đáp án). Client dùng /api/grade để chấm
    // + nhận lại choice_analysis sau khi nộp, /api/hint để lấy 1 bẫy trước khi nộp.
    const analysis = Array.isArray(data.choice_analysis)
      ? (data.choice_analysis as ChoiceAnalysis[])
      : undefined;
    const questionId = await issueQuestion(user.id, data.correct_choice, skillId, data.difficulty, {
      src: 'ai',
      choiceAnalysis: analysis,
    });
    const { correct_choice: _hidden, choice_analysis: _ca, ...safeData } = data;
    return NextResponse.json({ ...safeData, skillId, questionId, _source: 'ai' });

  } catch (error: unknown) {
    console.error("Generate practice error:", error);
    return NextResponse.json({ error: (error as Error)?.message || "Failed to generate practice" }, { status: 500 });
  }
}
