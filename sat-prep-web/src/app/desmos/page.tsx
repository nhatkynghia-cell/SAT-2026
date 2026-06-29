'use client';

import { useState, useRef } from 'react';
import { CorePracticeUI, PracticeQuestion } from '@/components/CorePracticeUI';
import { useToast } from '@/context/ToastContext';

export default function DesmosPage() {
  const { showToast } = useToast();
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Câu đã prefetch cho lượt kế (2.2) — giữ promise (có thể in-flight) + topic.
  const prefetchedRef = useRef<{ topic: string; promise: Promise<PracticeQuestion | null> } | null>(null);

  const categories = [
    { name: "Hệ Phương Trình Bậc Nhất", desc: "Sử dụng Desmos tìm giao điểm hai đường thẳng." },
    { name: "Parabola & Điểm Đỉnh", desc: "Tìm min/max, vertex bằng đồ thị cực nhanh." },
    { name: "Bẫy Hằng Số K", desc: "Sử dụng thanh trượt (slider) k để biện luận số nghiệm." }
  ];

  // Fetch thuần — chỉ trả data, không đụng state. Dùng chung load + prefetch.
  const fetchQuestion = async (topic: string): Promise<PracticeQuestion | null> => {
    try {
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType: 'desmos', topic })
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
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">🧮</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #c084fc, #a855f7)", WebkitBackgroundClip: "text" }}>BÍ KÍP HACK DESMOS</h1>
            <p className="math-subtitle text-purple-200">Kỹ năng sử dụng máy tính bỏ túi đồ thị đỉnh cao!</p>
          </div>
        </div>
      </div>
      
      {!currentTopic ? (
        <>
          <div className="bg-[#1b2533] border border-[#a855f7] rounded-xl p-6 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
            <h2 className="text-2xl font-bold text-[#c084fc] mb-4">Lựa Chọn Chủ Đề Desmos</h2>
            <p className="text-[#e2e8f0] mb-6">Nhấn vào chủ đề bên dưới để thi triển nhãn thuật đồ thị phá giải các câu Toán khó nhất:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((cat, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleGenerateQuestion(cat.name)}
                  className="bg-[#0e1117] border border-[#262730] p-6 rounded-xl hover:border-[#a855f7] hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] cursor-pointer transition-all group"
                >
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#c084fc]">{cat.name}</h3>
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
              <h2 className="text-xl font-bold text-[#c084fc]">{currentTopic}</h2>
            </div>
            <button 
              onClick={() => { setCurrentTopic(null); setQuestionData(null); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              ⬅️ Quay lại danh mục
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
            <div className="bg-[#1b2533] p-2 rounded-xl border border-[#4c1d95] shadow-lg flex flex-col h-[600px]">
              <div className="text-white font-bold px-2 py-2 mb-2 flex items-center justify-between border-b border-[#334155]">
                <span>Màn Hình Máy Tính Desmos</span>
                <span className="text-xs bg-[#4c1d95] px-2 py-1 rounded text-[#e2e8f0]">Công cụ</span>
              </div>
              <iframe 
                src="https://www.desmos.com/calculator?lang=vi" 
                className="w-full flex-1 rounded-lg border-0 bg-white"
                title="Desmos Graphing Calculator"
              ></iframe>
            </div>

            <div className="flex flex-col h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {(isLoading || questionData) && (
                <CorePracticeUI
                  questionData={questionData as PracticeQuestion}
                  isLoading={isLoading}
                  onNext={() => handleGenerateQuestion(currentTopic)}
                  onSubmitted={() => prefetchNext(currentTopic)}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
