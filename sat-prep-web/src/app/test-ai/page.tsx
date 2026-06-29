'use client';

import { useState } from 'react';

export default function TestAIPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setResult('');

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: 'You are a helpful SAT tutor. Explain concepts clearly and concisely.',
          userPrompt: question || 'Please explain what the Pythagorean theorem is.',
          expectJson: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Có lỗi xảy ra.');
        if (data.code === 'QUOTA_EXCEEDED') {
          // Xử lý logic hiển thị popup nâng cấp Premium ở đây
        }
      } else {
        setResult(data.data);
        setUsage(data.usage);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Test AI Proxy & Quota</h1>
      <p className="text-slate-600">
        Nhập nội dung bất kỳ để kiểm tra xem API gọi ChatGPT có hoạt động không và theo dõi số lượt miễn phí.
      </p>

      <div className="space-y-2">
        <label className="font-semibold text-slate-700">Câu hỏi của bạn (hoặc để trống để test mặc định):</label>
        <textarea
          className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ví dụ: Định lý Pytago là gì?"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Đang gọi AI...' : 'Tạo bằng AI'}
      </button>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg">
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      {usage && (
        <div className="p-4 bg-green-100 text-green-800 border border-green-300 rounded-lg flex justify-between items-center">
          <span>Lượt gọi thành công!</span>
          <span className="font-bold">Đã dùng: {usage.used} / {usage.limit}</span>
        </div>
      )}

      {result && (
        <div className="p-4 bg-slate-50 border rounded-lg whitespace-pre-wrap text-slate-800">
          {result}
        </div>
      )}
    </div>
  );
}
