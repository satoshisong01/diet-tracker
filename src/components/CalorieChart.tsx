'use client';
import { useEffect, useMemo, useState } from 'react';
import { toLocalDateKey } from '@/lib/date';
import { formatWeightDelta, kcalToGrams } from '@/lib/weight';

type DayStat = {
  date: string;
  intake: number;
  exerciseBurn: number;
  netWithBmr: number;
  netWithoutBmr: number;
};

type Range = 7 | 14 | 30;

// 최근 N일 (오늘 포함) 키 목록 생성
function lastNDays(n: number): string[] {
  const arr: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    arr.push(toLocalDateKey(d));
  }
  return arr;
}

export default function CalorieChart({
  bmr,
  tdee,
  targetIntake,
}: {
  bmr: number;
  tdee: number;
  targetIntake: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<Range>(7);
  const [days, setDays] = useState<DayStat[]>([]);
  const [loading, setLoading] = useState(true);

  // 클라이언트 mount 후에만 Date 의존 로직 실행 → SSR/CSR hydration mismatch 방지
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    setLoading(true);
    // 현재달과 이전달 모두 받아와 합쳐서 최근 N일 추출
    const now = new Date();
    const y2 = now.getFullYear();
    const m2 = now.getMonth() + 1;
    const prev = new Date(y2, m2 - 2, 1);
    const y1 = prev.getFullYear();
    const m1 = prev.getMonth() + 1;
    Promise.all([
      fetch(`/api/summary/month?year=${y1}&month=${m1}`).then((r) => r.json()),
      fetch(`/api/summary/month?year=${y2}&month=${m2}`).then((r) => r.json()),
    ])
      .then(([a, b]) => {
        if (cancelled) return;
        const merged: DayStat[] = [...(a.days || []), ...(b.days || [])];
        setDays(merged);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range, mounted]);

  const series = useMemo(() => {
    if (!mounted) return [] as Array<{ date: string; intake: number; exerciseBurn: number }>;
    const map = new Map(days.map((d) => [d.date, d]));
    return lastNDays(range).map((k) => ({
      date: k,
      intake: map.get(k)?.intake ?? 0,
      exerciseBurn: map.get(k)?.exerciseBurn ?? 0,
    }));
  }, [days, range, mounted]);

  // hydration 가드: mount 전엔 스켈레톤
  if (!mounted) {
    return (
      <div className="card">
        <h3 className="mb-3 text-base font-bold text-slate-800">📈 칼로리 추이</h3>
        <div className="h-[240px] animate-pulse rounded-md bg-slate-50" />
      </div>
    );
  }

  // 차트 영역 크기 — 가로는 부모에 맞춰 SVG가 viewBox로 스케일
  const maxIntake = Math.max(targetIntake * 1.4, 2500, ...series.map((d) => d.intake));
  const maxBurn = Math.max(800, ...series.map((d) => d.exerciseBurn));
  const yMax = Math.ceil(Math.max(maxIntake, maxBurn + bmr) / 500) * 500;

  const W = 720;
  const H = 240;
  const PAD = { l: 36, r: 12, t: 16, b: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const barGroupW = innerW / series.length;
  const barW = Math.max(4, barGroupW * 0.35);

  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  function yOf(v: number): number {
    return PAD.t + innerH - (v / yMax) * innerH;
  }

  function avg(arr: number[]): number {
    if (!arr.length) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }
  const loggedDays = series.filter((d) => d.intake > 0 || d.exerciseBurn > 0);
  const avgIntake = avg(loggedDays.map((d) => d.intake));
  const avgBurn = avg(loggedDays.map((d) => d.exerciseBurn));
  const daysLogged = loggedDays.length;

  // 페이스 기반 예상 체중 변화: 평균 에너지 균형 = (TDEE + 평균운동) - 평균섭취
  // +면 적자(감량 페이스), -면 잉여(증가 페이스). 기록 없으면 예상치 숨김.
  const avgEnergyBalance = daysLogged > 0 ? tdee + avgBurn - avgIntake : 0;
  const gramsPerDay = kcalToGrams(avgEnergyBalance);
  const gramsPerWeek = gramsPerDay * 7;
  const gramsPerMonth = gramsPerDay * 30;
  const gramsPerYear = gramsPerDay * 365;

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-800">📈 칼로리 추이</h3>
        <div className="flex gap-1">
          {[7, 14, 30].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRange(n as Range)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                range === n
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {n}일
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md bg-sky-50 p-2">
          <p className="text-sky-700">평균 섭취</p>
          <p className="text-lg font-bold text-sky-700">{avgIntake.toLocaleString()}</p>
        </div>
        <div className="rounded-md bg-rose-50 p-2">
          <p className="text-rose-700">평균 운동 소모</p>
          <p className="text-lg font-bold text-rose-700">{avgBurn.toLocaleString()}</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="text-slate-700">기록 일수</p>
          <p className="text-lg font-bold text-slate-700">
            {daysLogged}/{range}일
          </p>
        </div>
      </div>

      {/* 페이스 기반 예상 체중 변화 */}
      {daysLogged > 0 && (
        <ProjectionPanel
          gramsPerDay={gramsPerDay}
          gramsPerWeek={gramsPerWeek}
          gramsPerMonth={gramsPerMonth}
          gramsPerYear={gramsPerYear}
          avgKcalBalance={avgEnergyBalance}
        />
      )}

      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: range > 14 ? 600 : 420 }}>
          {/* Y axis grid + labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={yOf(v)}
                y2={yOf(v)}
                stroke="#e2e8f0"
                strokeDasharray="2 3"
              />
              <text x={PAD.l - 4} y={yOf(v) + 3} fontSize="9" fill="#64748b" textAnchor="end">
                {Math.round(v).toLocaleString()}
              </text>
            </g>
          ))}

          {/* Target intake line */}
          {targetIntake > 0 && targetIntake < yMax && (
            <g>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={yOf(targetIntake)}
                y2={yOf(targetIntake)}
                stroke="#16a34a"
                strokeWidth={1.5}
                strokeDasharray="6 3"
              />
              <text
                x={W - PAD.r}
                y={yOf(targetIntake) - 3}
                fontSize="9"
                fill="#16a34a"
                textAnchor="end"
                fontWeight="bold"
              >
                목표 {targetIntake}
              </text>
            </g>
          )}

          {/* Bars */}
          {series.map((d, i) => {
            const groupX = PAD.l + i * barGroupW;
            const intakeX = groupX + barGroupW / 2 - barW - 1;
            const burnX = groupX + barGroupW / 2 + 1;
            const intakeH = (d.intake / yMax) * innerH;
            const burnH = (d.exerciseBurn / yMax) * innerH;
            const dayNum = Number(d.date.split('-')[2]);
            const isFirstOfMonth = dayNum === 1;
            const showLabel =
              range === 7 ? true : range === 14 ? i % 2 === 0 : i % 4 === 0 || isFirstOfMonth;
            return (
              <g key={d.date}>
                <title>
                  {d.date} · 섭취 {d.intake}kcal · 운동 {d.exerciseBurn}kcal
                </title>
                {d.intake > 0 && (
                  <rect
                    x={intakeX}
                    y={yOf(d.intake)}
                    width={barW}
                    height={intakeH}
                    fill="#0ea5e9"
                    rx={1.5}
                  />
                )}
                {d.exerciseBurn > 0 && (
                  <rect
                    x={burnX}
                    y={yOf(d.exerciseBurn)}
                    width={barW}
                    height={burnH}
                    fill="#f43f5e"
                    rx={1.5}
                  />
                )}
                {showLabel && (
                  <text
                    x={groupX + barGroupW / 2}
                    y={H - PAD.b + 12}
                    fontSize="9"
                    fill="#64748b"
                    textAnchor="middle"
                  >
                    {isFirstOfMonth ? `${Number(d.date.split('-')[1])}/${dayNum}` : dayNum}
                  </text>
                )}
              </g>
            );
          })}

          {/* X axis */}
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={H - PAD.b}
            y2={H - PAD.b}
            stroke="#cbd5e1"
          />
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-sky-500" /> 섭취
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-rose-500" /> 운동 소모
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-brand-600" /> 목표 섭취량 ({targetIntake}kcal)
        </span>
        {loading && <span className="text-slate-400">불러오는 중…</span>}
      </div>
    </div>
  );
}

function ProjectionPanel({
  gramsPerDay,
  gramsPerWeek,
  gramsPerMonth,
  gramsPerYear,
  avgKcalBalance,
}: {
  gramsPerDay: number;
  gramsPerWeek: number;
  gramsPerMonth: number;
  gramsPerYear: number;
  avgKcalBalance: number;
}) {
  const isLoss = gramsPerDay > 0;
  const isGain = gramsPerDay < 0;
  const tone = isLoss
    ? 'bg-emerald-50 border-emerald-200'
    : isGain
      ? 'bg-orange-50 border-orange-200'
      : 'bg-slate-50 border-slate-200';
  const textColor = isLoss
    ? 'text-emerald-700'
    : isGain
      ? 'text-orange-700'
      : 'text-slate-600';
  const headlineEmoji = isLoss ? '⬇️' : isGain ? '⬆️' : '➡️';
  const headlineText = isLoss
    ? '현재 페이스: 감량 추세'
    : isGain
      ? '현재 페이스: 증가 추세'
      : '현재 페이스: 유지';

  return (
    <div className={`mt-3 rounded-lg border p-3 ${tone}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
        <p className={`text-sm font-bold ${textColor}`}>
          {headlineEmoji} {headlineText}
        </p>
        <p className="text-[11px] text-slate-500">
          평균 에너지 균형 {avgKcalBalance > 0 ? '+' : ''}
          {avgKcalBalance.toLocaleString()}kcal/일
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
        <Projection label="하루" grams={gramsPerDay} />
        <Projection label="일주일" grams={gramsPerWeek} />
        <Projection label="한 달" grams={gramsPerMonth} />
        <Projection label="1년" grams={gramsPerYear} />
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        💡 1kg 체지방 ≈ 7,700kcal 환산. 단기 체중은 수분·근육 영향으로 변동성이 있어요.
        장기 추세를 더 신뢰하세요.
      </p>
    </div>
  );
}

function Projection({ label, grams }: { label: string; grams: number }) {
  const isLoss = grams > 0;
  const isGain = grams < 0;
  const color = isLoss
    ? 'text-emerald-700'
    : isGain
      ? 'text-orange-700'
      : 'text-slate-600';
  return (
    <div className="rounded-md bg-white/60 px-2 py-1.5">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`text-base font-bold ${color}`}>{formatWeightDelta(grams)}</p>
    </div>
  );
}
