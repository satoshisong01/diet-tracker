'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ACTIVITY_OPTIONS = [
  { v: 'sedentary', label: '거의 안 함 (사무직)' },
  { v: 'light', label: '가벼운 활동 (주 1-3회 운동)' },
  { v: 'moderate', label: '보통 활동 (주 3-5회 운동)' },
  { v: 'active', label: '많은 활동 (주 6-7회 운동)' },
  { v: 'very_active', label: '매우 많은 활동 (고강도 매일)' },
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    heightCm: 170,
    weightKg: 65,
    age: 25,
    gender: 'male' as 'male' | 'female' | 'other',
    activityLevel: 'light' as
      | 'sedentary'
      | 'light'
      | 'moderate'
      | 'active'
      | 'very_active',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          heightCm: Number(form.heightCm),
          weightKg: Number(form.weightKg),
          age: Number(form.age),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '가입 실패');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mb-2 text-4xl">🥗</div>
        <h1 className="text-2xl font-bold text-slate-800">회원가입</h1>
        <p className="text-sm text-slate-500">기초 체형 정보로 칼로리 계산을 정확히 해요.</p>
      </div>
      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <div>
          <label className="label">이름</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            required
            maxLength={50}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">이메일</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">비밀번호 (6자 이상)</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
              minLength={6}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">키 (cm)</label>
            <input
              type="number"
              className="input"
              value={form.heightCm}
              onChange={(e) => update('heightCm', Number(e.target.value))}
              required
              min={50}
              max={280}
              step="0.1"
            />
          </div>
          <div>
            <label className="label">몸무게 (kg)</label>
            <input
              type="number"
              className="input"
              value={form.weightKg}
              onChange={(e) => update('weightKg', Number(e.target.value))}
              required
              min={20}
              max={400}
              step="0.1"
            />
          </div>
          <div>
            <label className="label">나이</label>
            <input
              type="number"
              className="input"
              value={form.age}
              onChange={(e) => update('age', Number(e.target.value))}
              required
              min={5}
              max={120}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">성별</label>
            <select
              className="input"
              value={form.gender}
              onChange={(e) =>
                update('gender', e.target.value as 'male' | 'female' | 'other')
              }
            >
              <option value="male">남성</option>
              <option value="female">여성</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div>
            <label className="label">활동 수준</label>
            <select
              className="input"
              value={form.activityLevel}
              onChange={(e) =>
                update('activityLevel', e.target.value as typeof form.activityLevel)
              }
            >
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? '가입 중…' : '가입하고 시작하기'}
        </button>
        <p className="text-center text-sm text-slate-600">
          이미 계정이 있나요?{' '}
          <Link className="font-medium text-brand-700 hover:underline" href="/login">
            로그인
          </Link>
        </p>
      </form>
    </main>
  );
}
