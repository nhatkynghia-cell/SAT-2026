/**
 * LoadingState — trạng thái "đang tải" DÙNG CHUNG (task 3.2).
 *
 * Trước đây pattern spinner ⚙️ + text trắng đậm trong card tối được COPY gần
 * y hệt ở ~5 chỗ (math, CorePracticeUI, skill-tree, AITutoring...), chỉ khác
 * dòng chữ. Gom về đây để chuẩn hóa (điểm code-duplication plan §2 đã chỉ ra).
 *
 * CHỈ trích phần LẶP THẬT (card spinner). KHÔNG làm <ErrorState/> chung vì lỗi
 * dị nhau (toast là chuẩn de-facto qua useToast, 1 chỗ error-box, còn lại im
 * lặng/đọc context) — ép 1 component sẽ thêm props cấu hình vô nghĩa.
 *
 * Màn hình loading full-screen của gate-exam (phase-based, nền riêng) KHÔNG
 * dùng component này — nó là pattern khác hẳn.
 */
export function LoadingState({ message = 'Đang tải...' }: { message?: string }) {
  return (
    <div className="my-6 p-12 flex flex-col items-center justify-center bg-[#1b2533] rounded-xl border border-[#262730]">
      <div className="text-4xl animate-spin mb-4">⚙️</div>
      <div className="text-white font-bold text-center">{message}</div>
    </div>
  );
}
