'use client';
import { useEffect } from 'react';
import {
  EQUIVALENCE_ACTIVITIES,
  minutesToBurn,
  formatDuration,
} from '@/lib/exercises';

export type RemainingKind = 'tdee' | 'diet' | 'bmr';

type Props = {
  kind: RemainingKind;
  remainingTdee: number;
  remainingDiet: number;
  remainingBmr: number;
  targetIntake: number;
  dailyDeficit: number;
  tdee: number;
  bmr: number;
  weightKg: number;
  onClose: () => void;
};

const KIND_META: Record<RemainingKind, { title: string; emoji: string; basis: string }> = {
  tdee: {
    title: '유지 기준 남은 양',
    emoji: '⚖️',
    basis: 'TDEE (활동 수준 반영 1일 권장)',
  },
  diet: {
    title: '다이어트 기준 남은 양',
    emoji: '🎯',
    basis: '목표 섭취량 (TDEE − 다이어트 적자)',
  },
  bmr: {
    title: '기초대사량 기준 남은 양',
    emoji: '🛌',
    basis: 'BMR (가만히 있어도 소모되는 최소량)',
  },
};

export default function RemainingActionsModal({
  kind,
  remainingTdee,
  remainingDiet,
  remainingBmr,
  targetIntake,
  dailyDeficit,
  tdee,
  bmr,
  weightKg,
  onClose,
}: Props) {
  const value = kind === 'tdee' ? remainingTdee : kind === 'diet' ? remainingDiet : remainingBmr;
  const meta = KIND_META[kind];
  const over = value < 0;
  const baseLabel =
    kind === 'tdee'
      ? `${tdee.toLocaleString()}kcal`
      : kind === 'diet'
        ? `${targetIntake.toLocaleString()}kcal (TDEE − ${dailyDeficit})`
        : `${bmr.toLocaleString()}kcal`;

  // ESC로 닫기 + body 스크롤 잠금
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {meta.emoji} {meta.title}
            </h2>
            <p className="text-[11px] text-slate-500">기준: {meta.basis}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {/* 현 상태 헤드라인 */}
          <div
            className={`mb-3 rounded-xl p-4 ${
              over
                ? 'bg-red-50 text-red-700'
                : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            <p className="text-xs font-medium opacity-80">
              {over ? '기준 초과한 양' : '아직 섭취 가능한 양'}
            </p>
            <p className="mt-1 text-3xl font-extrabold">
              {Math.abs(value).toLocaleString()}
              <span className="ml-1 text-base font-normal">kcal</span>
            </p>
            <p className="mt-1 text-xs opacity-70">기준: {baseLabel}</p>
          </div>

          {over ? (
            // 초과: 운동으로 소모하기
            <>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                🔥 이만큼 소모하려면 (체중 {weightKg}kg 기준)
              </p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {EQUIVALENCE_ACTIVITIES.map((a) => {
                  const min = minutesToBurn(Math.abs(value), a.met, weightKg);
                  return (
                    <li
                      key={a.label}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2 text-slate-700">
                        <span className="text-base">{a.emoji}</span>
                        <span>{a.label}</span>
                      </span>
                      <span className="font-semibold text-rose-600">
                        {formatDuration(min)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {kind === 'bmr' && (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  ⚠️ BMR 이하 섭취는 장기적으로 근손실·대사 저하 위험이 있어요.
                  운동으로 소모해도 식단을 BMR 이상으로 유지하는 게 안전합니다.
                </p>
              )}
            </>
          ) : (
            // 남음: 추천 식단/간식 양
            <>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                🍽️ 이만큼 더 먹어도 OK — 예시
              </p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {suggestFoodsByCalories(value).map((f) => (
                  <li
                    key={f.name}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="text-slate-700">
                      {f.emoji} {f.name}
                    </span>
                    <span className="font-semibold text-sky-600">{f.kcal}kcal</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-slate-500">
                💡 추천은 단순 칼로리 매칭이에요. 단백질·식이섬유 우선 채우는 게 다이어트엔
                더 효과적입니다.
              </p>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-slate-100 p-3 text-right">
          <button type="button" onClick={onClose} className="btn-secondary">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// 남은 칼로리에 맞는 음식 예시 (간단한 룩업)
function suggestFoodsByCalories(kcal: number): Array<{
  name: string;
  emoji: string;
  kcal: number;
}> {
  const pool = [
    { name: '바나나 1개', emoji: '🍌', kcal: 95 },
    { name: '아메리카노 톨', emoji: '☕', kcal: 10 },
    { name: '삶은 계란 1개', emoji: '🥚', kcal: 75 },
    { name: '플레인 요거트 1컵', emoji: '🥛', kcal: 130 },
    { name: '닭가슴살 100g', emoji: '🍗', kcal: 165 },
    { name: '현미밥 1공기', emoji: '🍚', kcal: 320 },
    { name: '사과 1개', emoji: '🍎', kcal: 95 },
    { name: '아보카도 1/2개', emoji: '🥑', kcal: 160 },
    { name: '두유 1팩 (190ml)', emoji: '🥤', kcal: 90 },
    { name: '아몬드 한 줌 (28g)', emoji: '🌰', kcal: 170 },
    { name: '연어 100g', emoji: '🐟', kcal: 210 },
    { name: '브로콜리 1컵', emoji: '🥦', kcal: 55 },
    { name: '고구마 1개 (중간)', emoji: '🍠', kcal: 130 },
    { name: '소고기 등심 100g', emoji: '🥩', kcal: 250 },
    { name: '치즈 1장', emoji: '🧀', kcal: 70 },
  ];
  // kcal 가까운 것 3개 + 큰 것 2개 섞어 5개 제안
  const sorted = [...pool].sort(
    (a, b) => Math.abs(a.kcal - kcal) - Math.abs(b.kcal - kcal),
  );
  const near = sorted.slice(0, 3);
  const filled = pool.filter((p) => p.kcal <= kcal).sort((a, b) => b.kcal - a.kcal).slice(0, 2);
  const result: typeof pool = [];
  for (const p of [...near, ...filled]) {
    if (!result.find((r) => r.name === p.name)) result.push(p);
    if (result.length >= 5) break;
  }
  return result;
}
