import { NextResponse } from 'next/server';
import { getFromBank, saveToBank, poolSize, MIN_POOL } from '@/lib/question-bank';
import { checkBudget, recordGlobalCost } from '@/lib/ai-cost';
import { getCurrentUser } from '@/lib/auth';
import { checkQuota, recordUsage, type AiTier } from '@/lib/ai-quota';
import { isValidSkill } from '@/lib/skill-taxonomy';

/**
 * Map (moduleType, topic) → skillId chuẩn trong skill-taxonomy (task #9 Mastery).
 * Reading/Writing map cứng theo module; Toán (math + desmos) match theo từ khóa
 * chủ đề vì topic là chuỗi tự do từ UI. Trả undefined nếu không khớp skill nào.
 */
function resolveSkillId(moduleType: string, topic: string): string | undefined {
  // Chuẩn hóa NFC trước khi match: dấu tiếng Việt có thể tới ở dạng tổ hợp (NFD)
  // từ một số nguồn input → regex literal (NFC trong source) sẽ trượt nếu không normalize.
  const t = (topic || '').normalize('NFC').toLowerCase();

  if (moduleType === 'vocab') return 'rw.vocab';
  if (moduleType === 'literature') return 'rw.literature';

  // desmos là công cụ Toán → vẫn quy về skill Toán như math.
  if (moduleType === 'math' || moduleType === 'desmos') {
    // Geometry & Trigonometry
    if (/geo|hình|lượng giác|trig|đường tròn|circle|tam giác|triangle|thể tích|volume/.test(t)) {
      if (/lượng giác|trig/.test(t)) return 'geo.trig';
      if (/đường tròn|circle/.test(t)) return 'geo.circles';
      if (/thể tích|volume/.test(t)) return 'geo.volume';
      return 'geo.triangles';
    }
    // Advanced Math
    if (/advanced|nâng cao|bậc hai|quadratic|parabol|đỉnh|vertex|mũ|exponential|đa thức|polynomial|căn|radical/.test(t)) {
      if (/mũ|exponential/.test(t)) return 'advanced.exponential';
      if (/đa thức|polynomial/.test(t)) return 'advanced.polynomials';
      if (/căn|radical/.test(t)) return 'advanced.radicals';
      return 'advanced.quadratic';
    }
    // Data Analysis
    if (/data|số liệu|thống kê|statistic|xác suất|probability|phần trăm|percent|tỉ lệ|tỷ lệ|ratio|rate|tốc độ/.test(t)) {
      if (/xác suất|probability/.test(t)) return 'data.probability';
      if (/phần trăm|percent/.test(t)) return 'data.percentages';
      if (/tỉ lệ|tỷ lệ|ratio|rate|tốc độ/.test(t)) return 'data.ratios';
      return 'data.statistics';
    }
    // Heart of Algebra (mặc định cho Toán)
    if (/hệ phương trình|system/.test(t)) return 'algebra.systems';
    if (/bất phương trình|inequal/.test(t)) return 'algebra.inequalities';
    if (/hàm số|function|đồ thị|graph/.test(t)) return 'algebra.linear_fn';
    return 'algebra.linear_eq';
  }

  return undefined;
}

export async function POST(req: Request) {
  try {
    const { moduleType, topic, prefer = 'auto', skillId: clientSkillId, difficulty: reqDiffRaw } = await req.json();

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
    if (prefer !== 'ai' && poolSize(moduleType) >= MIN_POOL) {
      const cached = getFromBank(moduleType, topic, reqDifficulty);
      if (cached) {
        return NextResponse.json({ ...cached, skillId, _source: 'bank' });
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Nếu không có key mà bank còn câu nào khớp module → dùng tạm (degrade mềm).
      // Degrade mềm: ưu tiên đúng độ khó yêu cầu, nếu bank không có thì lấy bất kỳ.
      const fallback = getFromBank(moduleType, topic, reqDifficulty) ?? getFromBank(moduleType, topic);
      if (fallback) {
        return NextResponse.json({ ...fallback, skillId, _source: 'bank' });
      }
      return NextResponse.json({ error: "Chưa cấu hình OPENAI_API_KEY" }, { status: 500 });
    }

    // Kill-switch ngân sách (§9.5): nếu đã vượt trần chi phí ngày, degrade mềm
    // về Question Bank thay vì gọi OpenAI. Nếu bank trống → báo bận.
    if (!checkBudget().allowed) {
      // Degrade mềm: ưu tiên đúng độ khó yêu cầu, nếu bank không có thì lấy bất kỳ.
      const fallback = getFromBank(moduleType, topic, reqDifficulty) ?? getFromBank(moduleType, topic);
      if (fallback) {
        return NextResponse.json({ ...fallback, skillId, _source: 'bank', _degraded: 'budget' });
      }
      return NextResponse.json(
        { error: "Hệ thống AI tạm đạt giới hạn vận hành trong ngày. Vui lòng thử lại sau.", budgetExceeded: true },
        { status: 503 }
      );
    }

    // Enforce quota freemium TRƯỚC khi gọi OpenAI (cùng engine với /api/chat,
    // task 5.2). Chỉ tính khi THỰC SỰ gọi AI — câu lấy từ Question Bank ở trên
    // KHÔNG tốn token nên đã return sớm, không chạm tới đây.
    const user = await getCurrentUser();
    // TODO(Phase 2): lấy tier thật từ subscription. Tạm coi mọi user là 'free'.
    const tier: AiTier = 'free';
    const quota = await checkQuota(user.id, tier);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Bạn đã dùng hết ${quota.limit} lượt sinh câu hỏi AI hôm nay. Nâng cấp Premium để luyện tập không giới hạn nhé!`,
          quotaExceeded: true,
          used: quota.used,
          limit: quota.limit,
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
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: moduleType === "math" ? "sat_math_lesson" : "sat_practice_question",
          strict: true,
          schema: moduleType === "math" ? mathSchema : baseSchema
        }
      },
      temperature: 0.3
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
      return NextResponse.json({ error: "Lỗi gọi OpenAI API" }, { status: response.status });
    }

    const responseData = await response.json();
    const content = responseData.choices[0].message.content;

    if (!content) throw new Error("No content generated");

    // Ghi chi phí vào sổ cái toàn hệ thống (§9.5).
    recordGlobalCost(
      responseData.usage?.prompt_tokens ?? 0,
      responseData.usage?.completion_tokens ?? 0,
      'gpt-4o-mini'
    ).catch((e) => console.error('recordGlobalCost:', e));

    // Ghi nhận 1 lượt gọi AI vào quota của user (chỉ khi thật sự gọi OpenAI).
    recordUsage(
      user.id,
      responseData.usage?.prompt_tokens ?? 0,
      responseData.usage?.completion_tokens ?? 0
    ).catch((e) => console.error('recordUsage:', e));

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
    // nếu lưu lỗi — chỉ là tối ưu chi phí, không phải đường tới hạn.
    saveToBank(moduleType, topic ?? '', data).catch((e) =>
      console.error('Không lưu được vào question bank:', e)
    );

    return NextResponse.json({ ...data, skillId, _source: 'ai' });

  } catch (error: unknown) {
    console.error("Generate practice error:", error);
    return NextResponse.json({ error: (error as Error)?.message || "Failed to generate practice" }, { status: 500 });
  }
}
