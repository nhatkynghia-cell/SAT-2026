'use client';

import { useState, useRef } from 'react';
import { CorePracticeUI, PracticeQuestion } from '@/components/CorePracticeUI';
import { useToast } from '@/context/ToastContext';

export default function LiteraturePage() {
  const { showToast } = useToast();
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Sinh câu THẤT BẠI → panel thử lại thay vì vùng bài trống (chỉ toast thoáng qua).
  const [loadError, setLoadError] = useState(false);
  // Câu đã prefetch cho lượt kế (2.2) — giữ promise (có thể in-flight) + topic.
  const prefetchedRef = useRef<{ topic: string; promise: Promise<PracticeQuestion | null> } | null>(null);

  const categories = [
    { name: "Thơ Cổ (Poetry)", desc: "Phân tích nhịp điệu và cảm xúc trong thơ cổ." },
    { name: "Văn Học Thế Kỷ 18-19", desc: "Đọc hiểu tiểu thuyết cổ điển, văn phong phức tạp." },
    { name: "Tuyên Ngôn Lịch Sử", desc: "Các bài diễn văn, tài liệu lập quốc của Mỹ." },
    { name: "Triết Học Tự Nhiên", desc: "Bài báo khoa học thời kỳ khai sáng." }
  ];

  // Fetch thuần — chỉ trả data, không đụng state. Dùng chung load + prefetch.
  const fetchQuestion = async (topic: string): Promise<PracticeQuestion | null> => {
    try {
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType: 'literature', topic })
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
    setLoadError(false);

    const prefetched = prefetchedRef.current;
    prefetchedRef.current = null;
    const data = prefetched && prefetched.topic === topic
      ? await prefetched.promise
      : await fetchQuestion(topic);

    if (data) {
      setQuestionData(data);
    } else {
      setLoadError(true);
      showToast("Lỗi khi sinh câu hỏi. Vui lòng thử lại.", 'error');
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #78350f 0%, #451a03 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📜</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #fcd34d, #fbbf24)", WebkitBackgroundClip: "text" }}>GIẢI MÃ VĂN HỌC CỔ</h1>
            <p className="math-subtitle text-amber-200">Rèn luyện kỹ năng đọc hiểu văn bản cổ với AI Giáo sư</p>
          </div>
        </div>
      </div>
      
      {!currentTopic ? (
        <>
          <div className="bg-[#1b2533] border border-[#f59e0b] rounded-xl p-6 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
            <h2 className="text-2xl font-bold text-[#fbbf24] mb-4">Chọn Chuyên Đề Khổ Luyện</h2>
            <p className="text-[#e2e8f0] mb-6">Bạn đã sẵn sàng đối mặt với tiếng Anh thế kỷ 18 chưa? Chọn một chủ đề bên dưới để hệ thống AI sinh câu hỏi động (Dynamic Generated) cho bạn nhé!</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((cat, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleGenerateQuestion(cat.name)}
                  className="bg-[#0e1117] border border-[#262730] p-6 rounded-xl hover:border-[#fbbf24] hover:shadow-[0_0_15px_rgba(251,191,36,0.2)] cursor-pointer transition-all group"
                >
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#fbbf24]">{cat.name}</h3>
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
              <h2 className="text-xl font-bold text-[#fbbf24]">{currentTopic}</h2>
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

          {loadError && !isLoading && !questionData && (
            <div className="bg-[#1b2533] p-8 rounded-xl border border-red-500/40 flex flex-col items-center text-center">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-white mb-1">Không sinh được câu hỏi</h3>
              <p className="text-gray-400 text-sm mb-4">Gia sư AI tạm thời chưa phản hồi. Kiểm tra kết nối rồi thử lại.</p>
              <button
                onClick={() => handleGenerateQuestion(currentTopic)}
                className="text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-2 rounded-lg hover:opacity-90"
              >
                🔄 Thử lại
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
