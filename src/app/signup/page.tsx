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

// 입력 문자열을 그대로 보존 — 사용자 입력 중 React가 0 같은 강제 문자를 끼워넣지 않도록.
type FormState = {
  email: string;
  password: string;
  name: string;
  heightCm: string;
  weightKg: string;
  age: string;
  gender: '' | 'male' | 'female' | 'other';
  activityLevel: '' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    name: '',
    heightCm: '',
    weightKg: '',
    age: '',
    gender: '',
    activityLevel: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // 클라이언트 사이드 검증 — 빈 select 차단
    if (!form.gender) {
      setError('성별을 선택해주세요.');
      return;
    }
    if (!form.activityLevel) {
      setError('활동 수준을 선택해주세요.');
      return;
    }
    const heightCm = Number(form.heightCm);
    const weightKg = Number(form.weightKg);
    const age = Number(form.age);
    if (!heightCm || heightCm < 50 || heightCm > 280) {
      setError('키는 50~280cm 사이로 입력해주세요.');
      return;
    }
    if (!weightKg || weightKg < 20 || weightKg > 400) {
      setError('몸무게는 20~400kg 사이로 입력해주세요.');
      return;
    }
    if (!age || age < 5 || age > 120) {
      setError('나이는 5~120 사이로 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          heightCm,
          weightKg,
          age,
          gender: form.gender,
          activityLevel: form.activityLevel,
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
            placeholder="홍길동"
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
              placeholder="you@example.com"
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
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">키 (cm)</label>
            <input
              type="number"
              inputMode="decimal"
              className="input"
              value={form.heightCm}
              onChange={(e) => update('heightCm', e.target.value)}
              required
              min={50}
              max={280}
              step="0.1"
              placeholder="예: 175"
            />
          </div>
          <div>
            <label className="label">몸무게 (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              className="input"
              value={form.weightKg}
              onChange={(e) => update('weightKg', e.target.value)}
              required
              min={20}
              max={400}
              step="0.1"
              placeholder="예: 70"
            />
          </div>
          <div>
            <label className="label">나이</label>
            <input
              type="number"
              inputMode="numeric"
              className="input"
              value={form.age}
              onChange={(e) => update('age', e.target.value)}
              required
              min={5}
              max={120}
              placeholder="예: 28"
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
                update('gender', e.target.value as FormState['gender'])
              }
              required
            >
              <option value="" disabled>
                선택하세요
              </option>
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
                update('activityLevel', e.target.value as FormState['activityLevel'])
              }
              required
            >
              <option value="" disabled>
                선택하세요
              </option>
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
