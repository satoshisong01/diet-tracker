'use client';
import { useEffect } from 'react';
import {
  EQUIVALENCE_ACTIVITIES,
  minutesToBurn,
  formatDuration,
} from '@/lib/exercises';

type Props = {
  foodName: string;
  calories: number;
  weightKg: number;
  onClose: () => void;
};

export default function FoodBurnModal({ foodName, calories, weightKg, onClose }: Props) {
  // ESC로 닫기 + body 스크롤 잠금 (RemainingActionsModal과 동일 패턴)
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
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-800">🔥 이만큼 소모하려면</h2>
            <p className="truncate text-[11px] text-slate-500">
              체중 {weightKg}kg 기준 · 운동별 필요 시간
            </p>
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
          {/* 칼로리 헤드라인 */}
          <div className="mb-3 rounded-xl bg-rose-50 p-4 text-rose-700">
            <p className="break-words text-xs font-medium opacity-80">{foodName}</p>
            <p className="mt-1 text-3xl font-extrabold">
              {calories.toLocaleString()}
              <span className="ml-1 text-base font-normal">kcal</span>
            </p>
          </div>

          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {EQUIVALENCE_ACTIVITIES.map((a) => {
              const min = minutesToBurn(calories, a.met, weightKg);
              return (
                <li
                  key={a.label}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="text-base">{a.emoji}</span>
                    <span>{a.label}</span>
                  </span>
                  <span className="font-semibold text-rose-600">{formatDuration(min)}</span>
                </li>
              );
            })}
          </ul>
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
