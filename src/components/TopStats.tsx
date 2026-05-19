'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import RemainingActionsModal, { type RemainingKind } from './RemainingActionsModal';

type RemainingTone = 'slate' | 'emerald' | 'amber';

const STORAGE_KEY = 'diet:topstats:showDetails';

export default function TopStats({
  bmr,
  tdee,
  todayKey,
  todayIntake,
  todayFoodCount,
  remainingTdee,
  remainingDiet,
  remainingBmr,
  targetIntake,
  dailyDeficit,
  weightKg,
}: {
  bmr: number;
  tdee: number;
  todayKey: string;
  todayIntake: number;
  todayFoodCount: number;
  remainingTdee: number;
  remainingDiet: number;
  remainingBmr: number;
  targetIntake: number;
  dailyDeficit: number;
  weightKg: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [openModal, setOpenModal] = useState<RemainingKind | null>(null);

  // mount 후 localStorage 에서 토글 상태 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === '1') setShowDetails(true);
    } catch {
      // localStorage 접근 차단 환경 무시
    }
    setMounted(true);
  }, []);

  // 변경 시 localStorage에 저장 (mount 후에만)
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, showDetails ? '1' : '0');
    } catch {
      // ignore
    }
  }, [showDetails, mounted]);

  return (
    <>
      {/* 상단 액션 행 — 항상 보임 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="btn-secondary"
          aria-expanded={showDetails}
        >
          {showDetails ? '▲ 상세 수치 숨기기' : '▼ 기초대사량·일일 권장 보기'}
        </button>
        <Link href={`/day/${todayKey}`} className="btn-primary">
          오늘 기록하기 →
        </Link>
      </div>

      {/* 토글로 노출되는 3카드 (mount 후 상태 복원 전까지 깜빡임 방지) */}
      {mounted && showDetails && (
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <div className="card">
            <p className="text-xs text-slate-500">기초대사량 (BMR)</p>
            <p className="mt-1 text-2xl font-bold text-brand-700">
              {bmr.toLocaleString()} kcal
            </p>
            <p className="text-[11px] text-slate-400">
              가만히 있어도 소모되는 1일 최소 열량
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              💡 Mifflin-St Jeor: 10×kg + 6.25×cm − 5×age (성별 보정)
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">일일 권장 (TDEE)</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">
              {tdee.toLocaleString()} kcal
            </p>
            <p className="text-[11px] text-slate-400">
              활동 수준 반영. 다이어트 시 −{dailyDeficit}kcal 목표
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              💡 BMR × 활동계수 (마이페이지에서 변경 가능)
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">오늘 기록 ({todayKey})</p>
            <p className="mt-1 text-2xl font-bold text-sky-700">
              {todayIntake.toLocaleString()} kcal
            </p>
            <p className="text-[11px] text-slate-400">음식 {todayFoodCount}건 기록</p>
          </div>
        </div>
      )}

      {/* 남은 양 3카드 — 항상 보임. 클릭 시 모달 */}
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <RemainingCard
          label="유지 기준 남은 양"
          help={`TDEE ${tdee.toLocaleString()}kcal − 오늘 섭취. 0 근처면 체중 유지`}
          value={remainingTdee}
          tone="slate"
          onClick={() => setOpenModal('tdee')}
        />
        <RemainingCard
          label="다이어트 기준 남은 양"
          help={
            dailyDeficit === 0
              ? '유지 목표 (적자 0)'
              : `목표 ${targetIntake.toLocaleString()}kcal (TDEE − ${dailyDeficit}) − 오늘 섭취`
          }
          value={remainingDiet}
          tone="emerald"
          onClick={() => setOpenModal('diet')}
        />
        <RemainingCard
          label="기초대사량 기준 남은 양"
          help={`BMR ${bmr.toLocaleString()}kcal − 오늘 섭취. 음수면 BMR 이하라 위험`}
          value={remainingBmr}
          tone="amber"
          onClick={() => setOpenModal('bmr')}
        />
      </div>

      {openModal && (
        <RemainingActionsModal
          kind={openModal}
          remainingTdee={remainingTdee}
          remainingDiet={remainingDiet}
          remainingBmr={remainingBmr}
          targetIntake={targetIntake}
          dailyDeficit={dailyDeficit}
          tdee={tdee}
          bmr={bmr}
          weightKg={weightKg}
          onClose={() => setOpenModal(null)}
        />
      )}
    </>
  );
}

function RemainingCard({
  label,
  help,
  value,
  tone,
  onClick,
}: {
  label: string;
  help: string;
  value: number;
  tone: RemainingTone;
  onClick?: () => void;
}) {
  const over = value < 0;
  const colors = over
    ? 'text-red-600 bg-red-50 border-red-100 hover:bg-red-100'
    : (
        {
          slate: 'text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100',
          emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100',
          amber: 'text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100',
        } as const
      )[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left shadow-sm transition ${colors}`}
      title="클릭하면 상세 추천을 볼 수 있어요"
    >
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium opacity-80">{label}</p>
        <span className="text-[10px] opacity-60">자세히 →</span>
      </div>
      <p className="mt-1 text-2xl font-bold">
        {over ? '초과 ' : ''}
        {Math.abs(value).toLocaleString()}
        <span className="ml-1 text-sm font-normal">kcal</span>
      </p>
      <p className="text-[11px] opacity-70">{help}</p>
      {over && <p className="mt-1 text-[11px] font-semibold">⚠️ 운동으로 보충하세요</p>}
    </button>
  );
}
