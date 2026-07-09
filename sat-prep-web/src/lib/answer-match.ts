/**
 * ============================================================================
 *  ANSWER MATCH (pure) — so khớp đáp án học sinh với đáp án đúng lưu server
 * ============================================================================
 *  🔴 SỬA LỖI CRITICAL (2026-07-09, ROOT A): trước đây MỌI nơi chấm chỉ so KÝ TỰ
 *  ĐẦU: `userAnswer.trim()[0] === correct.trim()[0]`. Đúng cho câu trắc nghiệm CÓ
 *  NHÃN ("A) ...", "B) ..." — client gửi cả chuỗi có nhãn), NHƯNG ngân hàng câu AI
 *  (question_bank.json) lưu correct_choice dạng THÔ KHÔNG nhãn: "x = 2", "(1, 0)",
 *  "49π", "$\\frac{4}{5}$", "tranquility". Khi đó mọi lựa chọn "x = 1/2/3/4" đều
 *  cùng ký tự đầu 'x' → CHỌN SAI VẪN CHẤM ĐÚNG → (1) faucet xu (/api/grade cộng
 *  thưởng theo kết quả), (2) mastery bẩn (recordAnswer bơm sai), (3) điểm thi ảo.
 *  Xác minh dữ liệu thật: 14/24 câu bank ở dạng thô, 10/24 có lựa chọn sai lọt qua.
 *
 *  Cách so ĐÚNG, giữ 0 regression cho câu có nhãn:
 *    • correct_choice có nhãn /^[A-E][).]/ → so KÝ TỰ ĐẦU (như cũ; câu trắc nghiệm
 *      có nhãn, client gửi chuỗi bắt đầu bằng cùng chữ cái).
 *    • còn lại (đáp án thô)                → so KHỚP TOÀN CHUỖI đã chuẩn hoá
 *      (trim + gom khoảng trắng). Học sinh chọn nguyên văn 1 lựa chọn nên so
 *      chuỗi khớp chính xác, không tạo dương-tính-giả (faucet) lẫn âm-tính-giả.
 *  Rỗng ↔ rỗng KHÔNG BAO GIỜ khớp (đóng luôn lỗ answer=""/correct_choice="").
 * ============================================================================
 */

/** Chuẩn hoá: bỏ khoảng trắng đầu/cuối + gom khoảng trắng liên tiếp về 1 dấu cách. */
export function normalizeAnswer(s: string | null | undefined): string {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

/** Đáp án dạng trắc nghiệm CÓ NHÃN: bắt đầu bằng A–E + ')' hoặc '.'. */
const LABELED = /^[A-E][).]/;

/**
 * Chấm 1 đáp án: userAnswer (client gửi, nguyên văn lựa chọn đã chọn) so với
 * correctChoice (đáp án đúng lưu server). Thuần — không I/O, unit-test được.
 */
export function matchesAnswer(
  userAnswer: string | null | undefined,
  correctChoice: string | null | undefined
): boolean {
  const u = normalizeAnswer(userAnswer);
  const c = normalizeAnswer(correctChoice);
  if (!u || !c) return false; // rỗng không bao giờ khớp (chống undefined===undefined)

  // Câu trắc nghiệm CÓ NHÃN → so ký tự đầu (giữ đúng hành vi cũ, 0 regression).
  if (LABELED.test(c)) {
    return u[0].toUpperCase() === c[0].toUpperCase();
  }

  // Đáp án THÔ → so khớp toàn chuỗi đã chuẩn hoá.
  return u === c;
}
