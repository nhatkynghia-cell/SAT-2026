import type { Difficulty } from './mastery';

/**
 * ============================================================================
 *  MISTAKE → BIẾN THỂ (Variant) — implementation_plan.md §10.A.4 / Nhóm 7 #6
 * ============================================================================
 *  Khi ôn một câu SAI, thay vì cho làm lại ĐÚNG câu cũ (dễ học vẹt vị trí đáp
 *  án), ta sinh một câu BIẾN THỂ: CÙNG kỹ năng (skillId) nhưng KHÁC số liệu.
 *  Buộc học sinh chủ động hồi tưởng phương pháp thay vì nhớ đáp án → ghi nhớ
 *  bền hơn (active recall), và kết quả trên biến thể là tín hiệu SRS THẬT
 *  (mạnh hơn tự đánh giá "đã nhớ/chưa nhớ").
 *
 *  Điều kiện tiên quyết: câu sai phải có `skill_id` (cột mới user_mistakes,
 *  migration phase1_5_pvp_mistakes.sql). Câu sai cũ (skill_id = null) không có
 *  nút biến thể — vẫn ôn theo lối cũ (xem lại đáp án).
 *
 *  ⚠️ THUẦN (pure) — chỉ import TYPE Difficulty (bị xóa khi biên dịch), KHÔNG
 *  import VALUE chéo .ts (giữ node:test resolve được, theo mẫu gate-exam.ts).
 *  Tra taxonomy (getSkill) + mastery (getSkillMastery) + độ khó ZPD
 *  (selectDifficulty) do TẦNG GỌI (route /api/cau-sai/variant) làm rồi TIÊM vào.
 * ============================================================================
 */

/** Thông tin skill tối thiểu cần để dựng câu biến thể (từ getSkill). */
export interface SkillLike {
  id: string;
  /** moduleType để gọi /api/generate-practice (math/literature/vocab). */
  moduleType: string;
  /** Nhãn skill — dùng làm topic cho prompt AI bám đúng dạng. */
  label: string;
}

export interface VariantRequest {
  /** skillId gốc — echo lại để câu biến thể ghi mastery đúng chỗ. */
  skillId: string;
  /** moduleType để gọi /api/generate-practice. */
  moduleType: string;
  /** topic = nhãn skill. */
  topic: string;
  /** Độ khó theo vùng phát triển gần (ZPD), do caller tính từ mastery. */
  difficulty: Difficulty;
}

/**
 * Dựng payload gọi generate-practice cho một BIẾN THỂ của skill đã làm sai.
 * Trả null nếu skill không hợp lệ (undefined từ getSkill — câu sai cũ chưa gắn
 * skill, hoặc id rác) → route trả 400 để client ẩn nút biến thể.
 *
 * difficulty được TIÊM (route tính qua selectDifficulty theo mastery hiện tại):
 * đang yếu skill này → câu dễ hơn (củng cố), đang khá → câu khó hơn (thử thách).
 */
export function buildVariantRequest(
  skill: SkillLike | undefined | null,
  difficulty: Difficulty
): VariantRequest | null {
  if (!skill) return null;

  return {
    skillId: skill.id,
    moduleType: skill.moduleType,
    topic: skill.label,
    difficulty,
  };
}
