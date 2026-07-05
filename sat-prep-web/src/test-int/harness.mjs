/**
 * Tiện ích chung cho integration test money-path: build Request JSON + đọc
 * Response JSON, re-export điều khiển fake-db để test seed/asserts gọn.
 */
export { resetDb, setCurrentUser, disableRpc, seed, getRows, markMissingColumns } from './fake-db.mjs';

/** Tạo POST Request với body JSON (route đọc qua req.json()). */
export function postJson(body) {
  return new Request('http://t/local', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Đọc { status, body } từ Response mà handler trả về. */
export async function readRes(res) {
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}
