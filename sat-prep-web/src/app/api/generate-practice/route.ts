import { NextResponse } from 'next/server';
import { getFromBank, saveToBank, poolSize, MIN_POOL } from '@/lib/question-bank';
import { checkBudget, recordGlobalCost, modelForTier } from '@/lib/ai-cost';
import { getCurrentUser } from '@/lib/auth';
import { reserveQuota, finalizeUsage, releaseUsage } from '@/lib/ai-quota';
import { getUserTier } from '@/lib/subscription-store';
import { getDomainOfSkill, isValidSkill } from '@/lib/skill-taxonomy';
import { FREE_DOMAINS } from '@/lib/skill-tree';
import { resolveSkillId } from '@/lib/skill-resolver';
import { issueQuestion, type ChoiceAnalysis } from '@/lib/issued-questions';
import type { AiTier } from '@/lib/ai-quota';
import { OPENAI_CHAT_COMPLETIONS_URL } from '@/lib/openai';
import { rateLimit } from '@/lib/rate-limit';

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

export function canGeneratePracticeForTier(tier: AiTier, skillId: string | undefined): boolean {
  if (tier !== 'free') return true;
  if (!skillId) return false;
  const domain = getDomainOfSkill(skillId);
  return !!domain && FREE_DOMAINS.includes(domain.id);
}

export async function POST(req: Request) {
  try {
    const { moduleType, topic: topicRaw, prefer = 'auto', skillId: clientSkillId, difficulty: reqDiffRaw } = await req.json();
    const user = await getCurrentUser();

    // Kẹp độ dài topic client gửi (nội suy thẳng vào prompt) → chặn phồng input token.
    const topic = typeof topicRaw === 'string' ? topicRaw.slice(0, 200) : topicRaw;

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

    // Tier THẬT lấy sớm để gate cả đường Question Bank: free không được bypass UI
    // bằng cách POST tay module/skill thuộc chương trả phí.
    const tier = await getUserTier(user.id);
    if (!canGeneratePracticeForTier(tier, skillId)) {
      return NextResponse.json(
        {
          error: 'Nội dung này chỉ dành cho Premium/Ultimate. Nâng cấp để mở khóa toàn bộ chương luyện tập.',
          tierLocked: true,
        },
        { status: 403 }
      );
    }

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

    // Rate-limit per-user CHỈ khi sắp gọi AI thật (bank hits ở trên đã return,
    // không bị chặn). Chống burst đồng thời vượt quota + giảm race TOCTOU; áp mọi
    // tier vì premium/ultimate quota vô hạn nên đây là trần duy nhất chặn 1 tài
    // khoản đốt sạch budget chung.
    const rl = rateLimit(`genpractice:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Bạn tạo câu hơi nhanh. Chờ chút rồi thử lại nhé.', retryAfterMs: rl.retryAfterMs },
        { status: 429 }
      );
    }

    // Enforce quota freemium TRƯỚC khi gọi OpenAI (cùng engine với /api/chat) qua
    // RESERVE-BEFORE-CALL (đóng C1 TOCTOU): increment count NGUYÊN TỬ có khóa dòng
    // NGAY ĐÂY → N request đồng thời không cùng vượt cap 3/ngày (Free) đốt OpenAI.
    // Chỉ tính khi THỰC SỰ gọi AI — câu lấy từ Question Bank / degrade budget ở trên
    // KHÔNG tốn token nên đã return sớm, không chạm reserve. Lỗi RPC → fail-closed.
    // Quyền lợi A1 (2026-07-07): Ultimate sinh câu bằng model cao cấp (gpt-4o),
    // free/premium giữ gpt-4o-mini. Dùng cho cả requestBody.model lẫn recordGlobalCost
    // → kill-switch ngân sách tính đúng chi phí model thật.
    const model = modelForTier(tier);
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

    let systemPrompt = "";
    if (moduleType === "literature") {
      systemPrompt = `Mày là giáo sư Văn học và Lịch sử lỗi lạc, chuyên luyện thi phần Reading & Writing khó nhất của Digital SAT.
Chủ đề yêu cầu: ${topic}
Nhiệm vụ:
1. Viết 1 đoạn văn tiếng Anh CỰC KHÓ, chuẩn văn phong thế kỷ 18-19, ngữ pháp đảo lộn phức tạp, từ vựng cổ xưa (Archaic words). Khoảng 100-150 từ.
2. Viết 1 câu hỏi thực hành chuẩn SAT liên quan đến đoạn văn.
QUY TẮC:
- Đoạn văn, câu hỏi, đáp án PHẢI BẰNG TIẾNG ANH.
- Giải thích PHẢI BẰNG TIẾNG VIỆT 100%.
- Định dạng JSON phải sạch 100%, có thuộc tính difficulty (Easy, Medium, Hard) và trapRate (vd: 82).`;
    } else if (moduleType === "math") {
      systemPrompt = `Mày là giáo sư toán và là chuyên gia luyện thi SAT lỗi lạc.
Chủ đề yêu cầu: ${topic}
Nhiệm vụ:
1. Biên soạn một bài giảng nền tảng và bài tập thực hành Toán (Mức độ: SIÊU KHÓ - HARD MODULE).
2. Bao gồm concept_name (Tên bài học), theory (Lý thuyết cốt lõi), sample_example (Ví dụ mẫu và hướng dẫn tư duy).
3. Tạo 1 câu hỏi thực hành Toán học cực khó, có bẫy (practice_question), 4 đáp án (choices), đáp án đúng (correct_choice), và giải thích chi tiết (explanation).
QUY TẮC BẮT BUỘC:
- practice_question, choices, correct_choice PHẢI BẰNG TIẾNG ANH.
- concept_name, theory, sample_example, explanation PHẢI BẰNG TIẾNG VIỆT 100%.
- Công thức toán học, phân số, ký tự độ BẮT BUỘC bọc trong cặp dấu $...$ (VD: $\frac{1}{2}$, $180^\circ$).
- JSON trả về có difficulty (Hard) và trapRate (vd: 85).`;
    } else if (moduleType === "desmos") {
      systemPrompt = `Mày là chuyên gia dạy giải nhanh SAT bằng máy tính bỏ túi Desmos.
Chủ đề yêu cầu: ${topic}
Nhiệm vụ: Tạo 1 câu hỏi Toán có thể giải cực nhanh bằng cách vẽ đồ thị Desmos (bẫy hằng số k, hệ phương trình, parabola...).
QUY TẮC:
- Câu hỏi và đáp án Tiếng Anh.
- Giải thích Tiếng Việt, phải chỉ ra cách gõ lệnh vào Desmos.
- JSON trả về có difficulty và trapRate.`;
    } else {
      systemPrompt = `Mày là chuyên gia từ vựng SAT (Vocab).
Chủ đề: ${topic}
Nhiệm vụ: Tạo 1 câu điền từ vào chỗ trống chuẩn SAT.
QUY TẮC JSON y hệt các phần trên. Tiếng Anh cho câu hỏi, Tiếng Việt cho giải thích.`;
    }

    // ADAPTIVE: nếu caller yêu cầu độ khó cụ thể (Tower/Gate), ÉP độ khó đó —
    // directive đặt CUỐI prompt nên ghi đè dòng "SIÊU KHÓ/Hard" hardcode phía trên.
    // Không truyền difficulty → KHÔNG nối gì → prompt y hệt cũ (math vẫn mặc định Hard).
    if (reqDifficulty) {
      const DIFFICULTY_SPEC: Record<'Easy' | 'Medium' | 'Hard', string> = {
        Easy: 'CƠ BẢN (Easy): chỉ 1-2 bước suy luận, không cài bẫy tinh vi, học sinh trung bình làm được. trapRate khoảng 10-30.',
        Medium: 'TRUNG BÌNH (Medium): vài bước suy luận, có 1 bẫy phân tâm hợp lý. trapRate khoảng 40-60.',
        Hard: 'KHÓ (Hard): nhiều bước, bẫy tinh vi, đòi hỏi tư duy sâu. trapRate khoảng 70-90.',
      };
      systemPrompt += `

⚠️ ĐỘ KHÓ BẮT BUỘC (GHI ĐÈ mọi yêu cầu độ khó phía trên): ${DIFFICULTY_SPEC[reqDifficulty]}
Trường JSON "difficulty" PHẢI đúng bằng "${reqDifficulty}".`;
    }

    // PHÂN TÍCH TỪNG ĐÁP ÁN (Nhóm 7 #9) — dạy kỹ năng loại trừ bẫy, áp dụng MỌI
    // module. Mỗi phương án có 1 phân tích NGẮN Tiếng Việt: vì sao đúng, hoặc vì
    // sao SAI/đây là bẫy gì. choice_letter khớp nhãn đáp án (A/B/C/D).
    systemPrompt += `

BẮT BUỘC thêm trường "choice_analysis": MẢNG, mỗi phần tử ứng với MỘT đáp án trong "choices" theo ĐÚNG thứ tự, gồm:
- "choice_letter": chữ cái đáp án (A, B, C, D...).
- "is_correct": true nếu là đáp án đúng, false nếu sai.
- "analysis": 1-2 câu TIẾNG VIỆT. Nếu đúng: vì sao đúng. Nếu sai: chỉ rõ ĐÂY LÀ BẪY GÌ, vì sao học sinh dễ chọn nhầm (lỗi tư duy/tính sai/hiểu nhầm đề). Ngắn gọn, sắc.`;

    const choiceAnalysisSchema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          choice_letter: { type: "string", description: "A, B, C, or D" },
          is_correct: { type: "boolean" },
          analysis: { type: "string", description: "1-2 câu tiếng Việt giải thích vì sao đúng hoặc đây là bẫy gì" }
        },
        required: ["choice_letter", "is_correct", "analysis"],
        additionalProperties: false
      }
    };

    const baseSchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        full_passage: { type: "string" },
        archaic_words: {
          type: "array",
          items: {
            type: "object",
            properties: {
              word: { type: "string" },
              meaning: { type: "string" }
            },
            required: ["word", "meaning"],
            additionalProperties: false
          }
        },
        practice_question: { type: "string" },
        choices: {
          type: "array",
          items: { type: "string" }
        },
        correct_choice: { type: "string" },
        explanation: { type: "string" },
        difficulty: { type: "string", description: "Easy, Medium, or Hard" },
        trapRate: { type: "integer", description: "Percentage of students who fall for traps, e.g. 82" },
        choice_analysis: choiceAnalysisSchema
      },
      required: ["title", "full_passage", "archaic_words", "practice_question", "choices", "correct_choice", "explanation", "difficulty", "trapRate", "choice_analysis"],
      additionalProperties: false
    };

    const mathSchema = {
      type: "object",
      properties: {
        concept_name: { type: "string" },
        theory: { type: "string" },
        sample_example: { type: "string" },
        practice_question: { type: "string" },
        choices: {
          type: "array",
          items: { type: "string" }
        },
        correct_choice: { type: "string" },
        explanation: { type: "string" },
        difficulty: { type: "string", description: "Easy, Medium, or Hard" },
        trapRate: { type: "integer", description: "Percentage of students who fall for traps" },
        choice_analysis: choiceAnalysisSchema
      },
      required: ["concept_name", "theory", "sample_example", "practice_question", "choices", "correct_choice", "explanation", "difficulty", "trapRate", "choice_analysis"],
      additionalProperties: false
    };

    const requestBody = {
      model,
      messages: [{ role: "system", content: systemPrompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: moduleType === "math" ? "sat_math_lesson" : "sat_practice_question",
          strict: true,
          schema: moduleType === "math" ? mathSchema : baseSchema
        }
      },
      temperature: 0.3,
      // Trần output token: bài math (schema lớn nhất) vẫn đủ, chặn cost blowup.
      max_completion_tokens: 2000
    };

    // Gọi OpenAI. Mọi đường LỖI (HTTP !ok, network throw, response rỗng) → RELEASE
    // slot đã reserve: lỗi hạ tầng KHÔNG tính vào quota người dùng. Sau khi có content
    // hợp lệ (OpenAI đã tính tiền) → finalize; throw downstream (parse/issue) KHÔNG
    // release nữa (câu đã sinh + billed, chỉ hạch toán/lưu bank lỗi).
    let responseData;
    try {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("OpenAI API Error:", errorData);
        await releaseUsage(user.id, 'gen', reservation.reserved, reservation.date);
        return NextResponse.json({ error: "Lỗi gọi OpenAI API" }, { status: response.status });
      }

      responseData = await response.json();
    } catch (e) {
      await releaseUsage(user.id, 'gen', reservation.reserved, reservation.date);
      throw e;
    }

    const content = responseData.choices?.[0]?.message?.content;

    if (!content) {
      await releaseUsage(user.id, 'gen', reservation.reserved, reservation.date);
      throw new Error("No content generated");
    }

    // Ghi kế toán cost + chốt quota TRƯỚC khi trả response. AWAIT (audit 2026-07-03,
    // ROOT D): fire-and-forget trên serverless có thể bị freeze/kill sau khi
    // response trả về → mất bản ghi → thất thoát trần ngân sách/quota. Vẫn giữ
    // .catch để lỗi DB KHÔNG làm hỏng câu trả lời AI đã sinh thành công.
    // finalizeUsage: count đã reserve, chỉ cộng token (reserved:true); pre-migration
    // (reserved:false) → recordUsage cũ (tăng count + token) → 0 regression.
    await Promise.allSettled([
      recordGlobalCost(
        responseData.usage?.prompt_tokens ?? 0,
        responseData.usage?.completion_tokens ?? 0,
        model
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

    // Lưu câu mới vào Question Bank để tái sử dụng (§9.4). Không chặn response
    // nếu lưu lỗi — chỉ là tối ưu chi phí, không phải đường tới hạn. skillId
    // persist kèm (cột skill_id + data.skillId) để curation nhóm theo skill (Bước 0).
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
