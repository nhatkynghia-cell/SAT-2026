'use client';

import { useState, useEffect, useRef } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { SKILL_TREE } from '@/lib/skill-taxonomy';

// 4 domain Toán + skill con, lấy thẳng từ skill-taxonomy (single source of truth).
// Mỗi skill con map đúng 1 skillId → mastery phủ đủ 13 skill Toán (nền cho Skill Tree).
const MATH_DOMAINS = SKILL_TREE.filter((d) => d.subject === 'math');

interface MathLesson {
  concept_name: string;
  theory: string;
  sample_example: string;
  practice_question: string;
  choices: string[];
  correct_choice: string;
  explanation: string;
  difficulty: string;
  trapRate: number;
  /** skillId từ skill-taxonomy (task #9) — optional, do API gắn kèm. */
  skillId?: string;
  /** Phân tích từng đáp án (Nhóm 7 #9) — optional: câu cũ trong bank chưa có. */
  choice_analysis?: { choice_letter: string; is_correct: boolean; analysis: string }[];
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export default function MathPage() {
  const { userStats, inventory, spendCoins, handlePracticeAnswer } = useGamification();
  const { showToast } = useToast();
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [currentSkillId, setCurrentSkillId] = useState<string | null>(null);
  const [lessonData, setLessonData] = useState<MathLesson | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Boss / Gamification States
  const [isBossEncounter, setIsBossEncounter] = useState(false);
  const [bossHp, setBossHp] = useState(100);
  const [playerHearts, setPlayerHearts] = useState(3);
  const [activeSkills, setActiveSkills] = useState<{desmos: boolean, focus: boolean}>({desmos: false, focus: false});
  
  // Practice States
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Chat States
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Câu đã prefetch sẵn cho lượt kế (2.2). Giữ promise (có thể đang in-flight)
  // + topic để chỉ dùng khi khớp chủ đề và không gọi OpenAI lần 2.
  const prefetchedRef = useRef<{ topic: string; promise: Promise<MathLesson | null> } | null>(null);

  const hasItem = (itemId: string) => inventory.some(i => (typeof i === 'string' ? i === itemId : (i as { itemId?: string }).itemId === itemId));
  const removeConsumable = (_itemId: string) => {
    // Note: Simulated usage.
  };

  // Fetch thuần — chỉ trả data, không đụng React state. Dùng chung cho cả load
  // trực tiếp lẫn prefetch (2.2). skillId tường minh giúp ghi mastery đúng skill con.
  const fetchLesson = async (topic: string, skillId?: string): Promise<MathLesson | null> => {
    try {
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType: 'math', topic, skillId })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // Prefetch câu kế khi user vừa submit (đang đọc giải thích / chat) → bấm "Tải
  // bài tiếp theo" hiện ngay. Chỉ chạy SAU submit nên không phí token: gần như
  // chắc chắn user sẽ qua câu kế. Guard tránh gọi OpenAI lần 2 nếu đã có sẵn.
  const prefetchNext = (topic: string, skillId?: string) => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = { topic, promise: fetchLesson(topic, skillId) };
  };

  const handleGenerateLesson = async (topic: string, skillId?: string) => {
    setCurrentTopic(topic);
    if (skillId !== undefined) setCurrentSkillId(skillId);
    const effectiveSkillId = skillId ?? currentSkillId ?? undefined;
    setIsLoading(true);
    setLessonData(null);
    setIsSubmitted(false);
    setSelectedAnswer(null);
    setChatHistory([]);
    setActiveSkills({desmos: false, focus: false});

    // 15% chance of Boss Encounter. Math.random ở đây nằm trong event handler
    // (gọi từ onClick/skip), KHÔNG phải thân render → an toàn, không bất định.
    // eslint-disable-next-line react-hooks/purity
    const isBoss = Math.random() < 0.15;
    setIsBossEncounter(isBoss);
    if (isBoss) {
      setBossHp(userStats.level * 50 + 100);
      setPlayerHearts(3);
    }

    // Dùng câu đã prefetch nếu khớp topic → hiện ngay, khỏi chờ sinh mới.
    const prefetched = prefetchedRef.current;
    prefetchedRef.current = null;
    const data = prefetched && prefetched.topic === topic
      ? await prefetched.promise
      : await fetchLesson(topic, effectiveSkillId);

    if (data) {
      setLessonData(data);
    } else {
      showToast("Lỗi khi sinh bài giảng. Vui lòng thử lại.", 'error');
    }
    setIsLoading(false);
  };

  const handleSubmit = () => {
    if (!selectedAnswer || !lessonData) return;
    setIsSubmitted(true);

    const isAnsCorrect = selectedAnswer.trim()[0].toUpperCase() === lessonData.correct_choice.trim()[0].toUpperCase();
    setIsCorrect(isAnsCorrect);

    // Ghi nhận kết quả vào Mastery (task #9) — chỉ khi câu có skillId.
    // Fire-and-forget: không chặn UI, lỗi chỉ log.
    if (lessonData.skillId) {
      fetch("/api/mastery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: lessonData.skillId,
          isCorrect: isAnsCorrect,
          difficulty: lessonData.difficulty,
        })
      }).catch((e) => console.error("Failed to record mastery", e));
    }

    if (isBossEncounter) {
      if (isAnsCorrect) {
        // Calculate damage
        let damage = Math.floor(userStats.maxPower * 0.5);
        if (activeSkills.focus) {
          damage *= 2;
          showToast("💥 ĐÒN ĐÁNH CHÍ MẠNG! Nhân đôi sát thương!", 'info');
        }
        const newHp = Math.max(0, bossHp - damage);
        setBossHp(newHp);
        if (newHp === 0) {
          // Hạ boss = câu khó → thưởng theo độ khó 'Hard' (server quyết số xu/XP).
          void handlePracticeAnswer(true, 'Hard');
        }
      } else {
        // Lose heart
        setPlayerHearts(prev => prev - 1);
      }
    } else {
      void handlePracticeAnswer(isAnsCorrect, lessonData.difficulty);
    }

    // Prefetch câu kế ngay khi submit (user đang đọc giải thích) → "Tải bài
    // tiếp theo" hiện tức thì.
    if (currentTopic) prefetchNext(currentTopic, currentSkillId ?? undefined);
  };

  const handleUseHeal = () => {
    if (hasItem("sinh_menh_dan")) {
      removeConsumable("sinh_menh_dan");
      setPlayerHearts(prev => Math.min(3, prev + 1));
      showToast("💊 Đã sử dụng Sinh Mệnh Đan! (+1 ❤️)", 'success');
    } else if (spendCoins(100)) {
      setPlayerHearts(prev => Math.min(3, prev + 1));
      showToast("💸 Đã mua và sử dụng Sinh Mệnh Đan! (-100 Xu, +1 ❤️)", 'success');
    } else {
      showToast("❌ Không đủ Xu để mua Sinh Mệnh Đan!", 'error');
    }
  };

  const handleUseSkip = () => {
    if (hasItem("ve_skip_cau")) {
      removeConsumable("ve_skip_cau");
      showToast("🎫 Đã sử dụng Vé Skip! Bạn đã vượt qua câu hỏi này một cách an toàn.", 'success');
      handleGenerateLesson(currentTopic!);
    } else if (spendCoins(150)) {
      showToast("💸 Đã mua và sử dụng Vé Skip! (-150 Xu)", 'success');
      handleGenerateLesson(currentTopic!);
    } else {
      showToast("❌ Không đủ Xu để mua Vé Skip!", 'error');
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !lessonData) return;
    
    const newMessage: ChatMessage = { role: 'user', text: chatInput };
    const newHistory = [...chatHistory, newMessage];
    setChatHistory(newHistory);
    setChatInput("");
    setIsChatting(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: lessonData.practice_question,
          correctAnswer: lessonData.correct_choice,
          selectedAnswer: selectedAnswer,
          explanation: lessonData.explanation,
          history: chatHistory,
          userMessage: chatInput
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatHistory([...newHistory, { role: 'ai', text: data.reply }]);
      } else {
        const errorData = await res.json();
        setChatHistory([...newHistory, { role: 'ai', text: `⚠️ Lỗi: ${errorData.error || "Không thể kết nối"}` }]);
      }
    } catch (e) {
      console.error(e);
      setChatHistory([...newHistory, { role: 'ai', text: "⚠️ Lỗi kết nối máy chủ." }]);
    }
    setIsChatting(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const renderChoices = () => {
    let choicesToShow = lessonData!.choices;
    
    // Skill: Nhãn Thuật Desmos removes one wrong answer
    if (activeSkills.desmos && !isSubmitted) {
      const correctPrefix = lessonData!.correct_choice.trim()[0].toUpperCase();
      const wrongIndices = choicesToShow.map((c, i) => c.trim()[0].toUpperCase() !== correctPrefix ? i : -1).filter(i => i !== -1);
      if (wrongIndices.length > 0) {
        const newChoices = [...choicesToShow];
        newChoices[wrongIndices[0]] = "❌ [Bị triệt tiêu bởi Nhãn Thuật]";
        choicesToShow = newChoices;
      }
    }

    return choicesToShow.map((choice, idx) => {
      const isSelected = selectedAnswer === choice;
      const isEliminated = choice.includes("[Bị triệt tiêu");
      
      let choiceClass = "bg-[#1b2533] border-[#334155] text-[#e2e8f0]";
      if (isEliminated) choiceClass = "bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed opacity-50";
      else if (isSubmitted) {
        const isThisChoiceCorrect = choice.trim()[0].toUpperCase() === lessonData!.correct_choice.trim()[0].toUpperCase();
        if (isThisChoiceCorrect) choiceClass = "bg-[#064e3b] border-[#10b981] text-[#34d399]";
        else if (isSelected) choiceClass = "bg-[#7f1d1d] border-[#ef4444] text-[#fca5a5]";
      } else if (isSelected) {
        choiceClass = "bg-[#1e3a8a] border-[#3b82f6] text-white";
      }

      return (
        <div 
          key={idx} 
          onClick={() => !isSubmitted && !isEliminated && setSelectedAnswer(choice)}
          className={`p-4 rounded-xl border-2 transition-all ${isEliminated ? '' : 'cursor-pointer hover:scale-[1.01]'} ${choiceClass}`}
        >
          {choice}
        </div>
      );
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)", padding: "2rem", borderRadius: "1rem" }}>
        <div className="flex items-center gap-4">
          <div className="text-5xl">📐</div>
          <div>
            <h1 className="text-3xl font-black" style={{ background: "linear-gradient(to right, #60a5fa, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CHINH PHỤC TOÁN HỌC</h1>
            <p className="text-blue-200">Nền tảng tư duy Toán học đỉnh cao — Không gì là không thể!</p>
          </div>
        </div>
      </div>
      
      {!currentTopic ? (
        <div className="bg-[#1b2533] border border-[#3b82f6] rounded-xl p-6 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
          <h2 className="text-2xl font-bold text-[#60a5fa] mb-2">1. Lựa Chọn Chủ Đề Toán Học</h2>
          <p className="text-gray-400 text-sm mb-6">Chọn đúng dạng bài bạn muốn luyện — hệ thống ghi nhận mức thành thạo riêng cho từng kỹ năng.</p>
          <div className="space-y-6">
            {MATH_DOMAINS.map((domain) => (
              <div key={domain.id}>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#3b82f6] rounded-full inline-block" />
                  {domain.label}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {domain.skills.map((skill) => (
                    <div
                      key={skill.id}
                      onClick={() => handleGenerateLesson(skill.label, skill.id)}
                      className="bg-[#0e1117] border border-[#262730] p-4 rounded-xl hover:border-[#3b82f6] hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] cursor-pointer transition-all group"
                    >
                      <h4 className="text-base font-bold text-gray-100 group-hover:text-[#60a5fa]">{skill.label}</h4>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
            <div>
              <span className="text-gray-400 text-sm">Chủ đề hiện tại:</span>
              <h2 className="text-xl font-bold text-[#60a5fa]">{currentTopic}</h2>
            </div>
            <button
              onClick={() => { setCurrentTopic(null); setCurrentSkillId(null); setLessonData(null); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              ⬅️ Quay lại danh mục
            </button>
          </div>

          {isLoading && (
            <div className="my-6 p-12 flex flex-col items-center justify-center bg-[#1b2533] rounded-xl border border-[#262730]">
              <div className="text-4xl animate-spin mb-4">⚙️</div>
              <div className="text-white font-bold">Gia sư AI đang biên soạn bài giảng riêng cho chiến binh...</div>
            </div>
          )}
          
          {lessonData && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                {isBossEncounter ? <span className="text-red-500 animate-pulse">⚔️ [BOSS ĐỘT KÍCH]</span> : <span>✏️</span>} 
                {lessonData.concept_name}
              </h2>

              <details className="bg-[#1e293b] border border-[#334155] rounded-xl group" open>
                <summary className="p-4 font-bold text-[#60a5fa] cursor-pointer list-none flex justify-between">
                  📚 1. LÝ THUYẾT CỐT LÕI
                  <span className="group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-4 border-t border-[#334155] text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {lessonData.theory}
                </div>
              </details>

              <details className="bg-[#1e293b] border border-[#334155] rounded-xl group" open>
                <summary className="p-4 font-bold text-[#fbbf24] cursor-pointer list-none flex justify-between">
                  💡 2. VÍ DỤ MẪU TIÊU BIỂU
                  <span className="group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-4 border-t border-[#334155] text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {lessonData.sample_example}
                </div>
              </details>

              <details className="bg-[#0f172a] border border-[#1e3a8a] rounded-xl group shadow-[0_0_15px_rgba(30,58,138,0.3)]">
                <summary className="p-4 font-bold text-green-400 cursor-pointer list-none flex justify-between">
                  🧮 GIẢ LẬP MÁY TÍNH DESMOS INTERACTIVE
                  <span className="group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-2 border-t border-[#1e3a8a]">
                  <iframe src="https://www.desmos.com/calculator" width="100%" height="500px" style={{border: 0, borderRadius: '8px'}} />
                </div>
              </details>

              <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">🎯 3. BÀI TẬP THỰC HÀNH TẠI CHỖ (Practice Check)</h3>
                <div className="text-white text-[18px] mb-6 font-bold whitespace-pre-wrap font-serif bg-[#0e1117] p-5 rounded-lg border-l-4 border-[#3b82f6]">
                  {lessonData.practice_question}
                </div>

                {/* Boss Encounter Banner */}
                {isBossEncounter && (
                  <div className="bg-[#450a0a] border border-red-500 p-4 rounded-lg mb-6 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-red-400">👾 ÁC MỘNG TOÁN HỌC</div>
                      <div className="text-sm text-red-200">Sát thương của bạn: {activeSkills.focus ? userStats.maxPower : Math.floor(userStats.maxPower * 0.5)} HP/hit</div>
                      <div className="w-48 h-3 bg-red-900 mt-2 rounded-full overflow-hidden border border-red-700">
                        <div className="bg-red-500 h-full transition-all" style={{width: `${(bossHp / (userStats.level * 50 + 100)) * 100}%`}}></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">❤️ Sinh Mệnh: {Array(playerHearts).fill('❤️').join('')}{Array(3 - playerHearts).fill('🖤').join('')}</div>
                      {playerHearts <= 0 && <div className="text-red-500 font-bold mt-1 text-sm animate-bounce">💀 GAME OVER!</div>}
                    </div>
                  </div>
                )}

                {/* Items & Skills */}
                {!isSubmitted && (
                  <div className="flex flex-wrap gap-3 mb-6">
                    <button onClick={handleUseHeal} className="px-3 py-1 bg-[#064e3b] text-[#34d399] border border-[#10b981] rounded-full text-sm font-bold hover:bg-[#047857]">
                      💊 {hasItem("sinh_menh_dan") ? "Dùng" : "Mua"} Sinh Mệnh Đan (+1 ❤️)
                    </button>
                    <button onClick={handleUseSkip} className="px-3 py-1 bg-[#1e3a8a] text-[#93c5fd] border border-[#3b82f6] rounded-full text-sm font-bold hover:bg-[#1d4ed8]">
                      🎫 {hasItem("ve_skip_cau") ? "Dùng" : "Mua"} Vé Skip Câu
                    </button>
                    <button onClick={() => setActiveSkills(p => ({...p, desmos: true}))} disabled={activeSkills.desmos} className="px-3 py-1 bg-purple-900 text-purple-300 border border-purple-500 rounded-full text-sm font-bold hover:bg-purple-800 disabled:opacity-50">
                      👁️ Nhãn Thuật Desmos (-1 Sai)
                    </button>
                    {isBossEncounter && (
                      <button onClick={() => setActiveSkills(p => ({...p, focus: true}))} disabled={activeSkills.focus} className="px-3 py-1 bg-yellow-900 text-yellow-300 border border-yellow-500 rounded-full text-sm font-bold hover:bg-yellow-800 disabled:opacity-50">
                        🔥 Tập Trung Cao Độ (X2 ST)
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-3 mb-8">
                  {renderChoices()}
                </div>

                {!isSubmitted ? (
                  <button 
                    onClick={handleSubmit}
                    disabled={!selectedAnswer || (isBossEncounter && playerHearts <= 0)}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${selectedAnswer && !(isBossEncounter && playerHearts <= 0) ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
                    🚀 CHỐT ĐÁP ÁN {isBossEncounter && '& TẤN CÔNG BOSS'}
                  </button>
                ) : (
                  <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    {/* Result Banner */}
                    <div className={`p-4 rounded-xl border-2 flex items-center gap-4 ${isCorrect ? 'bg-[#022c22] border-[#10b981] text-[#34d399]' : 'bg-[#450a0a] border-[#ef4444] text-[#fca5a5]'}`}>
                      <div className="text-4xl">{isCorrect ? '🎉' : '❌'}</div>
                      <div>
                        <div className="font-bold text-lg">{isCorrect ? 'CHÍNH XÁC TUYỆT ĐỐI!' : 'SẬP BẪY RỒI CHIẾN BINH!'}</div>
                        {isBossEncounter && isCorrect && bossHp === 0 && <div className="text-yellow-400 font-bold mt-1">Boss đã bị tiêu diệt! Nhận phần thưởng đặc biệt!</div>}
                        {isBossEncounter && !isCorrect && <div className="text-red-400 mt-1">Boss phản công! Bạn mất 1 ❤️.</div>}
                      </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="bg-[#0f172a] p-5 rounded-xl border border-[#334155] shadow-lg">
                      <h4 className="text-[#fbbf24] font-bold mb-3 flex items-center gap-2">🤖 GIA SƯ AI PHÂN TÍCH ĐÁP ÁN:</h4>
                      <div className="text-[15px] text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">{lessonData.explanation}</div>
                    </div>

                    {/* Phân tích TỪNG đáp án (Nhóm 7 #9) — dạy kỹ năng loại trừ bẫy.
                        Khớp đáp án user theo INDEX (không parse chữ cái đầu). */}
                    {Array.isArray(lessonData.choice_analysis) && lessonData.choice_analysis.length > 0 && (
                      <div className="bg-[#0f172a] p-5 rounded-xl border border-[#334155] shadow-lg">
                        <h4 className="text-[#fbbf24] font-bold mb-3 flex items-center gap-2">🔍 VÌ SAO CÁC ĐÁP ÁN KIA SAI?</h4>
                        <div className="space-y-2">
                          {lessonData.choice_analysis.map((ca, idx) => {
                            const isUserPick = lessonData.choices[idx] === selectedAnswer;
                            const rowClass = ca.is_correct
                              ? 'bg-[#064e3b]/40 border-[#10b981]'
                              : isUserPick
                              ? 'bg-[#7f1d1d]/40 border-[#ef4444]'
                              : 'bg-[#1b2533] border-[#334155]';
                            const icon = ca.is_correct ? '✅' : isUserPick ? '❌' : '⚠️';
                            return (
                              <div key={idx} className={`p-3 rounded-lg border ${rowClass}`}>
                                <div className="text-sm text-[#e2e8f0] leading-relaxed">
                                  <span className="font-bold mr-1">{icon} {ca.choice_letter}.</span>
                                  {isUserPick && !ca.is_correct && (
                                    <span className="text-[#fca5a5] font-bold mr-1">(Bạn đã chọn)</span>
                                  )}
                                  {ca.analysis}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button onClick={() => handleGenerateLesson(currentTopic)} className="w-full py-3 bg-[#3b82f6] hover:bg-[#2563eb] rounded-xl font-bold text-white transition-colors">
                      🔄 Tải Bài Giảng Tiếp Theo
                    </button>
                  </div>
                )}
              </div>

              {/* Interactive AI Chat (Cải tiến 5) */}
              {isSubmitted && (
                <div className="bg-[#0e1117] border border-[#262730] rounded-xl overflow-hidden mt-8 shadow-2xl">
                  <div className="bg-[#1e293b] p-4 border-b border-[#334155]">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      💬 Hỏi đáp sâu với Gia sư AI
                    </h3>
                    <p className="text-xs text-gray-400">Không hiểu tại sao câu {selectedAnswer ? selectedAnswer[0] : 'đó'} sai? Hãy hỏi AI ngay!</p>
                  </div>
                  
                  <div className="h-64 overflow-y-auto p-4 space-y-4">
                    {chatHistory.length === 0 && (
                      <div className="text-center text-gray-500 mt-10">Gửi câu hỏi để bắt đầu thảo luận với Gia sư.</div>
                    )}
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-[#3b82f6] text-white rounded-br-none' : 'bg-[#1e293b] text-gray-200 border border-[#334155] rounded-bl-none whitespace-pre-wrap'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isChatting && (
                      <div className="flex justify-start">
                        <div className="bg-[#1e293b] text-gray-400 border border-[#334155] p-3 rounded-lg rounded-bl-none animate-pulse">
                          Gia sư đang suy nghĩ...
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 bg-[#1b2533] border-t border-[#334155] flex gap-2">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      placeholder="Nhập thắc mắc của bạn..."
                      className="flex-1 bg-[#0f172a] border border-[#334155] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#3b82f6]"
                    />
                    <button 
                      onClick={handleSendChat}
                      disabled={isChatting || !chatInput.trim()}
                      className="bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition-colors">
                      Gửi
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
