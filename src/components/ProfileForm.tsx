'use client';
import { useMemo, useState } from 'react';
import { calcBmr, calcTdee } from '@/lib/calorie';

type Profile = {
  name: string;
  heightCm: number;
  weightKg: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  includeBmr: boolean;
  dailyDeficit: number;
};

// 폼은 사용자 입력을 그대로 string으로 보존 — controlled <input type="number">에서
// 빈 값을 0으로 강제하지 않도록 (앞에 0이 고정되는 버그 방지).
type ProfileFormState = {
  name: string;
  heightCm: string;
  weightKg: string;
  age: string;
  gender: Profile['gender'];
  activityLevel: Profile['activityLevel'];
  includeBmr: boolean;
  dailyDeficit: string;
};

const ACTIVITY_OPTIONS = [
  { v: 'sedentary', label: '거의 안 함 (사무직)' },
  { v: 'light', label: '가벼운 활동 (주 1-3회)' },
  { v: 'moderate', label: '보통 활동 (주 3-5회)' },
  { v: 'active', label: '많은 활동 (주 6-7회)' },
  { v: 'very_active', label: '매우 많음 (고강도 매일)' },
];

function toFormState(p: Profile): ProfileFormState {
  return {
    name: p.name,
    heightCm: String(p.heightCm),
    weightKg: String(p.weightKg),
    age: String(p.age),
    gender: p.gender,
    activityLevel: p.activityLevel,
    includeBmr: p.includeBmr,
    dailyDeficit: String(p.dailyDeficit),
  };
}

export default function ProfileForm({ initial }: { initial: Profile }) {
  const [form, setForm] = useState<ProfileFormState>(() => toFormState(initial));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function update<K extends keyof ProfileFormState>(key: K, val: ProfileFormState[K]) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  // 현재 저장값 (initial)의 BMR/TDEE
  const initialBmr = useMemo(
    () =>
      calcBmr({
        weightKg: initial.weightKg,
        heightCm: initial.heightCm,
        age: initial.age,
        gender: initial.gender,
      }),
    [initial],
  );
  const initialTdee = useMemo(
    () => calcTdee(initialBmr, initial.activityLevel),
    [initialBmr, initial.activityLevel],
  );
  // 폼 입력값의 BMR/TDEE (파싱 실패 시 0 → BMR도 0으로 안전)
  const previewBmr = useMemo(
    () =>
      calcBmr({
        weightKg: Number(form.weightKg) || 0,
        heightCm: Number(form.heightCm) || 0,
        age: Number(form.age) || 0,
        gender: form.gender,
      }),
    [form.weightKg, form.heightCm, form.age, form.gender],
  );
  const previewTdee = useMemo(
    () => calcTdee(previewBmr, form.activityLevel),
    [previewBmr, form.activityLevel],
  );
  const bmrDelta = previewBmr - initialBmr;
  const tdeeDelta = previewTdee - initialTdee;
  const hasChange =
    Number(form.weightKg) !== initial.weightKg ||
    Number(form.heightCm) !== initial.heightCm ||
    Number(form.age) !== initial.age ||
    form.gender !== initial.gender ||
    form.activityLevel !== initial.activityLevel;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const heightCm = Number(form.heightCm);
    const weightKg = Number(form.weightKg);
    const age = Number(form.age);
    const dailyDeficit = Number(form.dailyDeficit) || 0;
    if (!heightCm || heightCm < 50 || heightCm > 280) {
      setMsg({ kind: 'err', text: '키는 50~280cm 사이로 입력해주세요.' });
      return;
    }
    if (!weightKg || weightKg < 20 || weightKg > 400) {
      setMsg({ kind: 'err', text: '몸무게는 20~400kg 사이로 입력해주세요.' });
      return;
    }
    if (!age || age < 5 || age > 120) {
      setMsg({ kind: 'err', text: '나이는 5~120 사이로 입력해주세요.' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          heightCm,
          weightKg,
          age,
          gender: form.gender,
          activityLevel: form.activityLevel,
          includeBmr: form.includeBmr,
          dailyDeficit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');
      setMsg({ kind: 'ok', text: '저장되었습니다.' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '저장 실패' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-4">
      <div>
        <label className="label">이름</label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          required
        />
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
            min={50}
            max={280}
            step="0.1"
            required
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
            min={20}
            max={400}
            step="0.1"
            required
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
            min={5}
            max={120}
            required
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">성별</label>
          <select
            className="input"
            value={form.gender}
            onChange={(e) => update('gender', e.target.value as Profile['gender'])}
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
            onChange={(e) => update('activityLevel', e.target.value as Profile['activityLevel'])}
          >
            {ACTIVITY_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand-600"
          checked={form.includeBmr}
          onChange={(e) => update('includeBmr', e.target.checked)}
        />
        기초대사량을 운동 소모 칼로리에 기본으로 포함
      </label>

      <div>
        <label className="label">🎯 다이어트 일일 칼로리 적자 목표 (kcal)</label>
        <input
          type="number"
          inputMode="numeric"
          className="input"
          value={form.dailyDeficit}
          onChange={(e) => update('dailyDeficit', e.target.value)}
          min={0}
          max={1500}
          step={50}
        />
        <p className="mt-1 text-[11px] text-slate-500">
          0=체중 유지, 500=표준 다이어트, 1000=빠른 감량 (대시보드에서도 변경 가능)
        </p>
      </div>

      {/* 실시간 BMR/TDEE 미리보기 */}
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-bold text-brand-800">
            {hasChange ? '🔮 변경 후 미리보기' : '📊 현재 수치'}
          </p>
          {hasChange && (
            <p className="text-[11px] text-brand-700">저장하기 전 변경값 기준</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-white/70 p-2">
            <p className="text-[11px] text-slate-500">기초대사량 (BMR)</p>
            <p className="text-lg font-bold text-brand-700">
              {previewBmr.toLocaleString()} kcal
            </p>
            {hasChange && bmrDelta !== 0 && (
              <p
                className={`text-[10px] ${
                  bmrDelta > 0 ? 'text-emerald-600' : 'text-orange-600'
                }`}
              >
                {bmrDelta > 0 ? '▲' : '▼'} {Math.abs(bmrDelta).toLocaleString()} (현재{' '}
                {initialBmr.toLocaleString()})
              </p>
            )}
          </div>
          <div className="rounded-md bg-white/70 p-2">
            <p className="text-[11px] text-slate-500">일일 권장 (TDEE)</p>
            <p className="text-lg font-bold text-slate-800">
              {previewTdee.toLocaleString()} kcal
            </p>
            {hasChange && tdeeDelta !== 0 && (
              <p
                className={`text-[10px] ${
                  tdeeDelta > 0 ? 'text-emerald-600' : 'text-orange-600'
                }`}
              >
                {tdeeDelta > 0 ? '▲' : '▼'} {Math.abs(tdeeDelta).toLocaleString()} (현재{' '}
                {initialTdee.toLocaleString()})
              </p>
            )}
          </div>
        </div>
        <p className="mt-1 text-[10px] text-brand-700">
          💡 활동 수준만 한 단계 바꿔도 TDEE가 ~200~300kcal 움직여요. 다이어트 적자 목표도 함께 확인하세요.
        </p>
      </div>

      {msg && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {msg.text}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? '저장 중…' : '저장'}
      </button>
    </form>
  );
}
