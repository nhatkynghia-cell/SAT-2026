/**
 * Batch Question Generator for Full-Length Digital SAT Exams.
 *
 * Sinh song song câu hỏi cho từng module bằng internal fetch tới /api/generate-practice.
 * Pattern giống gate-exam/route.ts nhưng scale lên 22–27 câu/module.
 */

import { SKILL_TREE, type Skill } from './skill-taxonomy';
import type { AdaptivePath } from './exam-scoring';

export interface ExamQuestion {
  id: string;
  full_passage?: string;
  practice_question: string;
  choices: string[];
  correct_choice: string;
  explanation?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  skillId?: string;
}

export interface GeneratedModule {
  name: string;
  timeMinutes: number;
  questions: ExamQuestion[];
  section: 'rw' | 'math';
  moduleNum: 1 | 2;
}

type Difficulty = 'Easy' | 'Medium' | 'Hard';

/**
 * Difficulty distribution chuẩn Digital SAT.
 * Module 1: mix cân bằng để đo năng lực.
 * Module 2 Hard: thiên khó (trần 800).
 * Module 2 Easy: thiên dễ (trần 650).
 */
const DIFFICULTY_MIX: Record<string, Record<Difficulty, number>> = {
  rw_m1:      { Easy: 8,  Medium: 11, Hard: 8 },
  rw_m2_hard: { Easy: 3,  Medium: 9,  Hard: 15 },
  rw_m2_easy: { Easy: 12, Medium: 11, Hard: 4 },
  math_m1:      { Easy: 6,  Medium: 9,  Hard: 7 },
  math_m2_hard: { Easy: 2,  Medium: 7,  Hard: 13 },
  math_m2_easy: { Easy: 10, Medium: 8,  Hard: 4 },
};

function getDifficultyList(section: 'rw' | 'math', moduleNum: 1 | 2, path?: AdaptivePath): Difficulty[] {
  let key: string;
  if (moduleNum === 1) {
    key = `${section}_m1`;
  } else {
    key = `${section}_m2_${path ?? 'hard'}`;
  }
  const mix = DIFFICULTY_MIX[key];
  const list: Difficulty[] = [];
  for (const [diff, count] of Object.entries(mix)) {
    for (let i = 0; i < count; i++) list.push(diff as Difficulty);
  }
  // Xáo trộn để không theo thứ tự dễ→khó cố định
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function getSkillsForSection(section: 'rw' | 'math'): Skill[] {
  const subject = section === 'rw' ? 'reading' : 'math';
  return SKILL_TREE
    .filter(d => d.subject === subject)
    .flatMap(d => d.skills);
}

/**
 * Sinh 1 module đầy đủ câu hỏi (song song).
 * @param origin - URL origin của server (e.g. http://localhost:3000)
 * @param cookie - cookie header để pass auth
 */
export async function generateModule(
  section: 'rw' | 'math',
  moduleNum: 1 | 2,
  origin: string,
  cookie: string,
  adaptivePath?: AdaptivePath
): Promise<GeneratedModule> {
  const totalQuestions = section === 'rw' ? 27 : 22;
  const timeMinutes = section === 'rw' ? 32 : 35;
  const moduleName = section === 'rw'
    ? `Reading & Writing (Module ${moduleNum})`
    : `Math (Module ${moduleNum})`;

  const difficulties = getDifficultyList(section, moduleNum, adaptivePath);
  const skills = getSkillsForSection(section);

  const promises = difficulties.slice(0, totalQuestions).map((difficulty, idx) => {
    const skill = skills[idx % skills.length];
    return generateOneQuestion(origin, cookie, skill, difficulty, idx);
  });

  const results = await Promise.allSettled(promises);
  const questions: ExamQuestion[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      questions.push(result.value);
    }
  }

  return {
    name: moduleName,
    timeMinutes,
    questions,
    section,
    moduleNum,
  };
}

async function generateOneQuestion(
  origin: string,
  cookie: string,
  skill: Skill,
  difficulty: Difficulty,
  index: number
): Promise<ExamQuestion | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(`${origin}/api/generate-practice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({
        moduleType: skill.moduleType,
        topic: skill.label,
        skillId: skill.id,
        difficulty,
        prefer: 'auto',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    return {
      id: `exam_q_${index}_${Date.now().toString(36)}`,
      full_passage: data.full_passage || data.theory || '',
      practice_question: data.practice_question,
      choices: data.choices,
      correct_choice: data.correct_choice,
      explanation: data.explanation,
      difficulty,
      skillId: skill.id,
    };
  } catch {
    return null;
  }
}
