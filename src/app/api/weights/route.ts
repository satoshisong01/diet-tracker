import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isValidDateKey, parseDateKey, toLocalDateKey } from '@/lib/date';

const createSchema = z.object({
  date: z.string().optional(),
  weightKg: z.number().min(20).max(400),
  setAsCurrent: z.boolean().default(true),
});

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') || 90), 365);

  const logs = await prisma.weightLog.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    take: limit,
  });
  return NextResponse.json({ logs });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '입력값 오류', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dateKey = parsed.data.date && isValidDateKey(parsed.data.date)
    ? parsed.data.date
    : toLocalDateKey(new Date());
  const date = parseDateKey(dateKey);

  const log = await prisma.weightLog.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, weightKg: parsed.data.weightKg },
    update: { weightKg: parsed.data.weightKg },
  });

  // 오늘 로그면 user.weightKg 도 업데이트 (현재 체중)
  const todayKey = toLocalDateKey(new Date());
  if (parsed.data.setAsCurrent && dateKey === todayKey) {
    await prisma.user.update({
      where: { id: user.id },
      data: { weightKg: parsed.data.weightKg },
    });
  }

  return NextResponse.json({ log });
}
