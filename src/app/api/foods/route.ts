import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isValidDateKey, parseDateKey } from '@/lib/date';

const createSchema = z.object({
  date: z.string().refine(isValidDateKey, 'YYYY-MM-DD 형식'),
  name: z.string().min(1).max(100),
  calories: z.number().min(0).max(20000),
  quantity: z.number().min(0.1).max(50).default(1),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).default('snack'),
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
  const entries = await prisma.foodEntry.findMany({
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
  const entry = await prisma.foodEntry.create({
    data: {
      userId: user.id,
      date,
      name: parsed.data.name,
      calories: parsed.data.calories,
      quantity: parsed.data.quantity,
      mealType: parsed.data.mealType,
      note: parsed.data.note,
    },
  });
  return NextResponse.json({ entry });
}
