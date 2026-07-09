/**
 * EmptyState — trạng thái "trống / chưa có dữ liệu / sắp ra mắt" DÙNG CHUNG.
 *
 * Cùng tinh thần với LoadingState: gom hai khối bị COPY gần y hệt qua nhiều
 * trang game — card "🚧 sắp ra mắt" (available:false) và card "Chưa có ai..."
 * (danh sách rỗng) — chỉ khác icon/chữ. Trước đây leaderboard, SpeedQuizLeaderboard
 * và quests mỗi nơi tự viết inline với class lệch nhau (gray-400 vs gray-500,
 * p-12 vs không) → nhìn không đồng bộ.
 *
 * - có icon + title  → biến thể GIÀU (icon lớn + tiêu đề + mô tả).
 * - chỉ có message   → biến thể GỌN (một dòng chữ căn giữa trong card).
 *
 * Lỗi (fetch fail) KHÔNG dùng component này — toast qua useToast vẫn là chuẩn
 * de-facto (xem ghi chú trong LoadingState.tsx). Empty ≠ Error: empty là "không
 * có gì để hiện", error là "gọi hỏng"; gộp sẽ che mất khác biệt cho người dùng.
 */
export function EmptyState({
  icon,
  title,
  message,
}: {
  icon?: string;
  title?: string;
  message: string;
}) {
  return (
    <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-12 text-center">
      {icon && <div className="text-5xl mb-4">{icon}</div>}
      {title && <h2 className="text-xl font-bold text-white mb-2">{title}</h2>}
      <p className="text-gray-400">{message}</p>
    </div>
  );
}
