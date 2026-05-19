'use client';
import { useEffect, useMemo, useState } from 'react';
import { toLocalDateKey } from '@/lib/date';
import { formatWeightDelta, kcalToGrams } from '@/lib/weight';
import { getCached, setCached } from '@/lib/cache';

type WeightLog = { date: string; weightKg: number };
type WeeklyReport = {
  headline: string;
  positives: string[];
  improvements: string[];
  recommendation: string;
};

export default function WeightPanel({
  currentWeight,
  targetWeight,
  tdee,
}: {
  currentWeight: number;
  targetWeight: number | null;
  tdee: number;
}) {
  // avg energy balance — 캐시에서 즉시 → 백그라운드 갱신
  const paceCacheKey = 'summary:pace';
  const [avgKcalBalancePerDay, setAvgKcalBalancePerDay] = useState<number>(
    () => getCached<{ avgKcalBalancePerDay: number }>(paceCacheKey)?.avgKcalBalancePerDay ?? 0,
  );
  useEffect(() => {
    fetch('/api/summary/pace')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.avgKcalBalancePerDay === 'number') {
          setCached(paceCacheKey, d);
          setAvgKcalBalancePerDay(d.avgKcalBalancePerDay);
        }
      })
      .catch(() => undefined);
  }, []);
  const logsKey = 'weights:logs';
  const [logs, setLogs] = useState<WeightLog[]>(() => getCached<WeightLog[]>(logsKey) ?? []);
  const [newWeight, setNewWeight] = useState(String(currentWeight));
  const [target, setTarget] = useState(targetWeight !== null ? String(targetWeight) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);

  async function reloadLogs() {
    const r = await fetch('/api/weights?limit=90');
    const d = await r.json();
    const mapped = (d.logs || []).map((l: { date: string; weightKg: number }) => ({
      date: l.date.slice(0, 10),
      weightKg: l.weightKg,
    }));
    setCached(logsKey, mapped);
    setLogs(mapped);
  }

  useEffect(() => {
    reloadLogs();
  }, []);

  async function saveWeight() {
    const v = Number(newWeight);
    if (!v || v < 20 || v > 400) {
      setMsg('20~400kg 사이로 입력하세요');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weightKg: v }),
      });
      if (!r.ok) throw new Error('저장 실패');
      setMsg('오늘 체중 저장됨 ✓');
      await reloadLogs();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 2000);
    }
  }

  async function saveTarget() {
    setBusy(true);
    setMsg(null);
    try {
      const v = target.trim() === '' ? null : Number(target);
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetWeightKg: v }),
      });
      if (!r.ok) throw new Error('저장 실패');
      setMsg('목표 체중 저장됨 ✓');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 2000);
    }
  }

  async function loadReport() {
    setReportBusy(true);
    setReportErr(null);
    try {
      const r = await fetch('/api/report/weekly');
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '리포트 생성 실패');
      setReport(data.report);
    } catch (e) {
      setReportErr(e instanceof Error ? e.message : '리포트 생성 실패');
    } finally {
      setReportBusy(false);
    }
  }

  // 카운트다운: 목표체중까지 (현재 페이스 기준)
  const tNum = Number(target);
  const targetNum = !Number.isNaN(tNum) && tNum > 0 ? tNum : null;
  const remainingKg = targetNum !== null ? currentWeight - targetNum : null;
  const remainingGrams = remainingKg !== null ? Math.round(remainingKg * 1000) : null;
  const gramsPerDay = kcalToGrams(avgKcalBalancePerDay);

  // 페이스 부합 여부 + ETA 계산
  let etaDays: number | null = null;
  let etaText = '';
  if (remainingKg !== null && remainingGrams !== null) {
    if (remainingGrams === 0) {
      etaText = '🎯 목표 달성!';
    } else if (remainingGrams > 0 && gramsPerDay > 0) {
      etaDays = Math.ceil(remainingGrams / gramsPerDay);
      etaText = `현재 페이스로 약 ${etaDays.toLocaleString()}일 (${(etaDays / 7).toFixed(1)}주) 남음`;
    } else if (remainingGrams > 0 && gramsPerDay <= 0) {
      etaText = '⚠️ 현재 페이스로는 목표에 도달할 수 없습니다 (섭취 > 소모). 식단 조정 필요';
    } else if (remainingGrams < 0 && gramsPerDay < 0) {
      etaDays = Math.ceil(Math.abs(remainingGrams) / Math.abs(gramsPerDay));
      etaText = `📈 증량 목표: 현재 페이스로 약 ${etaDays}일 남음`;
    } else {
      etaText = '목표보다 가볍습니다. 체중 또는 목표를 점검하세요';
    }
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-base font-bold text-slate-800">⚖️ 체중 관리</h3>

      {/* 입력 행 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label text-xs">오늘 측정 체중 (kg)</label>
          <div className="flex gap-2">
            <input
              type="number"
              className="input"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              min={20}
              max={400}
              step={0.1}
            />
            <button onClick={saveWeight} disabled={busy} className="btn-primary">
              기록
            </button>
          </div>
        </div>
        <div>
          <label className="label text-xs">목표 체중 (kg, 비우면 미설정)</label>
          <div className="flex gap-2">
            <input
              type="number"
              className="input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              min={20}
              max={400}
              step={0.1}
              placeholder="예: 65"
            />
            <button onClick={saveTarget} disabled={busy} className="btn-secondary">
              저장
            </button>
          </div>
        </div>
      </div>

      {msg && <p className="text-xs text-emerald-600">{msg}</p>}

      {/* 카운트다운 */}
      {targetNum !== null && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-brand-800">
              🎯 목표 {targetNum}kg까지
            </p>
            <p className="text-2xl font-extrabold text-brand-800">
              {remainingKg! > 0 ? '−' : '+'}
              {Math.abs(remainingKg!).toFixed(2)}kg
            </p>
          </div>
          <p className="mt-1 text-xs text-brand-700">{etaText}</p>
          {etaDays !== null && (
            <p className="mt-0.5 text-[11px] text-brand-600">
              예상 달성일: {new Date(Date.now() + etaDays * 86400000).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
      )}

      {/* 실측 vs 예측 비교 차트 */}
      <WeightComparisonChart
        logs={logs}
        currentWeight={currentWeight}
        avgKcalBalancePerDay={avgKcalBalancePerDay}
      />

      {/* 주간 AI 리포트 */}
      <div>
        <button
          onClick={loadReport}
          disabled={reportBusy}
          className="btn-primary"
        >
          {reportBusy ? '🤖 분석중…' : '🤖 주간 AI 코치 리포트 받기'}
        </button>
        {reportErr && <p className="mt-2 text-xs text-red-600">{reportErr}</p>}
        {report && (
          <div className="mt-3 space-y-2 rounded-lg bg-amber-50 p-3">
            <p className="text-sm font-bold text-amber-900">📋 {report.headline}</p>
            {report.positives.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-700">✨ 잘한 점</p>
                <ul className="ml-4 list-disc text-xs text-slate-700">
                  {report.positives.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.improvements.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-orange-700">🔧 개선할 점</p>
                <ul className="ml-4 list-disc text-xs text-slate-700">
                  {report.improvements.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.recommendation && (
              <p className="rounded-md bg-white/70 p-2 text-xs text-slate-800">
                💡 <span className="font-medium">다음 주 추천:</span> {report.recommendation}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WeightComparisonChart({
  logs,
  currentWeight,
  avgKcalBalancePerDay,
}: {
  logs: WeightLog[];
  currentWeight: number;
  avgKcalBalancePerDay: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 최근 30일 예측 추세선 vs 실측 점
  const days = 30;
  const series = useMemo(() => {
    if (!mounted) {
      return [] as Array<{ date: string; predicted: number; actual: number | null }>;
    }
    const today = new Date();
    // 30일 전부터 오늘까지
    const arr: Array<{ date: string; predicted: number; actual: number | null }> = [];
    // 시작점: 30일 전의 예측 체중 = 현재체중 - (avgKcalBalancePerDay × 30일 적자/잉여 변화)
    // 즉, 과거→현재 추세선: y(t) = currentWeight - (today - t)일 × (gramsPerDay/1000)
    const gramsPerDay = kcalToGrams(avgKcalBalancePerDay);
    const kgPerDay = gramsPerDay / 1000;
    const logsByDate = new Map(logs.map((l) => [l.date, l.weightKg]));
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = toLocalDateKey(d);
      // 오늘이 i=0일, predicted at offset i = current - i*kgPerDay (과거로 갈수록 더 무거웠음)
      const predicted = currentWeight + i * kgPerDay;
      arr.push({ date: k, predicted, actual: logsByDate.get(k) ?? null });
    }
    return arr;
  }, [logs, currentWeight, avgKcalBalancePerDay, days, mounted]);

  // hydration 가드: mount 전엔 빈 placeholder
  if (!mounted || series.length === 0) {
    return (
      <div>
        <h4 className="mb-1 text-xs font-bold text-slate-700">📈 실측 체중 vs 예측 추세 (30일)</h4>
        <div className="h-[180px] rounded-md bg-slate-50" />
      </div>
    );
  }

  const allValues = [
    ...series.map((s) => s.predicted),
    ...series.map((s) => s.actual).filter((v): v is number => v !== null),
  ];
  if (allValues.length === 0) return null;
  const min = Math.min(...allValues) - 0.5;
  const max = Math.max(...allValues) + 0.5;
  const range = Math.max(0.5, max - min);

  const W = 720;
  const H = 180;
  const PAD = { l: 36, r: 12, t: 12, b: 24 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  function xOf(i: number): number {
    return PAD.l + (i / (series.length - 1)) * innerW;
  }
  function yOf(v: number): number {
    return PAD.t + innerH - ((v - min) / range) * innerH;
  }

  const predictedPath = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(s.predicted)}`)
    .join(' ');

  return (
    <div>
      <h4 className="mb-1 text-xs font-bold text-slate-700">📈 실측 체중 vs 예측 추세 (30일)</h4>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 480 }}>
          {/* Y axis */}
          {[min, (min + max) / 2, max].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yOf(v)} y2={yOf(v)} stroke="#e2e8f0" />
              <text x={PAD.l - 4} y={yOf(v) + 3} fontSize="9" fill="#64748b" textAnchor="end">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {/* Predicted line */}
          <path d={predictedPath} fill="none" stroke="#16a34a" strokeWidth={2} strokeDasharray="5 3" />
          {/* Actual points */}
          {series.map((s, i) => {
            if (s.actual === null) return null;
            return (
              <g key={s.date}>
                <title>
                  {s.date} · 실측 {s.actual}kg · 예측 {s.predicted.toFixed(2)}kg
                </title>
                <circle cx={xOf(i)} cy={yOf(s.actual)} r={4} fill="#0ea5e9" stroke="white" strokeWidth={1.5} />
              </g>
            );
          })}
          {/* X axis ticks (first, mid, last) */}
          {[0, Math.floor(series.length / 2), series.length - 1].map((i) => (
            <text
              key={i}
              x={xOf(i)}
              y={H - PAD.b + 12}
              fontSize="9"
              fill="#64748b"
              textAnchor="middle"
            >
              {series[i].date.slice(5)}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-brand-600" style={{ borderTop: '2px dashed #16a34a' }} />
          예측 추세
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
          실측 체중
        </span>
        <span className="text-slate-400">
          • 좌측이 30일 전, 우측이 오늘. 점이 추세선 아래면 예측보다 더 빠진 것.
        </span>
      </div>
    </div>
  );
}
