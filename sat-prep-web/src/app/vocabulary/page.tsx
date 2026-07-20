'use client';

import { useState, useRef } from 'react';
import { CorePracticeUI, PracticeQuestion } from '@/components/CorePracticeUI';
import { useToast } from '@/context/ToastContext';

export default function VocabularyPage() {
  const { showToast } = useToast();
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Câu đã prefetch cho lượt kế (2.2) — giữ promise (có thể in-flight) + topic.
  const prefetchedRef = useRef<{ topic: string; promise: Promise<PracticeQuestion | null> } | null>(null);

  const categories = [
    { name: "Vocabulary in Context (KET)", desc: "Điền từ vựng A2 vào chỗ trống phù hợp ngữ cảnh câu." },
    { name: "Synonyms & Antonyms (KET/PET)", desc: "Phân biệt từ đồng nghĩa / trái nghĩa A2–B1." },
    { name: "Phrasal Verbs (PET)", desc: "Các cụm động từ B1 thường gặp trong PET." }
  ];

  // Fetch thuần — chỉ trả data, không đụng state. Dùng chung load + prefetch.
  const fetchQuestion = async (topic: string): Promise<PracticeQuestion | null> => {
    try {
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType: 'vocab', topic })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // Prefetch sau submit (user đang đọc giải thích) → cost-safe, guard chống gọi 2 lần.
  const prefetchNext = (topic: string) => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = { topic, promise: fetchQuestion(topic) };
  };

  const handleGenerateQuestion = async (topic: string) => {
    setCurrentTopic(topic);
    setIsLoading(true);
    setQuestionData(null);

    const prefetched = prefetchedRef.current;
    prefetchedRef.current = null;
    const data = prefetched && prefetched.topic === topic
      ? await prefetched.promise
      : await fetchQuestion(topic);

    if (data) {
      setQuestionData(data);
    } else {
      showToast("Lỗi khi sinh câu hỏi. Vui lòng thử lại.", 'error');
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #0f766e 0%, #042f2e 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📚</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #2dd4bf, #14b8a6)", WebkitBackgroundClip: "text" }}>LUYỆN TỪ VỰNG KET/PET</h1>
            <p className="math-subtitle text-teal-200">Luyện điền từ và phân biệt từ vựng Cambridge A2–B1.</p>
          </div>
        </div>
      </div>
      
      {!currentTopic ? (
        <>
          <div className="bg-[#1b2533] border border-[#14b8a6] rounded-xl p-6 shadow-[0_0_15px_rgba(20,184,166,0.1)]">
            <h2 className="text-2xl font-bold text-[#2dd4bf] mb-4">Lựa Chọn Chủ Đề Từ Vựng</h2>
            <p className="text-[#e2e8f0] mb-6">Luyện tập khả năng phán đoán từ vựng dựa trên ngữ cảnh với câu hỏi động Cambridge:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((cat, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleGenerateQuestion(cat.name)}
                  className="bg-[#0e1117] border border-[#262730] p-6 rounded-xl hover:border-[#14b8a6] hover:shadow-[0_0_15px_rgba(20,184,166,0.2)] cursor-pointer transition-all group"
                >
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#2dd4bf]">{cat.name}</h3>
                  <p className="text-gray-400 text-sm">{cat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
            <div>
              <span className="text-gray-400 text-sm">Chủ đề hiện tại:</span>
              <h2 className="text-xl font-bold text-[#2dd4bf]">{currentTopic}</h2>
            </div>
            <button 
              onClick={() => { setCurrentTopic(null); setQuestionData(null); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              ⬅️ Quay lại danh mục
            </button>
          </div>
          
          {(isLoading || questionData) && (
            <CorePracticeUI
              questionData={questionData as PracticeQuestion}
              isLoading={isLoading}
              onNext={() => handleGenerateQuestion(currentTopic)}
              onSubmitted={() => prefetchNext(currentTopic)}
            />
          )}
        </>
      )}
    </div>
  );
}
