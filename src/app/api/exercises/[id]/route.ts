import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const patchSchema = z.object({
  activity: z.string().min(1).max(100).optional(),
  durationMin: z.number().int().min(1).max(1440).optional(),
  intensity: z.enum(['light', 'moderate', 'vigorous']).optional(),
  caloriesBurned: z.number().min(0).max(20000).optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.exerciseEntry.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값 오류' }, { status: 400 });
  }
  const entry = await prisma.exerciseEntry.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ entry });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.exerciseEntry.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await prisma.exerciseEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
