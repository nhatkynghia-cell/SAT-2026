'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';

export interface ProductiveTask {
  name: string;
  prompt: string;
  skillId: string;
  hint?: string;
}

interface RubricResult {
  band: string;
  scores: { task: number; vocabulary: number; grammar: number; coherence: number };
  corrections: Array<{ original: string; fixed: string; note_vi: string }>;
  feedback_vi: string;
}

interface ProductivePracticeProps {
  moduleType: 'writing' | 'speaking';
  title: string;
  subtitle: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  accent: string;
  targetLevel: 'A2' | 'B1';
  tasks: ProductiveTask[];
  /** true → dùng Web Speech API thu âm → transcript (Speaking); false → ô nhập text (Writing). */
  speech?: boolean;
}

/**
 * Trang luyện kỹ năng SẢN XUẤT (Writing/Speaking) Cambridge KET/PET. Học sinh
 * viết bài (hoặc nói → transcript) → POST /api/grade-writing → hiển thị band
 * CEFR + 4 tiêu chí + sửa lỗi + nhận xét tiếng Việt. Chấm 100% server (AI-judge).
 */
export function ProductivePractice({
  moduleType,
  title,
  subtitle,
  icon,
  gradientFrom,
  gradientTo,
  accent,
  targetLevel,
  tasks,
  speech,
}: ProductivePracticeProps) {
  const { showToast } = useToast();
  const [current, setCurrent] = useState<ProductiveTask | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<RubricResult | null>(null);
  const [grading, setGrading] = useState(false);

  const submit = async () => {
    if (!current || text.trim().length < 3) {
      showToast('Hãy viết bài dài hơn một chút nhé.', 'error');
      return;
    }
    setGrading(true);
    setResult(null);
    try {
      const res = await fetch('/api/grade-writing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType, skillId: current.skillId, taskPrompt: current.prompt, answer: text, targetLevel }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else showToast(data.error || 'Lỗi khi chấm bài.', 'error');
    } catch (e) {
      console.error(e);
      showToast('Lỗi kết nối máy chủ.', 'error');
    }
    setGrading(false);
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

      {speech && (
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-3 text-sm text-amber-200">
          🗣️ Giai đoạn hiện tại: hãy <b>gõ lại câu trả lời nói</b> của em vào ô bên dưới (hoặc dùng nút ghi âm của trình duyệt nếu có). AI sẽ chấm nội dung, từ vựng và ngữ pháp.
        </div>
      )}

      {!current ? (
        <div className="bg-[#1b2533] border rounded-xl p-6" style={{ borderColor: accent }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: accent }}>Chọn dạng bài luyện</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map((t) => (
              <div
                key={t.skillId}
                onClick={() => { setCurrent(t); setText(''); setResult(null); }}
                className="bg-[#0e1117] border border-[#262730] p-5 rounded-xl hover:border-white cursor-pointer transition-all"
              >
                <h3 className="text-lg font-bold text-white mb-1">{t.name}</h3>
                <p className="text-gray-400 text-sm">{t.prompt}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
            <div>
              <span className="text-gray-400 text-sm">Đề bài:</span>
              <h2 className="text-lg font-bold" style={{ color: accent }}>{current.name}</h2>
            </div>
            <button onClick={() => { setCurrent(null); setResult(null); }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">⬅️ Quay lại</button>
          </div>

          <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]">
            <p className="text-white font-medium mb-3">{current.prompt}</p>
            {current.hint && <p className="text-gray-400 text-sm mb-3">💡 {current.hint}</p>}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={speech ? 'Gõ lại câu trả lời nói của em bằng tiếng Anh...' : 'Viết bài của em bằng tiếng Anh...'}
              className="w-full bg-[#0e1117] border border-[#334155] rounded-lg px-4 py-3 text-white outline-none focus:border-white resize-y"
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-gray-500">{text.trim() ? text.trim().split(/\s+/).length : 0} từ</span>
              <button
                onClick={submit}
                disabled={grading}
                className="px-6 py-2.5 rounded-lg font-bold text-white disabled:opacity-50"
                style={{ background: accent }}
              >
                {grading ? 'Đang chấm...' : '✅ Nộp bài & chấm'}
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-[#0f172a] p-6 rounded-xl border border-[#334155] space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-black" style={{ color: accent }}>{result.band}</div>
                <div className="flex gap-4 text-sm text-gray-300">
                  <span>Bám đề: <b>{result.scores.task}/5</b></span>
                  <span>Từ vựng: <b>{result.scores.vocabulary}/5</b></span>
                  <span>Ngữ pháp: <b>{result.scores.grammar}/5</b></span>
                  <span>Mạch lạc: <b>{result.scores.coherence}/5</b></span>
                </div>
              </div>
              <p className="text-gray-200 leading-relaxed">{result.feedback_vi}</p>
              {result.corrections.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-amber-400 font-bold text-sm">🔍 Sửa lỗi tiêu biểu:</h4>
                  {result.corrections.map((c, i) => (
                    <div key={i} className="bg-[#1b2533] p-3 rounded-lg border border-[#334155] text-sm">
                      <div className="text-red-300 line-through">{c.original}</div>
                      <div className="text-emerald-300">{c.fixed}</div>
                      <div className="text-gray-400 text-xs mt-1">{c.note_vi}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
