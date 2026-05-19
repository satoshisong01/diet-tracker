import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isValidDateKey, parseDateKey } from '@/lib/date';
import { calcBmr, calcTdee } from '@/lib/calorie';
import { generateDietTip } from '@/lib/ai';

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateKey = searchParams.get('date');
  if (!dateKey || !isValidDateKey(dateKey)) {
    return NextResponse.json({ error: 'date 쿼리 필요' }, { status: 400 });
  }
  const date = parseDateKey(dateKey);

  const [foods, exercises] = await Promise.all([
    prisma.foodEntry.findMany({ where: { userId: user.id, date } }),
    prisma.exerciseEntry.findMany({ where: { userId: user.id, date } }),
  ]);
  const intake = foods.reduce((s, f) => s + f.calories * f.quantity, 0);
  const burn = exercises.reduce((s, e) => s + e.caloriesBurned, 0);
  const bmr = calcBmr({
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    gender: user.gender,
  });
  const tdee = calcTdee(bmr, user.activityLevel);

  try {
    const tip = await generateDietTip({
      weightKg: user.weightKg,
      heightCm: user.heightCm,
      age: user.age,
      netCalories: Math.round(intake - burn - bmr),
      goalCalories: Math.max(0, tdee - user.dailyDeficit),
    });
    return NextResponse.json(tip);
  } catch (e) {
    console.error('[tip]', e);
    return NextResponse.json({ tip: '오늘도 꾸준한 기록이 변화를 만듭니다. 충분한 수분 섭취도 잊지 마세요!' });
  }
}
