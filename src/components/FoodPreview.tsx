'use client';
import { useRef, useState } from 'react';
import {
  EQUIVALENCE_ACTIVITIES,
  minutesToBurn,
  formatDuration,
} from '@/lib/exercises';
import { compressImage } from '@/lib/image';

type Estimate = {
  name: string;
  calories: number;
  quantity: number;
  reasoning: string;
};

// 대시보드에서 "먹기 전에 미리 확인" 용도의 위젯.
// 텍스트 또는 사진으로 음식 입력 → AI 칼로리 추정 + 운동량 환산.
export default function FoodPreview({ weightKg }: { weightKg: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkText() {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setEstimate(null);
    setImagePreview(null);
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
    setError(null);
    setEstimate(null);
    try {
      const { base64, mimeType, sizeKB } = await compressImage(file, { maxDim: 1024 });
      setImagePreview(`data:${mimeType};base64,${base64}`);
      console.log(`[image] uploaded ${sizeKB}KB`);
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
        얼마나 운동해야 소모되는지 알려줘요. (저장되지 않음)
      </p>

      <div className="flex gap-2">
        <input
          className="input"
          placeholder="예: 후라이드 1마리, 짜장면 곱빼기, 소주 1병+안주"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          type="button"
          onClick={checkText}
          disabled={busy || !query.trim()}
          className="btn-primary whitespace-nowrap"
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
        <p className="mt-1 text-[10px] text-slate-400">
          💡 위 텍스트 입력란에 힌트를 넣고 사진을 첨부하면 더 정확하게 분석돼요
        </p>
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
        <div className="mt-3 space-y-2">
          <div className="flex items-baseline justify-between rounded-lg bg-sky-50 p-3">
            <div>
              <p className="text-xs text-sky-700">{estimate.name}</p>
              <p className="text-3xl font-bold text-sky-700">
                {estimate.calories.toLocaleString()}
                <span className="ml-1 text-sm font-normal">kcal</span>
              </p>
            </div>
            <p className="max-w-[60%] text-right text-[11px] text-sky-600">
              🤖 {estimate.reasoning}
            </p>
          </div>

          <p className="text-xs font-medium text-slate-600">
            ⚖️ 이만큼을 소모하려면 (체중 {weightKg}kg 기준):
          </p>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
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
      )}
    </div>
  );
}
