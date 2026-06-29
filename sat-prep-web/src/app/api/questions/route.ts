import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), '..', '10.SAT_Prep_App - Copy', 'data', 'golden_hour_questions.json');
    const fileContents = fs.readFileSync(dataPath, 'utf8');
    const questions = JSON.parse(fileContents);
    
    // Lấy ngẫu nhiên 1 câu hỏi
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    
    return NextResponse.json(randomQuestion, { status: 200 });
  } catch (error) {
    console.error('Error reading questions:', error);
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 });
  }
}
