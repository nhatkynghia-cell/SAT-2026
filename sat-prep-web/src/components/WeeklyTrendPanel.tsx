'use client';

/**
 * WEEKLY TREND PANEL — mini-chart xu hướng điểm 7 ngày (dùng chung).
 * Dùng ở /dashboard (học sinh, tự fetch /api/progress/weekly) và trong
 * ParentReport (phụ huynh, nhận trend qua props từ /api/parent/report).
 */

export interface WeeklyTrend {
  latestTotal: number | null;
  weekAgoTotal: number | null;
  scoreDelta: number;
  attemptsThisWeek: number;
  series: Array<{ date: string; total: number }>;
  activeDays: number;
}

export function WeeklyTrendPanel({ trend }: { trend: WeeklyTrend }) {
  const series = trend.series;
  const trendW = 280;
  const trendH = 80;

  const trendPath = (() => {
    if (series.length < 2) return '';
    const min = Math.min(...series.map((s) => s.total));
    const max = Math.max(...series.map((s) => s.total));
    const range = max - min || 1;
    return series
      .map((s, i) => {
        const x = (i / (series.length - 1)) * trendW;
        const y = trendH - ((s.total - min) / range) * (trendH - 10) - 5;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  })();

  return (
    <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-white">📊 Xu hướng 7 ngày</h3>
        {trend.latestTotal !== null && (
          <span className={`text-sm font-bold ${trend.scoreDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.scoreDelta >= 0 ? '⬆️ +' : '⬇️ '}{trend.scoreDelta} điểm
          </span>
        )}
      </div>
      {series.length >= 2 ? (
        <>
          <svg width={trendW} height={trendH} className="w-full">
            <path d={trendPath} fill="none" stroke="#34d399" strokeWidth="2" />
            {series.map((s, i) => {
              const x = (i / (series.length - 1)) * trendW;
              const min = Math.min(...series.map((p) => p.total));
              const max = Math.max(...series.map((p) => p.total));
              const range = max - min || 1;
              const y = trendH - ((s.total - min) / range) * (trendH - 10) - 5;
              return <circle key={i} cx={x} cy={y} r="3" fill="#34d399" />;
            })}
          </svg>
          <p className="text-xs text-gray-400 mt-1">{trend.activeDays} ngày hoạt động · {trend.attemptsThisWeek} câu luyện tuần này</p>
        </>
      ) : (
        <p className="text-gray-500 text-sm">Cần ít nhất 2 ngày học để hiện xu hướng. Hãy luyện đều mỗi ngày!</p>
      )}
    </div>
  );
}
