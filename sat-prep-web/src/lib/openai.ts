/**
 * ============================================================================
 *  OPENAI ENDPOINT — điểm cấu hình DUY NHẤT cho base URL của OpenAI API.
 * ============================================================================
 *  OpenAI CHẶN truy cập trực tiếp từ một số quốc gia (vd Việt Nam →
 *  `unsupported_country_region_territory`, HTTP 403). Để chạy được từ vùng bị
 *  chặn mà KHÔNG sửa code, đặt biến môi trường `OPENAI_BASE_URL` trỏ tới một
 *  proxy/gateway TƯƠNG THÍCH OpenAI (cùng path `/v1/chat/completions`), vd:
 *    OPENAI_BASE_URL=https://your-proxy.example.com/v1
 *
 *  KHÔNG đặt → mặc định gọi thẳng OpenAI (hành vi cũ, không đổi gì).
 * ============================================================================
 */

/** Base URL của OpenAI (đã bỏ dấu "/" cuối). Mặc định api.openai.com/v1. */
export const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL?.replace(/\/+$/, '') || 'https://api.openai.com/v1';

/** URL đầy đủ cho endpoint chat completions. */
export const OPENAI_CHAT_COMPLETIONS_URL = `${OPENAI_BASE_URL}/chat/completions`;
