import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { estimateExerciseCaloriesAi } from '@/lib/ai';
import { estimateExerciseCalories } from '@/lib/calorie';

const schema = z.object({
  activity: z.string().min(1).max(100),
  durationMin: z.number().int().min(1).max(1440),
  intensity: z.enum(['light', 'moderate', 'vigorous']).default('moderate'),
  useAi: z.boolean().default(true),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '입력값 오류' }, { status: 400 });

  if (parsed.data.useAi) {
    try {
      const r = await estimateExerciseCaloriesAi({
        activity: parsed.data.activity,
        durationMin: parsed.data.durationMin,
        intensity: parsed.data.intensity,
        weightKg: user.weightKg,
      });
      return NextResponse.json({
        estimate: {
          activity: r.activity,
          caloriesBurned: r.caloriesBurned,
          reasoning: r.reasoning,
          source: 'ai',
        },
      });
    } catch (e) {
      console.error('[exercises/estimate AI fallback]', e);
    }
  }

  const burn = estimateExerciseCalories({
    activity: parsed.data.activity,
    durationMin: parsed.data.durationMin,
    intensity: parsed.data.intensity,
    weightKg: user.weightKg,
  });
  return NextResponse.json({
    estimate: {
      activity: parsed.data.activity,
      caloriesBurned: burn,
      reasoning: 'MET 표 기반 추정',
      source: 'met',
    },
  });
}
