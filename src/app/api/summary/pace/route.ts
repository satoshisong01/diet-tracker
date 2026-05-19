import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { calcBmr, calcTdee } from '@/lib/calorie';
import { toLocalDateKey } from '@/lib/date';

// 최근 7일 평균 에너지 균형 (kcal/일) — WeightPanel의 페이스 예측용.
// 음식이 기록된 날만 평균에 반영 (기록 안 한 날을 0kcal로 카운트하면 왜곡됨).
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const [foods, exercises] = await Promise.all([
    prisma.foodEntry.findMany({
      where: { userId: user.id, date: { gte: weekAgo } },
      select: { date: true, calories: true, quantity: true },
    }),
    prisma.exerciseEntry.findMany({
      where: { userId: user.id, date: { gte: weekAgo } },
      select: { date: true, caloriesBurned: true },
    }),
  ]);

  const bmr = calcBmr({
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    gender: user.gender,
  });
  const tdee = calcTdee(bmr, user.activityLevel);

  const intakeByDay = new Map<string, number>();
  for (const f of foods) {
    const k = toLocalDateKey(f.date);
    intakeByDay.set(k, (intakeByDay.get(k) ?? 0) + f.calories * f.quantity);
  }
  const burnByDay = new Map<string, number>();
  for (const e of exercises) {
    const k = toLocalDateKey(e.date);
    burnByDay.set(k, (burnByDay.get(k) ?? 0) + e.caloriesBurned);
  }
  const allDays = new Set([...intakeByDay.keys(), ...burnByDay.keys()]);
  const balances: number[] = [];
  for (const k of allDays) {
    const intake = intakeByDay.get(k) ?? 0;
    if (intake === 0) continue;
    const burn = burnByDay.get(k) ?? 0;
    balances.push(tdee + burn - intake);
  }
  const avgKcalBalancePerDay =
    balances.length > 0
      ? Math.round(balances.reduce((a, b) => a + b, 0) / balances.length)
      : 0;

  return NextResponse.json({ avgKcalBalancePerDay, daysLogged: balances.length, tdee, bmr });
}
