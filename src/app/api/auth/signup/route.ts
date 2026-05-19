import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createSession, hashPassword } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(50),
  heightCm: z.number().min(50).max(280),
  weightKg: z.number().min(20).max(400),
  age: z.number().int().min(5).max(120),
  gender: z.enum(['male', 'female', 'other']).default('other'),
  activityLevel: z
    .enum(['sedentary', 'light', 'moderate', 'active', 'very_active'])
    .default('light'),
  dailyDeficit: z.number().int().min(0).max(1500).default(500),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값이 유효하지 않습니다.', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) {
      return NextResponse.json({ error: '이미 가입된 이메일입니다.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        name: parsed.data.name,
        heightCm: parsed.data.heightCm,
        weightKg: parsed.data.weightKg,
        age: parsed.data.age,
        gender: parsed.data.gender,
        activityLevel: parsed.data.activityLevel,
        dailyDeficit: parsed.data.dailyDeficit,
      },
    });

    await createSession({ userId: user.id, email: user.email });
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error('[signup]', e);
    return NextResponse.json({ error: '회원가입 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
