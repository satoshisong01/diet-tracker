'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  QUICK_EXERCISES,
  EQUIVALENCE_ACTIVITIES,
  minutesToBurn,
  formatDuration,
  caloriesFromMet,
  type ExercisePreset,
  type Intensity,
} from '@/lib/exercises';
import { compressImage } from '@/lib/image';
import { formatWeightDelta } from '@/lib/weight';
import { getCached, setCached, invalidateCache } from '@/lib/cache';

type Food = {
  id: string;
  name: string;
  calories: number;
  quantity: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  note: string | null;
};

type Exercise = {
  id: string;
  activity: string;
  durationMin: number;
  intensity: Intensity;
  caloriesBurned: number;
  note: string | null;
};

type Summary = {
  date: string;
  intake: number;
  exerciseBurn: number;
  bmr: number;
  tdee: number;
  totalBurnWithBmr: number;
  netWithBmr: number;
  netWithoutBmr: number;
  energyBalance: number;
  predictedGrams: number;
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: '🌅 아침',
  lunch: '☀️ 점심',
  dinner: '🌙 저녁',
  snack: '🍪 간식',
};

const INTENSITY_LABELS: Record<Intensity, string> = {
  light: '🚶 가볍게',
  moderate: '🏃 보통',
  vigorous: '💪 고강도',
};

export default function DayDetail({
  date,
  initialIncludeBmr,
  userWeightKg,
  dailyDeficit,
}: {
  date: string;
  initialIncludeBmr: boolean;
  userWeightKg: number;
  dailyDeficit: number;
}) {
  // 캐시에서 stale 데이터 즉시 로드 → 백그라운드 갱신
  const foodsKey = `foods:${date}`;
  const exercisesKey = `exercises:${date}`;
  const summaryKey = `summary:day:${date}`;
  const [foods, setFoods] = useState<Food[]>(
    () => getCached<{ entries: Food[] }>(foodsKey)?.entries ?? [],
  );
  const [exercises, setExercises] = useState<Exercise[]>(
    () => getCached<{ entries: Exercise[] }>(exercisesKey)?.entries ?? [],
  );
  const [summary, setSummary] = useState<Summary | null>(
    () => getCached<Summary>(summaryKey) ?? null,
  );
  const [includeBmr, setIncludeBmr] = useState(initialIncludeBmr);
  const [tip, setTip] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [f, e, s] = await Promise.all([
      fetch(`/api/foods?date=${date}`).then((r) => r.json()),
      fetch(`/api/exercises?date=${date}`).then((r) => r.json()),
      fetch(`/api/summary/day?date=${date}`).then((r) => r.json()),
    ]);
    setCached(foodsKey, f);
    setCached(exercisesKey, e);
    setCached(summaryKey, s);
    setFoods(f.entries || []);
    setExercises(e.entries || []);
    setSummary(s);
    // 음식/운동 변경되면 월별 캘린더 캐시도 무효화 → 캘린더로 돌아가면 fresh fetch
    invalidateCache('summary:month:');
  }, [date, foodsKey, exercisesKey, summaryKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleBmr() {
    const v = !includeBmr;
    setIncludeBmr(v);
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ includeBmr: v }),
    });
  }

  async function loadTip() {
    setTip('생성 중…');
    const r = await fetch(`/api/tip?date=${date}`).then((r) => r.json());
    setTip(r.tip);
  }

  const net = includeBmr ? summary?.netWithBmr ?? 0 : summary?.netWithoutBmr ?? 0;
  const burn = includeBmr ? summary?.totalBurnWithBmr ?? 0 : summary?.exerciseBurn ?? 0;
  const intake = summary?.intake ?? 0;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-800">📊 오늘의 칼로리 요약</h2>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={includeBmr}
                onChange={toggleBmr}
              />
              기초대사량 포함 ({summary.bmr}kcal)
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat label="섭취" value={summary.intake} color="sky" signMode="intake" />
            <Stat
              label={includeBmr ? '소모 (운동+기초)' : '소모 (운동)'}
              value={burn}
              color="rose"
              signMode="burn"
              breakdown={
                includeBmr
                  ? `운동 −${summary.exerciseBurn.toLocaleString()} · 기초 −${summary.bmr.toLocaleString()}`
                  : `운동 −${summary.exerciseBurn.toLocaleString()}`
              }
            />
            <Stat
              label="순 칼로리 (섭취−소모)"
              value={net}
              color={net <= 0 ? 'emerald' : 'orange'}
              signMode="auto"
              hint={net <= 0 ? '칼로리 적자 ✓' : '잉여 칼로리'}
            />
            <Stat
              label={dailyDeficit === 0 ? '유지 대비' : `목표(−${dailyDeficit})까지`}
              value={net + dailyDeficit}
              color="slate"
              signMode="auto"
              hint="음수면 목표 달성"
            />
          </div>

          {/* 예상 체중 변화 박스 — 음식이 1건이라도 기록된 날만 표시 (오해 방지) */}
          {summary.intake > 0 && (
            <PredictedWeight balance={summary.energyBalance} grams={summary.predictedGrams} />
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={loadTip} className="btn-secondary text-xs">
              🤖 AI 다이어트 코치 조언 받기
            </button>
            {tip && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{tip}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <FoodSection date={date} foods={foods} onChange={reload} />
          {intake > 0 && <CalorieEquivalence intake={intake} weightKg={userWeightKg} />}
        </div>
        <ExerciseSection
          date={date}
          exercises={exercises}
          onChange={reload}
          weightKg={userWeightKg}
        />
      </div>

      <div className="text-center">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← 캘린더로 돌아가기
        </Link>
      </div>
    </div>
  );
}

function PredictedWeight({ balance, grams }: { balance: number; grams: number }) {
  // balance > 0 → 적자(감량), grams > 0 → 감량, grams < 0 → 증가
  const isLoss = grams > 0;
  const isGain = grams < 0;
  const tone = isLoss
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : isGain
      ? 'bg-orange-50 border-orange-200 text-orange-800'
      : 'bg-slate-50 border-slate-200 text-slate-700';
  const arrow = isLoss ? '⬇️' : isGain ? '⬆️' : '➡️';

  return (
    <div className={`mt-3 rounded-lg border p-3 ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium opacity-80">
          {arrow} 오늘 페이스 기준 예상 체중 변화
        </span>
        <span className="text-xl font-bold">{formatWeightDelta(grams)}</span>
      </div>
      <p className="mt-1 text-[11px] opacity-70">
        에너지 균형 {balance > 0 ? '+' : ''}
        {balance.toLocaleString()}kcal · 1kg 체지방 ≈ 7,700kcal 환산
      </p>
      <p className="mt-0.5 text-[10px] opacity-60">
        ⚠️ 단기 체중은 수분·글리코겐 영향으로 변동성이 큽니다. 장기 추세를 더 신뢰하세요.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  hint,
  signMode = 'auto',
  breakdown,
}: {
  label: string;
  value: number;
  color: 'sky' | 'rose' | 'emerald' | 'orange' | 'slate';
  hint?: string;
  // 'intake' = 항상 + (들어옴), 'burn' = 항상 − (나감), 'auto' = 값의 부호
  signMode?: 'intake' | 'burn' | 'auto';
  breakdown?: string;
}) {
  const colors = {
    sky: 'text-sky-600 bg-sky-50',
    rose: 'text-rose-600 bg-rose-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    orange: 'text-orange-600 bg-orange-50',
    slate: 'text-slate-600 bg-slate-50',
  }[color];
  const abs = Math.abs(value).toLocaleString();
  const display =
    signMode === 'intake'
      ? `+${abs}`
      : signMode === 'burn'
        ? `−${abs}`
        : value > 0
          ? `+${abs}`
          : value < 0
            ? `−${abs}`
            : abs;
  return (
    <div className={`rounded-lg p-3 ${colors}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-0.5 text-2xl font-bold">{display}</p>
      {breakdown && <p className="mt-0.5 text-[10px] opacity-75">{breakdown}</p>}
      <p className="text-[10px] opacity-75">kcal{hint ? ` · ${hint}` : ''}</p>
    </div>
  );
}

function CalorieEquivalence({ intake, weightKg }: { intake: number; weightKg: number }) {
  return (
    <div className="card">
      <h3 className="mb-2 text-sm font-bold text-slate-800">
        ⚖️ 섭취한 {intake.toLocaleString()}kcal를 소모하려면…
      </h3>
      <p className="mb-2 text-[11px] text-slate-500">
        체중 {weightKg}kg 기준 (당신 체형 반영). 운동 강도는 표준 MET 값입니다.
      </p>
      <ul className="divide-y divide-slate-100">
        {EQUIVALENCE_ACTIVITIES.map((a) => {
          const minutes = minutesToBurn(intake, a.met, weightKg);
          return (
            <li key={a.label} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="text-base">{a.emoji}</span>
                <span className="text-slate-700">{a.label}</span>
              </span>
              <span className="font-semibold text-rose-600">{formatDuration(minutes)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FoodSection({
  date,
  foods,
  onChange,
}: {
  date: string;
  foods: Food[];
  onChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [calories, setCalories] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [mealType, setMealType] = useState<Food['mealType']>('snack');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function aiEstimate() {
    if (!query.trim()) return;
    setAiBusy(true);
    setAiNote(null);
    try {
      const r = await fetch('/api/foods/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'AI 추정 실패');
      setQuery(data.estimate.name);
      setCalories(String(data.estimate.calories));
      setQuantity(String(data.estimate.quantity));
      setAiNote(data.estimate.reasoning);
    } catch (e) {
      setAiNote(e instanceof Error ? e.message : '추정 실패');
    } finally {
      setAiBusy(false);
    }
  }

  async function aiEstimateImage(file: File) {
    setAiBusy(true);
    setAiNote(null);
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
      setQuery(data.estimate.name);
      setCalories(String(data.estimate.calories));
      setQuantity(String(data.estimate.quantity));
      setAiNote(data.estimate.reasoning);
    } catch (e) {
      setAiNote(e instanceof Error ? e.message : '추정 실패');
    } finally {
      setAiBusy(false);
    }
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) aiEstimateImage(f);
    e.target.value = '';
  }

  async function add() {
    if (!query.trim() || !calories) return;
    setBusy(true);
    try {
      await fetch('/api/foods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          name: query.trim(),
          calories: Number(calories),
          quantity: Number(quantity),
          mealType,
        }),
      });
      setQuery('');
      setCalories('');
      setQuantity('1');
      setAiNote(null);
      setImagePreview(null);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/foods/${id}`, { method: 'DELETE' });
    onChange();
  }

  const totalIntake = foods.reduce((s, f) => s + f.calories * f.quantity, 0);

  return (
    <div className="card">
      <h3 className="mb-2 text-base font-bold text-slate-800">🍚 음식 (섭취 칼로리)</h3>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="예: 김치찌개 1인분, 아메리카노 톨, 후라이드 1마리+소주 1병"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            onClick={aiEstimate}
            disabled={aiBusy || !query.trim()}
            className="btn-secondary whitespace-nowrap"
            title="AI로 칼로리 자동 추정"
          >
            {aiBusy ? '🤖…' : '🤖 AI'}
          </button>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPickImage}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={aiBusy}
            className="btn-secondary w-full text-xs"
          >
            📸 사진으로 분석 (카메라/갤러리)
          </button>
        </div>
        {imagePreview && (
          <img
            src={imagePreview}
            alt="음식 사진"
            className="max-h-40 w-full rounded-lg border border-slate-200 object-cover"
          />
        )}
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            className="input"
            placeholder="칼로리"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            min={0}
          />
          <input
            type="number"
            className="input"
            placeholder="수량"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min={0.1}
            step="0.1"
          />
          <select
            className="input"
            value={mealType}
            onChange={(e) => setMealType(e.target.value as Food['mealType'])}
          >
            <option value="breakfast">아침</option>
            <option value="lunch">점심</option>
            <option value="dinner">저녁</option>
            <option value="snack">간식</option>
          </select>
        </div>
        {aiNote && (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            🤖 {aiNote}
          </p>
        )}
        <button onClick={add} disabled={busy || !query.trim() || !calories} className="btn-primary w-full">
          {busy ? '추가 중…' : '추가'}
        </button>
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {foods.length === 0 && (
          <li className="py-3 text-center text-sm text-slate-400">아직 기록이 없어요</li>
        )}
        {foods.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <p
                className="truncate text-sm font-medium text-slate-800"
                title={`${MEAL_LABELS[f.mealType]} · ${f.name}`}
              >
                {MEAL_LABELS[f.mealType]} · {f.name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {f.calories}kcal × {f.quantity} ={' '}
                <span className="font-semibold text-sky-600">
                  {Math.round(f.calories * f.quantity)}kcal
                </span>
              </p>
            </div>
            <button
              onClick={() => remove(f.id)}
              className="shrink-0 text-xs text-red-500 hover:underline"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>

      {foods.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-2 text-right text-sm">
          <span className="text-slate-500">합계: </span>
          <span className="font-bold text-sky-700">{Math.round(totalIntake).toLocaleString()}kcal</span>
        </div>
      )}
    </div>
  );
}

function ExerciseSection({
  date,
  exercises,
  onChange,
  weightKg,
}: {
  date: string;
  exercises: Exercise[];
  onChange: () => void;
  weightKg: number;
}) {
  const [activity, setActivity] = useState('');
  const [durationMin, setDurationMin] = useState('30');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [estimateNote, setEstimateNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function applyPreset(p: ExercisePreset) {
    setActivity(p.name);
    setDurationMin(String(p.durationMin));
    setIntensity(p.intensity);
    const kcal = caloriesFromMet(p.met, weightKg, p.durationMin);
    setCaloriesBurned(String(kcal));
    setEstimateNote(
      `📐 프리셋: MET ${p.met} × 체중 ${weightKg}kg × ${p.durationMin}분 = ${kcal}kcal${
        p.note ? ` · ${p.note}` : ''
      }`,
    );
  }

  async function estimate(useAi: boolean) {
    if (!activity.trim() || !durationMin) return;
    setEstimating(true);
    setEstimateNote(null);
    try {
      const r = await fetch('/api/exercises/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: activity.trim(),
          durationMin: Number(durationMin),
          intensity,
          useAi,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '추정 실패');
      setCaloriesBurned(String(data.estimate.caloriesBurned));
      setEstimateNote(
        `${data.estimate.source === 'ai' ? '🤖 AI' : '📐 MET'}: ${data.estimate.reasoning}`,
      );
    } catch (e) {
      setEstimateNote(e instanceof Error ? e.message : '추정 실패');
    } finally {
      setEstimating(false);
    }
  }

  async function add() {
    if (!activity.trim() || !durationMin) return;
    setBusy(true);
    try {
      await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          activity: activity.trim(),
          durationMin: Number(durationMin),
          intensity,
          caloriesBurned: caloriesBurned ? Number(caloriesBurned) : undefined,
        }),
      });
      setActivity('');
      setDurationMin('30');
      setIntensity('moderate');
      setCaloriesBurned('');
      setEstimateNote(null);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/exercises/${id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <div className="card">
      <h3 className="mb-2 text-base font-bold text-slate-800">🔥 운동 (소모 칼로리)</h3>

      {/* 빠른 선택 칩 */}
      <div className="mb-3">
        <p className="mb-1 text-xs font-medium text-slate-600">⚡ 자주 하는 운동 (클릭하면 자동 계산)</p>
        <div className="flex flex-wrap gap-1">
          {QUICK_EXERCISES.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 transition hover:border-brand-400 hover:bg-brand-50"
              title={p.note ?? `${p.durationMin}분, MET ${p.met}`}
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <label className="label text-xs">운동 종류</label>
          <input
            className="input"
            placeholder="직접 입력: 자전거, 12-3-30 트레드밀, 등산…"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">⏱️ 운동 시간 (분)</label>
            <input
              type="number"
              className="input"
              placeholder="30"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              min={1}
            />
          </div>
          <div>
            <label className="label text-xs">💪 운동 강도</label>
            <select
              className="input"
              value={intensity}
              onChange={(e) => setIntensity(e.target.value as Intensity)}
            >
              <option value="light">가볍게 (light)</option>
              <option value="moderate">보통 (moderate)</option>
              <option value="vigorous">고강도 (vigorous)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => estimate(false)}
            disabled={estimating || !activity.trim()}
            className="btn-secondary text-xs"
          >
            📐 공식 계산
          </button>
          <button
            type="button"
            onClick={() => estimate(true)}
            disabled={estimating || !activity.trim()}
            className="btn-secondary text-xs"
          >
            🤖 AI 추정
          </button>
        </div>
        <div>
          <label className="label text-xs">🔥 소모 칼로리 (자동 입력 또는 직접 수정)</label>
          <input
            type="number"
            className="input"
            placeholder="kcal"
            value={caloriesBurned}
            onChange={(e) => setCaloriesBurned(e.target.value)}
            min={0}
          />
        </div>
        {estimateNote && (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            {estimateNote}
          </p>
        )}
        <button onClick={add} disabled={busy || !activity.trim() || !durationMin} className="btn-primary w-full">
          {busy ? '추가 중…' : '추가'}
        </button>
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {exercises.length === 0 && (
          <li className="py-3 text-center text-sm text-slate-400">아직 기록이 없어요</li>
        )}
        {exercises.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <p
                className="truncate text-sm font-medium text-slate-800"
                title={`${INTENSITY_LABELS[e.intensity]} · ${e.activity}`}
              >
                {INTENSITY_LABELS[e.intensity]} · {e.activity}
              </p>
              <p className="truncate text-xs text-slate-500">
                {e.durationMin}분 ·{' '}
                <span className="font-semibold text-rose-600">{e.caloriesBurned}kcal 소모</span>
              </p>
            </div>
            <button
              onClick={() => remove(e.id)}
              className="shrink-0 text-xs text-red-500 hover:underline"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
