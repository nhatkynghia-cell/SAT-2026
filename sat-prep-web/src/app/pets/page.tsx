'use client';
import { useGamification } from '@/context/GamificationContext';

export default function PetsPage() {
  const { level, activePet, equipPet } = useGamification();

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #9d174d 0%, #831843 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📔</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #fbcfe8, #f472b6)", WebkitBackgroundClip: "text" }}>THƯ VIỆN QUÁI THÚ</h1>
            <p className="math-subtitle text-pink-200">Sưu tầm và nâng cấp Linh Thú đồng hành cùng bạn!</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { id: "pet_1", name: "Cú Thông Thái", icon: "🦉", buff: "+10% XP khi học Reading", unlockLevel: 1 },
          { id: "pet_2", name: "Sói Cô Độc", icon: "🐺", buff: "+20% sát thương PvP", unlockLevel: 3 },
          { id: "pet_3", name: "Rồng Lửa", icon: "🐉", buff: "+50% Vàng nhận được", unlockLevel: 6 }
        ].map((pet, idx) => {
          const isLocked = level < pet.unlockLevel;
          const isActive = activePet === pet.id || (activePet === null && idx === 0 && !isLocked); // Default to first if none equipped
          
          return (
            <div key={idx} className={`bg-[#1b2533] p-6 rounded-xl border flex flex-col items-center text-center relative ${isLocked ? 'border-[#334155] opacity-50 grayscale' : isActive ? 'border-[#f472b6] shadow-[0_0_15px_rgba(244,114,182,0.3)]' : 'border-[#334155]'}`}>
              {!isLocked && isActive && <div className="absolute top-2 right-2 bg-[#f472b6] text-white text-xs px-2 py-1 rounded-full font-bold">Đang trang bị</div>}
              {isLocked && <div className="absolute top-2 right-2 bg-[#475569] text-white text-xs px-2 py-1 rounded-full font-bold">Mở ở LV {pet.unlockLevel}</div>}
              <div className="text-6xl mb-4 mt-4">{isLocked ? '🔒' : pet.icon}</div>
              <h3 className="text-xl font-bold text-white mb-1">{isLocked ? 'Chưa mở khóa' : pet.name}</h3>
              <div className="text-sm text-[#f472b6] font-bold mb-4">{!isLocked && `Level ${Math.floor(level / pet.unlockLevel)}`}</div>
              <p className="text-gray-400 text-sm mb-6 h-10">{isLocked ? 'Cần đạt cấp độ cao hơn để mở khóa linh thú này.' : pet.buff}</p>
              <button 
                disabled={isLocked || isActive} 
                onClick={() => equipPet(pet.id)}
                className={`w-full py-2 rounded font-bold transition-colors ${isLocked ? 'bg-[#1e293b] text-gray-500 cursor-not-allowed' : isActive ? 'bg-[#334155] text-white cursor-default' : 'bg-[#1e293b] hover:bg-[#f472b6] text-white hover:text-white'}`}>
                {isLocked ? 'Đã Khóa' : isActive ? 'Đang theo sau' : 'Trang bị'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
