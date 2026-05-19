import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { estimateFoodCalories } from '@/lib/ai';

const schema = z.object({ query: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '검색어 입력' }, { status: 400 });

  try {
    const estimate = await estimateFoodCalories(parsed.data.query);
    return NextResponse.json({ estimate });
  } catch (e) {
    console.error('[foods/estimate]', e);
    return NextResponse.json({ error: 'AI 추정 실패. 직접 입력하세요.' }, { status: 502 });
  }
}
