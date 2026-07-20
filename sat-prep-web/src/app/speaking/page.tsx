'use client';

import { ProductivePractice } from '@/components/ProductivePractice';

export default function SpeakingPage() {
  return (
    <ProductivePractice
      moduleType="speaking"
      title="NÓI (SPEAKING)"
      subtitle="Luyện nói Cambridge KET (A2) / PET (B1) — AI chấm nội dung."
      icon="🗣️"
      gradientFrom="#4c1d95"
      gradientTo="#1e1035"
      accent="#c084fc"
      targetLevel="A2"
      speech
      tasks={[
        { name: 'Phỏng vấn cá nhân (KET P1)', prompt: 'Trả lời: "What is your name and where do you live? Tell me about your family."', skillId: 'speaking.interview', hint: 'Nói 3-4 câu, đủ ý về tên, nơi ở và gia đình.' },
        { name: 'Thảo luận theo tranh (KET P2)', prompt: 'Em và bạn đang lên kế hoạch cho một buổi dã ngoại. Nói về những thứ cần mang theo và lý do.', skillId: 'speaking.collaborative', hint: 'Đưa ra ít nhất 2 gợi ý.' },
        { name: 'Mô tả ảnh (PET P2)', prompt: 'Mô tả một bức ảnh về một gia đình đang ăn tối cùng nhau (khoảng 5-6 câu).', skillId: 'speaking.long_turn', hint: 'Nói về người, nơi chốn và hoạt động.' },
        { name: 'Thảo luận mở rộng (PET P4)', prompt: 'Nói về chủ đề: "Học sinh nên dùng điện thoại ở trường không? Vì sao?"', skillId: 'speaking.discussion', hint: 'Nêu quan điểm và ít nhất 1 lý do.' },
      ]}
    />
  );
}
