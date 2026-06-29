'use client';
import { useGamification } from '@/context/GamificationContext';

export default function JourneyPage() {
  const { level } = useGamification();

  const STEPS = [
    { title: "Giai Đoạn 1: Tân Sinh Nhập Môn", desc: "Nắm vững ngữ pháp cơ bản và các phép toán nền tảng.", reqLevel: 1 },
    { title: "Giai Đoạn 2: Trui Rèn Kỹ Năng", desc: "Học chiến thuật xử lý các dạng bài khó, luyện đọc lướt.", reqLevel: 10 },
    { title: "Giai Đoạn 3: Vượt Vũ Môn", desc: "Thi thử full-length liên tục, tối ưu hóa thời gian.", reqLevel: 30 },
    { title: "Giai Đoạn 4: Đăng Quang", desc: "Đạt 1500+ thực tế, vinh danh trên bảng vàng.", reqLevel: 60 }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #064e3b 0%, #022c22 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">🗺️</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #6ee7b7, #10b981)", WebkitBackgroundClip: "text" }}>HÀNH TRÌNH CHINH PHỤC</h1>
            <p className="math-subtitle text-emerald-200">Lộ trình rèn luyện sát thủ phòng thi từng bước một!</p>
          </div>
        </div>
      </div>
      
      <div className="relative border-l-4 border-[#10b981] ml-6 space-y-12 pb-12">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < STEPS.length - 1 && level >= STEPS[idx + 1].reqLevel;
          const isCurrent = level >= step.reqLevel && !isCompleted;
          const isLocked = level < step.reqLevel;

          return (
            <div key={idx} className="relative pl-8">
              <div className={`absolute -left-[14px] top-0 w-6 h-6 rounded-full border-4 border-[#0e1117] ${isCompleted ? 'bg-[#10b981]' : isCurrent ? 'bg-[#fbbf24] animate-pulse' : 'bg-[#334155]'}`}></div>
              <div className={`bg-[#1b2533] p-6 rounded-xl border ${isCompleted ? 'border-[#10b981]' : isCurrent ? 'border-[#fbbf24]' : 'border-[#334155] opacity-50'}`}>
                <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400">{step.desc}</p>
                {isLocked && <div className="mt-4 text-sm text-red-400 font-bold">Cần đạt Level {step.reqLevel} để mở khóa</div>}
                {isCurrent && <div className="mt-4 text-sm text-[#fbbf24] font-bold">Bạn đang ở giai đoạn này! Cố lên!</div>}
                {isCompleted && <div className="mt-4 text-sm text-[#10b981] font-bold">Đã hoàn thành!</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
