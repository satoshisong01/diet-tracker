import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { calcBmr, calcTdee } from '@/lib/calorie';
import { toLocalDateKey, parseDateKey } from '@/lib/date';
import { generateWeeklyReport } from '@/lib/ai';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 최근 7일 (오늘 포함) 키 목록
  const today = new Date();
  const dateKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dateKeys.push(toLocalDateKey(d));
  }
  const from = parseDateKey(dateKeys[0]);
  const toExclusive = new Date(parseDateKey(dateKeys[6]).getTime() + 24 * 60 * 60 * 1000);

  const [foods, exercises, weights] = await Promise.all([
    prisma.foodEntry.findMany({
      where: { userId: user.id, date: { gte: from, lt: toExclusive } },
      select: { date: true, calories: true, quantity: true },
    }),
    prisma.exerciseEntry.findMany({
      where: { userId: user.id, date: { gte: from, lt: toExclusive } },
      select: { date: true, caloriesBurned: true },
    }),
    prisma.weightLog.findMany({
      where: { userId: user.id, date: { gte: from, lt: toExclusive } },
      orderBy: { date: 'asc' },
      select: { date: true, weightKg: true },
    }),
  ]);

  const byDay = new Map<string, { intake: number; exerciseBurn: number }>();
  for (const k of dateKeys) byDay.set(k, { intake: 0, exerciseBurn: 0 });
  for (const f of foods) {
    const k = toLocalDateKey(f.date);
    const cur = byDay.get(k);
    if (cur) cur.intake += f.calories * f.quantity;
  }
  for (const e of exercises) {
    const k = toLocalDateKey(e.date);
    const cur = byDay.get(k);
    if (cur) cur.exerciseBurn += e.caloriesBurned;
  }
  const weekDays = dateKeys.map((k) => ({
    date: k,
    intake: Math.round(byDay.get(k)?.intake ?? 0),
    exerciseBurn: Math.round(byDay.get(k)?.exerciseBurn ?? 0),
  }));

  const bmr = calcBmr({
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    gender: user.gender,
  });
  const tdee = calcTdee(bmr, user.activityLevel);

  try {
    const report = await generateWeeklyReport({
      weightKg: user.weightKg,
      heightCm: user.heightCm,
      age: user.age,
      tdee,
      dailyDeficit: user.dailyDeficit,
      targetWeightKg: user.targetWeightKg,
      weekDays,
      actualWeights: weights.map((w) => ({
        date: toLocalDateKey(w.date),
        weightKg: w.weightKg,
      })),
    });
    return NextResponse.json({ report, weekDays });
  } catch (e) {
    console.error('[report/weekly]', e);
    return NextResponse.json(
      { error: '주간 리포트 생성 실패. 잠시 후 다시 시도하세요.' },
      { status: 502 },
    );
  }
}
