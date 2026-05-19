'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EQUIVALENCE_ACTIVITIES,
  minutesToBurn,
  formatDuration,
} from '@/lib/exercises';
import { compressImage } from '@/lib/image';
import { invalidateCache } from '@/lib/cache';
import { toLocalDateKey } from '@/lib/date';

type Estimate = {
  name: string;
  calories: number;
  quantity: number;
  reasoning: string;
};

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const MEAL_OPTIONS: Array<{ v: MealType; label: string }> = [
  { v: 'breakfast', label: '🌅 아침' },
  { v: 'lunch', label: '☀️ 점심' },
  { v: 'dinner', label: '🌙 저녁' },
  { v: 'snack', label: '🍪 간식' },
];

export default function FoodPreview({ weightKg }: { weightKg: number }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 오늘 추가 UI 상태
  const [mealType, setMealType] = useState<MealType>('snack');
  const [adding, setAdding] = useState(false);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);

  function reset(keepEstimate = false) {
    setError(null);
    if (!keepEstimate) {
      setEstimate(null);
      setImagePreview(null);
      setAddedMsg(null);
    }
  }

  async function checkText() {
    if (!query.trim()) return;
    setBusy(true);
    reset();
    try {
      const r = await fetch('/api/foods/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'AI 추정 실패');
      setEstimate(data.estimate);
    } catch (e) {
      setError(e instanceof Error ? e.message : '추정 실패');
    } finally {
      setBusy(false);
    }
  }

  async function checkImage(file: File) {
    setBusy(true);
    reset();
    try {
      const { base64, mimeType } = await compressImage(file, { maxDim: 1024 });
      setImagePreview(`data:${mimeType};base64,${base64}`);
      const r = await fetch('/api/foods/estimate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          hint: query.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'AI 이미지 분석 실패');
      setEstimate(data.estimate);
    } catch (e) {
      setError(e instanceof Error ? e.message : '추정 실패');
    } finally {
      setBusy(false);
    }
  }

  async function addToToday() {
    if (!estimate) return;
    setAdding(true);
    setAddedMsg(null);
    try {
      const today = toLocalDateKey(new Date());
      const r = await fetch('/api/foods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          name: estimate.name,
          calories: estimate.calories,
          quantity: estimate.quantity || 1,
          mealType,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || '추가 실패');
      }
      // 관련 캐시 무효화 → 대시보드/캘린더/일별 페이지에서 fresh refetch
      invalidateCache(`foods:${today}`);
      invalidateCache(`summary:day:${today}`);
      invalidateCache('summary:month:');
      const mealLabel = MEAL_OPTIONS.find((m) => m.v === mealType)?.label ?? '';
      setAddedMsg(`✓ ${mealLabel} 으로 오늘 식단에 추가됨!`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setAdding(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') checkText();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) checkImage(f);
    e.target.value = '';
  }

  return (
    <div className="card">
      <h3 className="mb-1 text-base font-bold text-slate-800">
        🔎 먹기 전 칼로리 미리 확인
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        텍스트 또는 사진으로 음식을 알려주면 AI가 칼로리를 추정하고, 당신 체중({weightKg}kg)으로
        얼마나 운동해야 소모되는지 알려줘요.
      </p>

      <div className="flex gap-2">
        <input
          className="input min-w-0"
          placeholder="예: 후라이드 1마리, 짜장면 곱빼기, 소주 1병+안주"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          type="button"
          onClick={checkText}
          disabled={busy || !query.trim()}
          className="btn-primary"
        >
          {busy ? '⏳…' : '🤖 확인'}
        </button>
      </div>

      <div className="mt-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="btn-secondary w-full text-xs"
        >
          📸 사진으로 분석하기 (카메라/갤러리)
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {imagePreview && (
        <div className="mt-3">
          <img
            src={imagePreview}
            alt="분석한 음식"
            className="max-h-48 w-full rounded-lg border border-slate-200 object-cover"
          />
        </div>
      )}

      {estimate && (
        <div className="mt-3 space-y-3">
          <div className="flex items-baseline justify-between gap-2 rounded-lg bg-sky-50 p-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-xs text-sky-700">{estimate.name}</p>
              <p className="mt-0.5 text-3xl font-bold text-sky-700">
                {estimate.calories.toLocaleString()}
                <span className="ml-1 text-sm font-normal">kcal</span>
              </p>
            </div>
            <p className="max-w-[55%] shrink-0 break-words text-right text-[11px] text-sky-600">
              🤖 {estimate.reasoning}
            </p>
          </div>

          {/* 오늘 추가하기 */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-2 text-xs font-semibold text-emerald-800">
              ➕ 이대로 오늘 식단에 추가
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input w-auto text-sm"
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                disabled={adding}
              >
                {MEAL_OPTIONS.map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addToToday}
                disabled={adding}
                className="btn-primary"
              >
                {adding ? '추가중…' : '오늘 식단에 추가'}
              </button>
              {addedMsg && (
                <p className="text-xs font-medium text-emerald-700">{addedMsg}</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600">
              ⚖️ 이만큼을 소모하려면 (체중 {weightKg}kg 기준):
            </p>
            <ul className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {EQUIVALENCE_ACTIVITIES.map((a) => {
                const min = minutesToBurn(estimate.calories, a.met, weightKg);
                return (
                  <li
                    key={a.label}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm"
                  >
                    <span className="flex items-center gap-2 text-slate-700">
                      <span>{a.emoji}</span>
                      <span>{a.label}</span>
                    </span>
                    <span className="font-semibold text-rose-600">{formatDuration(min)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
