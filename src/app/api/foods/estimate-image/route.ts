import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { estimateFoodFromImage } from '@/lib/ai';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_BASE64_BYTES = 6 * 1024 * 1024; // ~4.4MB binary

const schema = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.string().refine((m) => ALLOWED_MIMES.includes(m.toLowerCase()), 'JPEG/PNG/WebP/HEIC만 지원'),
  hint: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 본문' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '입력값 오류', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  // strip data URL prefix if present (data:image/jpeg;base64,...)
  let b64 = parsed.data.imageBase64;
  const comma = b64.indexOf(',');
  if (b64.startsWith('data:') && comma > 0) b64 = b64.slice(comma + 1);

  if (b64.length > MAX_BASE64_BYTES) {
    return NextResponse.json({ error: '이미지가 너무 큽니다 (4MB 이하)' }, { status: 413 });
  }

  try {
    const estimate = await estimateFoodFromImage(
      b64,
      parsed.data.mimeType.toLowerCase(),
      parsed.data.hint,
    );
    return NextResponse.json({ estimate });
  } catch (e) {
    console.error('[foods/estimate-image]', e);
    return NextResponse.json(
      { error: 'AI 이미지 분석 실패. 텍스트로 입력해주세요.' },
      { status: 502 },
    );
  }
}
