import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { monthRange, toDateKey } from '@/lib/date';
import { calcBmr } from '@/lib/calorie';

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year, month 쿼리 필요' }, { status: 400 });
  }
  const { start, end } = monthRange(year, month);

  const [foods, exercises] = await Promise.all([
    prisma.foodEntry.findMany({
      where: { userId: user.id, date: { gte: start, lt: end } },
      select: { date: true, calories: true, quantity: true },
    }),
    prisma.exerciseEntry.findMany({
      where: { userId: user.id, date: { gte: start, lt: end } },
      select: { date: true, caloriesBurned: true },
    }),
  ]);

  const bmr = calcBmr({
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    gender: user.gender,
  });

  const byDay = new Map<
    string,
    { intake: number; burn: number }
  >();

  for (const f of foods) {
    const key = toDateKey(f.date);
    const cur = byDay.get(key) ?? { intake: 0, burn: 0 };
    cur.intake += f.calories * f.quantity;
    byDay.set(key, cur);
  }
  for (const e of exercises) {
    const key = toDateKey(e.date);
    const cur = byDay.get(key) ?? { intake: 0, burn: 0 };
    cur.burn += e.caloriesBurned;
    byDay.set(key, cur);
  }

  const days = Array.from(byDay.entries()).map(([date, v]) => ({
    date,
    intake: Math.round(v.intake),
    exerciseBurn: Math.round(v.burn),
    netWithBmr: Math.round(v.intake - (v.burn + bmr)),
    netWithoutBmr: Math.round(v.intake - v.burn),
  }));

  return NextResponse.json({ year, month, bmr, days });
}
