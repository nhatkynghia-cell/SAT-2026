/**
 * ============================================================================
 *  SKILL TAXONOMY — cây kỹ năng Cambridge KET(A2)/PET(B1)
 * ============================================================================
 *  App luyện chứng chỉ Cambridge English cho học sinh cấp 2 VN. 6 domain theo
 *  4 kỹ năng (Reading/Writing/Listening/Speaking) + 2 domain nền tảng
 *  (Grammar/Vocabulary). Skill bám theo LOẠI TASK của đề KET/PET (1 skill phục
 *  vụ cả A2 và B1, độ khó thể hiện qua mastery/CEFR level).
 *
 *  Đây là NỀN MÓNG dùng chung cho:
 *    • Mastery Tracking — đo % thành thạo từng skill.
 *    • Skill Tree = bản đồ năng lực — node mở khóa theo mastery.
 *    • Score Prediction (CEFR), Adaptive, Boss = assessment (mock KET/PET).
 *
 *  ⚠️ skillId PHẢI ỔN ĐỊNH (không đổi sau khi phát hành) vì dữ liệu mastery của
 *  người dùng tham chiếu tới id này. Thêm skill mới = thêm id mới, không sửa id cũ.
 *  (App đang pilot chưa phát hành → id cũ trục SAT-Toán đã được thay sạch.)
 * ============================================================================
 */

export type Subject = 'reading' | 'writing' | 'listening' | 'speaking' | 'foundation';

export interface Skill {
  id: string;
  /** Nhãn hiển thị (song ngữ). */
  label: string;
  /** moduleType khi gọi generate-practice: reading/writing/listening/speaking/grammar/vocabulary. */
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
    id: 'reading',
    subject: 'reading',
    label: 'Reading (Đọc hiểu A2/B1)',
    skills: [
      { id: 'reading.notice_mcq', label: 'Đọc thông báo, biển báo ngắn — trắc nghiệm (KET P1, PET P1)', moduleType: 'reading' },
      { id: 'reading.matching', label: 'Ghép người với mô tả phù hợp (KET P2, PET P2)', moduleType: 'reading' },
      { id: 'reading.detail_mcq', label: 'Đọc đoạn dài lấy chi tiết — trắc nghiệm (KET P3, PET P3/P5)', moduleType: 'reading' },
      { id: 'reading.gapped_text', label: 'Điền câu (A–H) vào chỗ trống trong đoạn văn (PET P4)', moduleType: 'reading' },
      { id: 'reading.cloze_vocab', label: 'Cloze chọn từ vựng phù hợp ngữ cảnh (KET P4, PET P6)', moduleType: 'reading' },
      { id: 'reading.open_cloze', label: 'Điền từ tự do vào chỗ trống, không phương án (KET P5)', moduleType: 'reading' },
    ],
  },
  {
    id: 'writing',
    subject: 'writing',
    label: 'Writing (Viết A2/B1)',
    skills: [
      { id: 'writing.short_message', label: 'Viết tin nhắn / email ngắn 25–35 từ (KET P6)', moduleType: 'writing' },
      { id: 'writing.story_pictures', label: 'Viết truyện ngắn theo tranh gợi ý (KET P7)', moduleType: 'writing' },
      { id: 'writing.email_100', label: 'Viết email 100 từ theo tình huống (PET P1)', moduleType: 'writing' },
      { id: 'writing.article_or_story', label: 'Viết bài báo hoặc truyện 100 từ (PET P2)', moduleType: 'writing' },
    ],
  },
  {
    id: 'listening',
    subject: 'listening',
    label: 'Listening (Nghe A2/B1)',
    skills: [
      { id: 'listening.short_convo', label: 'Nghe hội thoại ngắn — trắc nghiệm (KET P1, PET P1)', moduleType: 'listening' },
      { id: 'listening.matching', label: 'Nghe và ghép thông tin (KET P2/P5)', moduleType: 'listening' },
      { id: 'listening.gap_fill', label: 'Nghe điền thông tin vào form / ghi chú (KET P3, PET P2)', moduleType: 'listening' },
      { id: 'listening.long_convo', label: 'Nghe hội thoại dài — trắc nghiệm (KET P4, PET P3/P4)', moduleType: 'listening' },
    ],
  },
  {
    id: 'speaking',
    subject: 'speaking',
    label: 'Speaking (Nói A2/B1)',
    skills: [
      { id: 'speaking.interview', label: 'Phỏng vấn thông tin cá nhân (KET P1, PET P1)', moduleType: 'speaking' },
      { id: 'speaking.collaborative', label: 'Thảo luận cặp theo tranh / tình huống (KET P2, PET P3)', moduleType: 'speaking' },
      { id: 'speaking.long_turn', label: 'Nói dài mô tả ảnh (PET P2)', moduleType: 'speaking' },
      { id: 'speaking.discussion', label: 'Thảo luận mở rộng theo chủ đề (PET P4)', moduleType: 'speaking' },
    ],
  },
  {
    id: 'grammar',
    subject: 'foundation',
    label: 'Grammar (Ngữ pháp nền tảng)',
    skills: [
      { id: 'grammar.a2', label: 'Ngữ pháp A2: thì cơ bản, so sánh, modal cơ bản', moduleType: 'grammar' },
      { id: 'grammar.b1', label: 'Ngữ pháp B1: hiện tại hoàn thành, điều kiện, bị động, mệnh đề quan hệ', moduleType: 'grammar' },
    ],
  },
  {
    id: 'vocabulary',
    subject: 'foundation',
    label: 'Vocabulary (Từ vựng nền tảng)',
    skills: [
      { id: 'vocabulary.a2', label: 'Từ vựng A2 Key (đời sống, gia đình, trường học, du lịch)', moduleType: 'vocabulary' },
      { id: 'vocabulary.b1', label: 'Từ vựng B1 Preliminary (giáo dục, công việc, môi trường, xã hội)', moduleType: 'vocabulary' },
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
