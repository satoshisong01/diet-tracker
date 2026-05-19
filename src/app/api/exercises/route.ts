import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isValidDateKey, parseDateKey } from '@/lib/date';
import { estimateExerciseCalories } from '@/lib/calorie';

const createSchema = z.object({
  date: z.string().refine(isValidDateKey, 'YYYY-MM-DD 형식'),
  activity: z.string().min(1).max(100),
  durationMin: z.number().int().min(1).max(1440),
  intensity: z.enum(['light', 'moderate', 'vigorous']).default('moderate'),
  caloriesBurned: z.number().min(0).max(20000).optional(),
  note: z.string().max(500).optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateKey = searchParams.get('date');
  if (!dateKey || !isValidDateKey(dateKey)) {
    return NextResponse.json({ error: 'date(YYYY-MM-DD) 쿼리 필요' }, { status: 400 });
  }
  const date = parseDateKey(dateKey);
  const entries = await prisma.exerciseEntry.findMany({
    where: { userId: user.id, date },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값 오류', details: parsed.error.flatten() }, { status: 400 });
  }

  const date = parseDateKey(parsed.data.date);
  const caloriesBurned =
    parsed.data.caloriesBurned ??
    estimateExerciseCalories({
      activity: parsed.data.activity,
      durationMin: parsed.data.durationMin,
      intensity: parsed.data.intensity,
      weightKg: user.weightKg,
    });

  const entry = await prisma.exerciseEntry.create({
    data: {
      userId: user.id,
      date,
      activity: parsed.data.activity,
      durationMin: parsed.data.durationMin,
      intensity: parsed.data.intensity,
      caloriesBurned,
      note: parsed.data.note,
    },
  });
  return NextResponse.json({ entry });
}
