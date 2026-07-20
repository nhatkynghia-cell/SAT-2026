'use client';

import { ProductivePractice } from '@/components/ProductivePractice';

export default function WritingPage() {
  return (
    <ProductivePractice
      moduleType="writing"
      title="VIẾT (WRITING)"
      subtitle="Luyện viết Cambridge KET (A2) / PET (B1) — AI chấm theo rubric."
      icon="✍️"
      gradientFrom="#713f12"
      gradientTo="#1c1207"
      accent="#fbbf24"
      targetLevel="A2"
      tasks={[
        { name: 'Tin nhắn ngắn (KET P6)', prompt: 'Viết một tin nhắn/email ngắn (25–35 từ) cho bạn để rủ bạn đi xem phim cuối tuần. Nói rõ ngày, giờ và địa điểm.', skillId: 'writing.short_message', hint: 'Viết đủ 3 ý được yêu cầu, dùng câu đơn giản.' },
        { name: 'Truyện theo tranh (KET P7)', prompt: 'Viết một câu chuyện ngắn (khoảng 35 từ) về một ngày em bị lỡ chuyến xe buýt đến trường.', skillId: 'writing.story_pictures', hint: 'Dùng thì quá khứ đơn.' },
        { name: 'Email 100 từ (PET P1)', prompt: 'Bạn của em ở nước ngoài muốn biết về trường của em. Viết một email khoảng 100 từ mô tả trường và môn học em thích.', skillId: 'writing.email_100', hint: 'Mở đầu và kết thúc email lịch sự.' },
        { name: 'Bài viết / truyện (PET P2)', prompt: 'Viết một bài khoảng 100 từ về chủ đề: "Hoạt động ngoài trời em thích nhất và vì sao".', skillId: 'writing.article_or_story', hint: 'Nêu lý do cụ thể, dùng từ nối.' },
      ]}
    />
  );
}
