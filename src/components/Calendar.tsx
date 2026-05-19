'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toLocalDateKey } from '@/lib/date';
import { useSWR } from '@/lib/cache';

type DayStat = {
  date: string;
  intake: number;
  exerciseBurn: number;
  netWithBmr: number;
  netWithoutBmr: number;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type MonthSummary = { year: number; month: number; bmr: number; days: DayStat[] };

export default function Calendar() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [includeBmr, setIncludeBmr] = useState<boolean>(true);

  // 클라이언트 시간 기준으로 초기화 — SSR/CSR hydration mismatch 방지
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setMounted(true);
  }, []);

  // SWR: 캐시 hit이면 즉시 stale 값 → 백그라운드 갱신
  const summaryKey =
    mounted && year && month ? `summary:month:${year}-${month}` : null;
  const { data: summary, loading } = useSWR<MonthSummary>(summaryKey, () =>
    fetch(`/api/summary/month?year=${year}&month=${month}`).then((r) => r.json()),
  );
  const days: DayStat[] = summary?.days ?? [];
  const bmr = summary?.bmr ?? 0;

  useEffect(() => {
    if (!mounted) return;
    // /api/me 캐시 사용 → DayDetail/Dashboard에서도 공유
    import('@/lib/cache').then(({ getCached, setCached }) => {
      const cached = getCached<{ user: { includeBmr?: boolean } }>('me');
      if (cached?.user?.includeBmr !== undefined) {
        setIncludeBmr(Boolean(cached.user.includeBmr));
      }
      fetch('/api/me')
        .then((r) => r.json())
        .then((d) => {
          setCached('me', d);
          if (d.user?.includeBmr !== undefined) {
            setIncludeBmr(Boolean(d.user.includeBmr));
          }
        });
    });
  }, [mounted]);

  const cells = useMemo(() => {
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayMap = new Map(days.map((d) => [d.date, d]));
    const arr: Array<{ date: string; stat?: DayStat } | null> = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = toLocalDateKey(new Date(year, month - 1, d));
      arr.push({ date, stat: dayMap.get(date) });
    }
    return arr;
  }, [year, month, days]);

  function prev() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }
  function next() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }
  function today() {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth() + 1);
  }

  async function toggleBmr() {
    const newVal = !includeBmr;
    setIncludeBmr(newVal);
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ includeBmr: newVal }),
    });
  }

  const todayKey = mounted ? toLocalDateKey(new Date()) : '';

  if (!mounted) {
    return (
      <div className="card">
        <div className="mb-3 h-9 w-48 animate-pulse rounded bg-slate-100" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-20 rounded-md bg-slate-50/50 sm:h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={prev} aria-label="이전 달">
            ◀
          </button>
          <h2 className="text-lg font-bold text-slate-800">
            {year}년 {month}월
          </h2>
          <button className="btn-secondary" onClick={next} aria-label="다음 달">
            ▶
          </button>
          <button className="btn-secondary text-xs" onClick={today}>
            오늘
          </button>
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={includeBmr}
            onChange={toggleBmr}
          />
          기초대사량 포함 ({bmr}kcal)
        </label>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}>
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={idx} className="h-24 rounded-md bg-slate-50/50 sm:h-28" />;
          const isToday = cell.date === todayKey;
          const net = includeBmr ? cell.stat?.netWithBmr : cell.stat?.netWithoutBmr;
          const hasData = cell.stat && (cell.stat.intake > 0 || cell.stat.exerciseBurn > 0);
          return (
            <button
              key={cell.date}
              onClick={() => router.push(`/day/${cell.date}`)}
              className={`flex h-24 flex-col rounded-md border p-1 text-left transition-colors sm:h-28 ${
                isToday
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className={`text-xs font-semibold leading-tight ${isToday ? 'text-brand-700' : 'text-slate-700'}`}>
                {Number(cell.date.split('-')[2])}
              </span>
              {hasData && (
                <span
                  className={`mt-0.5 text-[10px] font-bold leading-tight ${
                    (net ?? 0) <= 0 ? 'text-emerald-600' : 'text-orange-600'
                  }`}
                >
                  {(net ?? 0) > 0 ? '+' : ''}
                  {net ?? 0}
                </span>
              )}
              {hasData ? (
                <div className="mt-auto space-y-0.5 text-[10px] font-medium leading-tight">
                  <div className="truncate text-sky-600">+{cell.stat?.intake}</div>
                  <div className="truncate text-rose-500">−{cell.stat?.exerciseBurn}</div>
                </div>
              ) : (
                <div className="mt-auto text-[10px] text-slate-300">기록 없음</div>
              )}
            </button>
          );
        })}
      </div>

      {loading && <p className="mt-2 text-center text-xs text-slate-400">불러오는 중…</p>}
      <p className="mt-3 text-[11px] text-slate-500">
        <span className="text-sky-600 font-medium">+섭취</span> ·{' '}
        <span className="text-rose-500 font-medium">−운동 소모</span>. 날짜 아래 숫자는{' '}
        <span className="font-medium">{includeBmr ? '섭취 − (운동 + 기초)' : '섭취 − 운동'}</span>{' '}
        결과. <span className="text-emerald-600 font-medium">음수 = 적자</span>,{' '}
        <span className="text-orange-600 font-medium">양수 = 잉여</span>
      </p>
    </div>
  );
}
