import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 text-5xl">🤔</div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800">페이지를 찾을 수 없어요</h1>
      <p className="mb-6 text-sm text-slate-500">
        주소를 다시 확인해 주세요.
      </p>
      <Link href="/dashboard" className="btn-primary">
        대시보드로
      </Link>
    </main>
  );
}
