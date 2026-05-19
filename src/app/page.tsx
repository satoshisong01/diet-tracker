import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect('/dashboard');

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 text-5xl">🥗</div>
      <h1 className="mb-3 text-3xl font-bold text-slate-800 md:text-4xl">
        하루 칼로리를 기록하고 다이어트를 시작하세요
      </h1>
      <p className="mb-8 max-w-xl text-slate-600">
        매일 먹은 음식과 운동을 기록해 섭취·소모·기초대사량까지 한눈에 확인할 수 있어요. AI가
        칼로리도 자동으로 계산해줍니다.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/signup" className="btn-primary">
          무료로 시작하기
        </Link>
        <Link href="/login" className="btn-secondary">
          로그인
        </Link>
      </div>
    </main>
  );
}
