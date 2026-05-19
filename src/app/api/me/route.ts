import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { calcBmr, calcTdee } from '@/lib/calorie';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bmr = calcBmr({
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    gender: user.gender,
  });
  const tdee = calcTdee(bmr, user.activityLevel);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      heightCm: user.heightCm,
      weightKg: user.weightKg,
      age: user.age,
      gender: user.gender,
      activityLevel: user.activityLevel,
      includeBmr: user.includeBmr,
      dailyDeficit: user.dailyDeficit,
      targetWeightKg: user.targetWeightKg,
    },
    bmr,
    tdee,
  });
}

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  heightCm: z.number().min(50).max(280).optional(),
  weightKg: z.number().min(20).max(400).optional(),
  age: z.number().int().min(5).max(120).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  activityLevel: z
    .enum(['sedentary', 'light', 'moderate', 'active', 'very_active'])
    .optional(),
  includeBmr: z.boolean().optional(),
  dailyDeficit: z.number().int().min(0).max(1500).optional(),
  targetWeightKg: z.number().min(20).max(400).nullable().optional(),
});

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값을 확인하세요.', details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
  });

  // log weight change if provided
  if (parsed.data.weightKg && parsed.data.weightKg !== user.weightKg) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.weightLog.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      create: { userId: user.id, date: today, weightKg: parsed.data.weightKg },
      update: { weightKg: parsed.data.weightKg },
    });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      heightCm: updated.heightCm,
      weightKg: updated.weightKg,
      age: updated.age,
      gender: updated.gender,
      activityLevel: updated.activityLevel,
      includeBmr: updated.includeBmr,
      dailyDeficit: updated.dailyDeficit,
      targetWeightKg: updated.targetWeightKg,
    },
  });
}
