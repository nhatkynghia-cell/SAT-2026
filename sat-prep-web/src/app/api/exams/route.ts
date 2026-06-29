import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const EXAMS_FILE = path.join(DATA_DIR, 'mock_exams.json');

export async function GET() {
  try {
    if (!fs.existsSync(EXAMS_FILE)) {
      return NextResponse.json({ exams: [] });
    }
    const fileContent = fs.readFileSync(EXAMS_FILE, 'utf-8');
    const data = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Lỗi khi load danh sách đề thi:", error);
    return NextResponse.json({ error: "Failed to load exams" }, { status: 500 });
  }
}
