'use client';

import { SkillPractice } from '@/components/SkillPractice';

export default function ListeningPage() {
  return (
    <div>
      <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-3 mb-4 text-sm text-amber-200">
        🎧 Giai đoạn hiện tại: bài nghe dùng <b>transcript (lời thoại dạng chữ)</b> trong câu hỏi. Âm thanh (audio) sẽ được bổ sung ở phiên bản sau.
      </div>
      <SkillPractice
        moduleType="listening"
        title="NGHE (LISTENING)"
        subtitle="Luyện nghe hiểu Cambridge KET (A2) / PET (B1)."
        icon="🎧"
        gradientFrom="#065f46"
        gradientTo="#022c22"
        accent="#34d399"
        topics={[
          { name: 'Hội thoại ngắn', desc: 'Nghe hội thoại ngắn, chọn ý đúng (KET P1).', skillId: 'listening.short_convo' },
          { name: 'Ghép thông tin', desc: 'Nghe và ghép thông tin (KET P2/P5).', skillId: 'listening.matching' },
          { name: 'Điền form / ghi chú', desc: 'Nghe điền thông tin vào biểu mẫu (KET P3/PET P2).', skillId: 'listening.gap_fill' },
          { name: 'Hội thoại dài', desc: 'Nghe hội thoại dài, trả lời câu hỏi (KET P4/PET P3).', skillId: 'listening.long_convo' },
        ]}
      />
    </div>
  );
}
