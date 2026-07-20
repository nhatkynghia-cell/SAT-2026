'use client';

import { SkillPractice } from '@/components/SkillPractice';

export default function GrammarPage() {
  return (
    <SkillPractice
      moduleType="grammar"
      title="NGỮ PHÁP (GRAMMAR)"
      subtitle="Luyện ngữ pháp nền tảng A2 / B1 cho KET & PET."
      icon="📐"
      gradientFrom="#7c2d12"
      gradientTo="#1c0a04"
      accent="#fb923c"
      topics={[
        { name: 'Ngữ pháp A2', desc: 'Thì cơ bản, so sánh, modal, giới từ (KET).', skillId: 'grammar.a2' },
        { name: 'Ngữ pháp B1', desc: 'Hiện tại hoàn thành, điều kiện, bị động, mệnh đề quan hệ (PET).', skillId: 'grammar.b1' },
      ]}
    />
  );
}
