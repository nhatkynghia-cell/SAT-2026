/**
 * Hàm chuẩn hóa chuỗi dữ liệu (đặc biệt là LaTeX) do AI trả về.
 * OpenAI GPT thường trả về công thức Toán học dùng `\[ ... \]` và `\( ... \)`.
 * Thư viện `react-markdown` (kết hợp `remark-math`) lại yêu cầu `$$ ... $$` và `$ ... $`.
 */
export function cleanAiText(text: string): string {
  if (!text) return "";
  
  // Xóa các khoảng trắng/xuống dòng thừa ở hai đầu
  let cleaned = text.trim();

  // Chuẩn hóa Inline Math: \( ... \) -> $ ... $
  // Lưu ý regex dùng flag /g để thay thế toàn bộ, xử lý cả string chứa escape backslash
  cleaned = cleaned.replace(/\\\((.*?)\\\)/g, '$$$1$$');
  // Nếu AI trả về 1 backslash (đã bị parse JSON thành ký tự trần)
  cleaned = cleaned.replace(/\(\s*(.*?)\s*\)/g, (match) => {
    // Chỉ thay thế nếu bên trong nhìn giống công thức toán học (chứa số, biến, hoặc ký hiệu)
    // Cách an toàn hơn là thay chính xác \ ( và \ )
    return match; // Bỏ qua regex lỏng lẻo này, dùng regex cứng ở dưới
  });

  // Thay thế cứng (Hard Replace) cho chắc chắn:
  cleaned = cleaned.split('\\(').join('$');
  cleaned = cleaned.split('\\)').join('$');

  // Chuẩn hóa Block Math: \[ ... \] -> $$ ... $$
  cleaned = cleaned.split('\\[').join('$$');
  cleaned = cleaned.split('\\]').join('$$');
  
  return cleaned;
}
