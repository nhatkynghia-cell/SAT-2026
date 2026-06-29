'use client';

export function UnderConstruction({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-center px-4">
      <div className="text-[100px] mb-6 opacity-80">🚧</div>
      <h1 className="text-3xl font-bold text-[#fbbf24] mb-4">Tính năng đang được rèn đúc!</h1>
      <p className="text-gray-400 text-lg max-w-[600px] leading-relaxed">
        Chiến binh thân mến, khu vực <b>{title}</b> hiện đang được các pháp sư code ngày đêm để đưa lên phiên bản Next.js. Hãy quay lại sau nhé!
      </p>
    </div>
  );
}
