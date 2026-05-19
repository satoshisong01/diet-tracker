import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isValidDateKey, parseDateKey } from '@/lib/date';
import { calcBmr, calcTdee } from '@/lib/calorie';
import { dailyEnergyBalance, kcalToGrams } from '@/lib/weight';

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateKey = searchParams.get('date');
  if (!dateKey || !isValidDateKey(dateKey)) {
    return NextResponse.json({ error: 'date(YYYY-MM-DD) 필요' }, { status: 400 });
  }
  const date = parseDateKey(dateKey);

  const [foods, exercises] = await Promise.all([
    prisma.foodEntry.findMany({ where: { userId: user.id, date }, orderBy: { createdAt: 'asc' } }),
    prisma.exerciseEntry.findMany({
      where: { userId: user.id, date },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const intake = Math.round(foods.reduce((s, f) => s + f.calories * f.quantity, 0));
  const exerciseBurn = Math.round(exercises.reduce((s, e) => s + e.caloriesBurned, 0));

  const bmr = calcBmr({
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    gender: user.gender,
  });
  const tdee = calcTdee(bmr, user.activityLevel);

  // Two net calculations: with BMR (full daily expenditure) and without (exercise only)
  const totalBurnWithBmr = exerciseBurn + bmr;
  const netWithBmr = intake - totalBurnWithBmr; // negative = deficit
  const netWithoutBmr = intake - exerciseBurn;

  // 예상 체중 변화 (TDEE 기준 에너지 균형)
  const energyBalance = dailyEnergyBalance({ intake, exerciseBurn, tdee });
  const predictedGrams = kcalToGrams(energyBalance); // +면 감량, -면 증가

  return NextResponse.json({
    date: dateKey,
    intake,
    exerciseBurn,
    bmr,
    tdee,
    totalBurnWithBmr,
    netWithBmr,
    netWithoutBmr,
    energyBalance, // TDEE + 운동 − 섭취 (+면 적자)
    predictedGrams, // +면 감량 예상 그램
    foodCount: foods.length,
    exerciseCount: exercises.length,
  });
}
