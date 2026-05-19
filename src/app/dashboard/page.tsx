import { redirect } from 'next/navigation';
import TopNav from '@/components/TopNav';
import Calendar from '@/components/Calendar';
import FoodPreview from '@/components/FoodPreview';
import GoalEditor from '@/components/GoalEditor';
import CalorieChart from '@/components/CalorieChart';
import WeightPanel from '@/components/WeightPanel';
import TopStats from '@/components/TopStats';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calcBmr, calcTdee } from '@/lib/calorie';
import { parseDateKey, toLocalDateKey } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) redirect('/login');

  const bmr = calcBmr({
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    gender: user.gender,
  });
  const tdee = calcTdee(bmr, user.activityLevel);
  const todayKey = toLocalDateKey(new Date());

  // 오늘 섭취 칼로리 (서버에서 계산)
  const todayFoods = await prisma.foodEntry.findMany({
    where: { userId: user.id, date: parseDateKey(todayKey) },
    select: { calories: true, quantity: true },
  });
  const todayIntake = Math.round(
    todayFoods.reduce((s, f) => s + f.calories * f.quantity, 0),
  );

  // (avgKcalBalancePerDay는 WeightPanel이 /api/summary/pace 로 별도 fetch)
  const targetIntake = Math.max(0, tdee - user.dailyDeficit); // 사용자가 설정한 목표 섭취량
  const remainingBmr = bmr - todayIntake;
  const remainingTdee = tdee - todayIntake;
  const remainingDiet = targetIntake - todayIntake;

  return (
    <>
      <TopNav userName={user.name} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* 상단 액션 (토글 + 오늘 기록하기) + 토글 노출 3카드 + 남은 양 3카드 */}
        <TopStats
          bmr={bmr}
          tdee={tdee}
          todayKey={todayKey}
          todayIntake={todayIntake}
          todayFoodCount={todayFoods.length}
          remainingTdee={remainingTdee}
          remainingDiet={remainingDiet}
          remainingBmr={remainingBmr}
          targetIntake={targetIntake}
          dailyDeficit={user.dailyDeficit}
          weightKg={user.weightKg}
        />

        {/* 목표 설정 */}
        <div className="mb-3">
          <GoalEditor tdee={tdee} initialDeficit={user.dailyDeficit} />
        </div>

        {/* AI 미리 확인 위젯 */}
        <div className="mb-4">
          <FoodPreview weightKg={user.weightKg} />
        </div>

        {/* 추이 차트 + 페이스 기반 체중 변화 예측 */}
        <div className="mb-4">
          <CalorieChart bmr={bmr} tdee={tdee} targetIntake={targetIntake} />
        </div>

        {/* 체중 관리 (실측, 목표, 카운트다운, 비교 차트, 주간 AI 리포트) */}
        <div className="mb-4">
          <WeightPanel
            currentWeight={user.weightKg}
            targetWeight={user.targetWeightKg}
            tdee={tdee}
          />
        </div>

        {/* 캘린더 */}
        <Calendar />
      </main>
    </>
  );
}

