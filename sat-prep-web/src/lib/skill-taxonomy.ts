/**
 * ============================================================================
 *  SKILL TAXONOMY — cây kỹ năng SAT (implementation_plan.md §10.A.3, §10.B.1)
 * ============================================================================
 *  Nguồn gốc: trích từ app Streamlit gốc (pages/3_📐_Chinh_Phục_Toán_Học.py,
 *  biến CHU_DE_TOAN) — 4 chương × 4 dạng = 16 dạng Toán chuẩn SAT, cộng các
 *  domain Reading & Writing.
 *
 *  Đây là NỀN MÓNG dùng chung cho:
 *    • Mastery Tracking (task #9) — đo % thành thạo từng skill.
 *    • Skill Tree = bản đồ năng lực (task #17) — node mở khóa theo mastery.
 *    • Score Prediction (task #11), Adaptive (task #12), Boss = assessment (#19).
 *
 *  ⚠️ skillId PHẢI ỔN ĐỊNH (không đổi sau khi phát hành) vì dữ liệu mastery của
 *  người dùng tham chiếu tới id này. Thêm skill mới = thêm id mới, không sửa id cũ.
 * ============================================================================
 */

export type Subject = 'math' | 'reading';

export interface Skill {
  id: string;
  /** Nhãn hiển thị (song ngữ giữ nguyên phong cách app gốc). */
  label: string;
  /** moduleType tương ứng khi gọi generate-practice (math/literature/desmos/vocab). */
  moduleType: string;
}

export interface SkillDomain {
  id: string;
  subject: Subject;
  label: string;
  skills: Skill[];
}

export const SKILL_TREE: SkillDomain[] = [
  {
    id: 'algebra',
    subject: 'math',
    label: 'Heart of Algebra (Đại số cốt lõi)',
    skills: [
      { id: 'algebra.linear_eq', label: 'Phương trình bậc nhất một ẩn (Linear Equations in One Variable)', moduleType: 'math' },
      { id: 'algebra.linear_fn', label: 'Hàm số bậc nhất và đồ thị đường thẳng (Linear Functions & Graphs)', moduleType: 'math' },
      { id: 'algebra.systems', label: 'Hệ phương trình bậc nhất hai ẩn (Systems of Linear Equations)', moduleType: 'math' },
      { id: 'algebra.inequalities', label: 'Bất phương trình bậc nhất và biểu diễn nghiệm (Linear Inequalities)', moduleType: 'math' },
    ],
  },
  {
    id: 'advanced_math',
    subject: 'math',
    label: 'Advanced Math (Toán nâng cao SAT)',
    skills: [
      { id: 'advanced.quadratic', label: 'Phương trình bậc hai, biệt thức Delta & Parabol (Quadratic Equations)', moduleType: 'math' },
      { id: 'advanced.exponential', label: 'Hàm số mũ, bài toán tăng trưởng lũy thừa (Exponential Functions)', moduleType: 'math' },
      { id: 'advanced.polynomials', label: 'Đa thức, định lý số dư & Phép chia đa thức (Polynomials & Remainder Theorem)', moduleType: 'math' },
      { id: 'advanced.radicals', label: 'Biến đổi biểu thức căn thức và mũ phân số (Radicals & Rational Exponents)', moduleType: 'math' },
    ],
  },
  {
    id: 'data_analysis',
    subject: 'math',
    label: 'Data Analysis (Giải quyết vấn đề & Phân tích số liệu)',
    skills: [
      { id: 'data.ratios', label: 'Tỷ số, tốc độ biến thiên, tỉ lệ thuận nghịch (Ratios, Rates, Proportions)', moduleType: 'math' },
      { id: 'data.percentages', label: 'Bài toán phần trăm tăng giảm chuyên sâu (Percentages & Multipliers)', moduleType: 'math' },
      { id: 'data.statistics', label: 'Thống kê mô tả: Trung bình, Trung vị, Độ lệch (Statistics)', moduleType: 'math' },
      { id: 'data.probability', label: 'Xác suất đơn và xác suất có điều kiện (Probability)', moduleType: 'math' },
    ],
  },
  {
    id: 'geometry',
    subject: 'math',
    label: 'Geometry & Trigonometry (Hình học & Lượng giác SAT)',
    skills: [
      { id: 'geo.triangles', label: 'Góc song song, đường phân giác, tam giác đồng dạng (Lines, Angles, Triangles)', moduleType: 'math' },
      { id: 'geo.circles', label: 'Đường tròn, diện tích hình quạt, phương trình đường tròn (Circles)', moduleType: 'math' },
      { id: 'geo.volume', label: 'Thể tích hình khối, diện tích toàn phần nâng cao (Volume & Surface Area)', moduleType: 'math' },
      { id: 'geo.trig', label: 'Lượng giác trong tam giác vuông: Sin Cos Tan (Trigonometry)', moduleType: 'math' },
    ],
  },
  {
    id: 'reading_writing',
    subject: 'reading',
    label: 'Reading & Writing (Đọc hiểu & Ngữ pháp)',
    skills: [
      { id: 'rw.vocab', label: 'Từ vựng trong ngữ cảnh (Words in Context)', moduleType: 'vocab' },
      { id: 'rw.literature', label: 'Đọc hiểu văn bản cổ điển (Literature & Historical Texts)', moduleType: 'literature' },
    ],
  },
];

/** Mọi skill phẳng (tiện tra cứu nhanh theo id). */
export const ALL_SKILLS: Skill[] = SKILL_TREE.flatMap((d) => d.skills);

const SKILL_INDEX: Record<string, Skill> = Object.fromEntries(
  ALL_SKILLS.map((s) => [s.id, s])
);

export function isValidSkill(skillId: string): boolean {
  return skillId in SKILL_INDEX;
}

export function getSkill(skillId: string): Skill | undefined {
  return SKILL_INDEX[skillId];
}

export function getDomainOfSkill(skillId: string): SkillDomain | undefined {
  return SKILL_TREE.find((d) => d.skills.some((s) => s.id === skillId));
}
