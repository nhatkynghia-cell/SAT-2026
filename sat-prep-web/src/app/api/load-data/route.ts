import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { getUserDataPath } from '@/lib/user-data';
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
function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result: { [key: string]: any } = {};
  for (const key of sortedKeys) {
    result[key] = sortKeys(obj[key]);
  }
  return result;
}

function generateSignature(data: any): string {
  const dataCopy = { ...data };
  delete dataCopy.signature; // Bỏ field signature khi tính toán
  const sortedData = sortKeys(dataCopy);
  const dataStr = JSON.stringify(sortedData);
  return crypto.createHmac('sha256', SECRET_KEY).update(dataStr, 'utf-8').digest('hex');
}

const DEFAULT_STATE = {
  user_stats: { level: 1, xp: 0, coins: 100, streak: 0, shield: 0 },
  inventory: [],
  practice_question: { current_id: null, history: [], wrong_answers: [] },
  quests: {
    daily: [
      { id: "q1", name: "Khởi động ngày mới", desc: "Làm đúng 5 câu hỏi", target: 5, progress: 0, claimed: false, xp: 50, coins: 10 },
      { id: "q2", name: "Chúa tể ngôn từ", desc: "Học 10 từ vựng mới", target: 10, progress: 0, claimed: false, xp: 100, coins: 20 },
      { id: "q3", name: "Kẻ hủy diệt Practice Test", desc: "Hoàn thành 1 bài thi thử", target: 1, progress: 0, claimed: false, xp: 500, coins: 100 }
    ],
    weekly: [],
    monthly: []
  }
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    const filePath = getUserDataPath(user.id, 'streak_data.json');

    if (!fs.existsSync(filePath)) {
      // Người dùng mới (hoặc chưa có dữ liệu) → state mặc định.
      return NextResponse.json(DEFAULT_STATE);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsedData = JSON.parse(fileContent);

    // Kiểm tra tính toàn vẹn (HMAC-SHA256)
    if (!parsedData.signature) {
      console.warn(`Dữ liệu user ${user.id} không có chữ ký bảo mật. Reset!`);
      return NextResponse.json(DEFAULT_STATE);
    }

    const expectedSignature = generateSignature(parsedData);
    if (expectedSignature !== parsedData.signature) {
      console.warn(`🚨 PHÁT HIỆN GIAN LẬN! Chữ ký HMAC của user ${user.id} không khớp. Reset dữ liệu.`);
      return NextResponse.json(DEFAULT_STATE);
    }

    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("Lỗi khi load dữ liệu:", error);
    // Nếu file bị lỗi format (corrupted), reset về mặc định
    return NextResponse.json(DEFAULT_STATE);
  }
}
