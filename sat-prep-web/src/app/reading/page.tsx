'use client';

import { SkillPractice } from '@/components/SkillPractice';

export default function ReadingPage() {
  return (
    <SkillPractice
      moduleType="reading"
      title="ĐỌC HIỂU (READING)"
      subtitle="Luyện đọc hiểu Cambridge KET (A2) / PET (B1)."
      icon="📖"
      gradientFrom="#1e3a8a"
      gradientTo="#0f172a"
      accent="#60a5fa"
      topics={[
        { name: 'Thông báo & biển báo', desc: 'Đọc thông báo ngắn, chọn ý đúng (KET P1).', skillId: 'reading.notice_mcq' },
        { name: 'Ghép thông tin', desc: 'Ghép người với mô tả phù hợp (KET P2).', skillId: 'reading.matching' },
        { name: 'Đọc lấy chi tiết', desc: 'Đọc đoạn dài, trả lời câu hỏi chi tiết (KET P3/PET P3).', skillId: 'reading.detail_mcq' },
        { name: 'Điền câu vào đoạn', desc: 'Chọn câu điền vào chỗ trống (PET P4).', skillId: 'reading.gapped_text' },
        { name: 'Cloze từ vựng', desc: 'Điền từ hợp ngữ cảnh (KET P4/PET P6).', skillId: 'reading.cloze_vocab' },
        { name: 'Điền từ tự do', desc: 'Điền từ chức năng, không phương án (KET P5).', skillId: 'reading.open_cloze' },
      ]}
    />
  );
}
