import type { MasterySummary, Difficulty } from './mastery';
import type { Subject } from './skill-taxonomy';
import { recommendNext } from './adaptive';

/**
 * ============================================================================
 *  STUDY PLAN — dựng chuỗi bước học tiếp theo (tối ưu #8, phần THUẦN)
 * ============================================================================
 *  Lên kế hoạch HỌC NGÀY thay vì chỉ gợi ý 1 skill rời rạc. Lấy đề xuất skill
 *  yếu nhất (recommendNext) làm BƯỚC 1, rồi GIẢ ĐỊNH bước trước đã mastered để
 *  đề xuất skill yếu kế tiếp → chuỗi N bước xoay vòng dồn vào các lỗ hổng còn
 *  tồn đọng. Mỗi bước gắn lý do + thời lượng ước tính theo độ khó.
 *
 *  ⚠️ THUẦN (pure) — KHÔNG I/O DB. Nhận MasterySummary qua tham số, clone từng
 *  bước trước khi giả định mastered để KHÔNG mutate summary đầu vào. recommendNext
 *  trong adaptive.ts cũng thuần (chỉ import TYPE chéo) → import VALUE an toàn.
 *
 *  Tách khỏi adaptive.ts: adaptive đề xuất 1 câu/skill tiếp theo; study-plan
 *  dựng CẢ CHUỖI ngày học (lớp cao hơn, phục vụ UI "Kế hoạch hôm nay").
 * ============================================================================
 */

/** Ngưỡng mastery coi là đã làm chủ — đồng bộ mastery.ts (giả định mastered khi
 *  dựng bước kế tiếp). Khai báo lại ở đây (không import value từ mastery.ts vì
 *  mastery.ts kéo mastery-store → supabase/next, gãy unit test thuần). */
const MASTERED_THRESHOLD = 80;

/** Một bước trong kế hoạch học. */
export interface StudyStep {
  /** Thứ tự bước (1-based). */
  order: number;
  /** id skill luyện ở bước này. */
  skillId: string;
  /** Nhãn hiển thị của skill. */
  label: string;
  /** Loại module (reading/writing/listening/speaking/grammar/vocabulary…). */
  moduleType: string;
  /** Độ khó câu đề xuất cho bước này. */
  difficulty: Difficulty;
  /** Lý do chọn bước (dẫn từ recommendNext). */
  reason: string;
  /** Thời lượng ước tính (phút) theo độ khó. */
  estMinutes: number;
}

/** Tùy chọn dựng kế hoạch. */
export interface StudyPlanOptions {
  /** Số bước muốn dựng (mặc định 5). Dừng sớm nếu không còn skill chưa mastered. */
  count?: number;
  /** Lọc theo môn — truyền xuống recommendNext (planForSubject dùng internally). */
  subject?: Subject;
  /** Lọc theo moduleType — truyền xuống recommendNext (mở rộng, không bắt buộc). */
  moduleType?: string;
}

/** Phút ước tính mỗi độ khó (Easy nhẹ — ôn nhanh; Hard nặng — tốn thời gian). */
const MINUTES_BY_DIFFICULTY: Record<Difficulty, number> = {
  Easy: 5,
  Medium: 8,
  Hard: 12,
};

/**
 * Tạo bản sao sâu (deep-ish) của MasterySummary để giả định mastered mà không
 * chạm tới summary đầu vào. Chỉ clone `skills` (mảng đối tượng) — bySubject/
 * overall không bị mutate trong thuật toán nên giữ nguyên tham chiếu OK.
 */
function cloneSummary(summary: MasterySummary): MasterySummary {
  return {
    ...summary,
    skills: summary.skills.map((s) => ({ ...s })),
  };
}

/**
 * Đánh dấu 1 skill là đã mastered TRÊN BẢN SAO (đặt score ≥ MASTERED_THRESHOLD,
 * mastered=true, giữ attempts/reliable nguyên để rank phụ thuộc ổn định). Trả
 * về bản sao đã sửa (pure). Không tìm thấy skillId → trả nguyên bản sao.
 */
function assumeMastered(
  cloned: MasterySummary,
  skillId: string
): MasterySummary {
  const skills = cloned.skills.map((s) =>
    s.id === skillId
      ? {
          ...s,
          score: Math.max(s.score, MASTERED_THRESHOLD),
          mastered: true,
        }
      : s
  );
  return { ...cloned, skills };
}

/**
 * Dựng chuỗi N bước học tiếp theo.
 *
 * Thuật toán:
 *   • Bước 1 = recommendNext(summary, opts) (skill yếu nhất chưa mastered).
 *   • Các bước sau = recommendNext trên bản sao đã "giả định" các bước trước
 *     mastered → đề xuất skill yếu kế tiếp.
 *   • recommendNext trả null (hết skill chưa mastered) → dừng sớm.
 *
 * KHÔNG mutate summary đầu vào — clone từng bước, giả định mastered chỉ trên
 * bản sao. Trả [] nếu summary rỗng / recommendNext không đề xuất gì ngay từ đầu.
 */
export function buildStudyPlan(
  summary: MasterySummary,
  opts: StudyPlanOptions = {}
): StudyStep[] {
  const count = opts.count ?? 5;
  if (count <= 0) return [];

  const steps: StudyStep[] = [];

  // Bản sao làm việc — giả định mastered dồn vào đây, KHÔNG chạm `summary`.
  let working = cloneSummary(summary);

  for (let i = 0; i < count; i++) {
    const rec = recommendNext(working, opts);
    if (!rec) break; // không còn skill chưa mastered → dừng sớm.

    steps.push({
      order: steps.length + 1,
      skillId: rec.skillId,
      label: rec.label,
      moduleType: rec.moduleType,
      difficulty: rec.difficulty,
      reason: rec.reason,
      estMinutes: MINUTES_BY_DIFFICULTY[rec.difficulty],
    });

    // Giả định bước vừa thêm đã mastered → bước kế tiếp xoay sang skill khác.
    working = assumeMastered(working, rec.skillId);
  }

  return steps;
}

/**
 * Dựng kế hoạch học cho 1 MÔN duy nhất (reading/writing/…). Lọc summary theo
 * subject rồi dựng chuỗi — truyền opts.subject xuống recommendNext để rank chỉ
 * xét skill thuộc môn đó. Trả [] nếu môn không có skill nào.
 */
export function planForSubject(
  summary: MasterySummary,
  subject: Subject,
  opts: Omit<StudyPlanOptions, 'subject'> = {}
): StudyStep[] {
  return buildStudyPlan(summary, { ...opts, subject });
}

/** Kết quả tóm tắt kế hoạch — phục vụ UI "Kế hoạch hôm nay". */
export interface StudyPlanSummary {
  /** Tổng số bước trong kế hoạch. */
  totalSteps: number;
  /** Tổng thời lượng ước tính (phút). */
  totalMinutes: number;
  /** Danh sách skillId duy nhất được chạm tới (loại trùng). */
  skillsCovered: string[];
  /** skillId ở bước 1 — điểm tập trung chính của phiên học. */
  focusSkill: string | null;
}

/**
 * Tóm tắt kế hoạch cho UI: tổng bước, tổng phút, skill chạm tới (unique), và
 * skill tập trung (bước 1). Plan rỗng → totalSteps=0, focusSkill=null,
 * skillsCovered=[], totalMinutes=0.
 */
export function planSummary(plan: StudyStep[]): StudyPlanSummary {
  const totalMinutes = plan.reduce((sum, s) => sum + s.estMinutes, 0);
  const skillsCovered = Array.from(new Set(plan.map((s) => s.skillId)));
  const focusSkill = plan.length > 0 ? plan[0].skillId : null;
  return {
    totalSteps: plan.length,
    totalMinutes,
    skillsCovered,
    focusSkill,
  };
}
