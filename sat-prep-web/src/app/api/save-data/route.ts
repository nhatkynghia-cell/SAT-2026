import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { getUserDataPath } from '@/lib/user-data';
import { saveProgressRaw } from '@/lib/progress-store';
import fs from 'fs';

const SECRET_KEY: string = (() => {
  const s = process.env.SAT_PREP_SECRET;
  if (!s) {
    throw new Error(
      'SAT_PREP_SECRET chưa được set. Bắt buộc cấu hình biến môi trường này (không còn fallback mặc định yếu).'
    );
  }
  return s;
})();

// Hàm sắp xếp key của Object (để đảm bảo JSON stringify luôn ra cùng 1 chuỗi)
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result: { [key: string]: unknown } = {};
  for (const key of sortedKeys) {
    result[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return result;
}

function generateSignature(data: Record<string, unknown>): string {
  const dataCopy = { ...data };
  delete dataCopy.signature; // Bỏ field signature khi tính toán

  const sortedData = sortKeys(dataCopy);
  const dataStr = JSON.stringify(sortedData);

  return crypto.createHmac('sha256', SECRET_KEY).update(dataStr, 'utf-8').digest('hex');
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const data = await req.json();

    // ⚠️ LƯU Ý ANTI-CHEAT (implementation_plan.md §9.1, task #2):
    // Chữ ký HMAC dưới đây CHỈ chống sửa file tay, KHÔNG xác thực tính hợp lệ
    // của số liệu client gửi lên. Việc chuyển kinh tế sang server-authoritative
    // được theo dõi ở task #2. Ở đây chỉ thêm scope theo user_id (task #1).
    const signature = generateSignature(data);
    const dataToSave = { ...data, signature };
    // CHUỖI JSON đã ký — ghi NGUYÊN chuỗi này (raw string) để HMAC verify khi
    // đọc lại khớp byte-cho-byte (xem progress-store.ts).
    const serialized = JSON.stringify(dataToSave, null, 2);

    // Ưu tiên Supabase (bền vững qua deploy serverless). FAIL-SAFE: bảng chưa
    // có / user không phải uuid / lỗi → false → fallback ghi file như cũ.
    const savedToDb = await saveProgressRaw(user.id, serialized);
    if (!savedToDb) {
      const filePath = getUserDataPath(user.id, 'streak_data.json');
      fs.writeFileSync(filePath, serialized, 'utf-8');
    }

    return NextResponse.json({ success: true, message: "Data saved securely" });
  } catch (error) {
    console.error("Lỗi khi ghi dữ liệu:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}
