'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const REMEMBER_KEY = 'diet:login:remembered_email';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // mount 시 저장된 이메일 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      // 시크릿/저장 차단 환경 무시
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '로그인 실패');
      // 로그인 성공 시점에 기억 옵션 처리
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        // ignore
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4">
      <div>
        <label className="label">이메일</label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div>
        <label className="label">비밀번호</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand-600"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        이메일 기억하기
      </label>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? '로그인 중…' : '로그인'}
      </button>
      <p className="text-center text-sm text-slate-600">
        계정이 없으신가요?{' '}
        <Link className="font-medium text-brand-700 hover:underline" href="/signup">
          회원가입
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mb-2 text-4xl">🥗</div>
        <h1 className="text-2xl font-bold text-slate-800">로그인</h1>
      </div>
      <Suspense fallback={<div className="card text-center text-sm text-slate-500">로딩…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
