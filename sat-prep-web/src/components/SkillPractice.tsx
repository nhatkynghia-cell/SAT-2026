'use client';

import { useState, useRef } from 'react';
import { CorePracticeUI, PracticeQuestion } from '@/components/CorePracticeUI';
import { useToast } from '@/context/ToastContext';

/** Một chủ đề luyện trong 1 kỹ năng (deep-link generate-practice theo skillId). */
export interface SkillTopic {
  name: string;
  desc: string;
  skillId: string;
}

interface SkillPracticeProps {
  moduleType: string;
  title: string;
  subtitle: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  accent: string;
  topics: SkillTopic[];
}

/**
 * Trang luyện 1 kỹ năng Cambridge KET/PET (Reading/Writing/Listening/Speaking/
 * Grammar). Chọn chủ đề → POST /api/generate-practice {moduleType, topic, skillId}
 * → CorePracticeUI (chấm qua /api/grade, server-authoritative). Tái dùng cho cả
 * 6 trang kỹ năng để không lặp code (thay các trang SAT cũ).
 */
export function SkillPractice({
  moduleType,
  title,
  subtitle,
  icon,
  gradientFrom,
  gradientTo,
  accent,
  topics,
}: SkillPracticeProps) {
  const { showToast } = useToast();
  const [current, setCurrent] = useState<SkillTopic | null>(null);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const prefetchedRef = useRef<{ skillId: string; promise: Promise<PracticeQuestion | null> } | null>(null);

  const fetchQuestion = async (topic: SkillTopic): Promise<PracticeQuestion | null> => {
    try {
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType, topic: topic.name, skillId: topic.skillId }),
      });
      if (res.ok) return await res.json();
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const prefetchNext = (topic: SkillTopic) => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = { skillId: topic.skillId, promise: fetchQuestion(topic) };
  };

  const handleSelect = async (topic: SkillTopic) => {
    setCurrent(topic);
    setIsLoading(true);
    setQuestionData(null);

    const prefetched = prefetchedRef.current;
    prefetchedRef.current = null;
    const data = prefetched && prefetched.skillId === topic.skillId
      ? await prefetched.promise
      : await fetchQuestion(topic);

    if (data) setQuestionData(data);
    else showToast('Lỗi khi sinh câu hỏi. Vui lòng thử lại.', 'error');
    setIsLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)` }}>
        <div className="math-title-container">
          <div className="math-icon">{icon}</div>
          <div>
            <h1 className="math-title" style={{ background: `linear-gradient(to right, ${accent}, ${accent})`, WebkitBackgroundClip: 'text' }}>{title}</h1>
            <p className="math-subtitle text-gray-200">{subtitle}</p>
          </div>
        </div>
      </div>

      {!current ? (
        <div className="bg-[#1b2533] border rounded-xl p-6" style={{ borderColor: accent }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: accent }}>Chọn dạng bài luyện</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topics.map((t) => (
              <div
                key={t.skillId}
                onClick={() => handleSelect(t)}
                className="bg-[#0e1117] border border-[#262730] p-5 rounded-xl hover:border-white cursor-pointer transition-all group"
              >
                <h3 className="text-lg font-bold text-white mb-1 group-hover:opacity-90">{t.name}</h3>
                <p className="text-gray-400 text-sm">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
            <div>
              <span className="text-gray-400 text-sm">Đang luyện:</span>
              <h2 className="text-xl font-bold" style={{ color: accent }}>{current.name}</h2>
            </div>
            <button
              onClick={() => { setCurrent(null); setQuestionData(null); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              ⬅️ Quay lại danh mục
            </button>
          </div>

          {(isLoading || questionData) && (
            <CorePracticeUI
              questionData={questionData as PracticeQuestion}
              isLoading={isLoading}
              onNext={() => handleSelect(current)}
              onSubmitted={() => prefetchNext(current)}
            />
          )}
        </>
      )}
    </div>
  );
}
