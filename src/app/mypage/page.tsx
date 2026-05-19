import { redirect } from 'next/navigation';
import TopNav from '@/components/TopNav';
import ProfileForm from '@/components/ProfileForm';
import InstallButton from '@/components/InstallButton';
import { requireUser } from '@/lib/auth';
import { calcBmr, calcTdee } from '@/lib/calorie';

export const dynamic = 'force-dynamic';

export default async function MyPage() {
  const user = await requireUser();
  if (!user) redirect('/login');

  const bmr = calcBmr({
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    gender: user.gender,
  });
  const tdee = calcTdee(bmr, user.activityLevel);
  const bmi = +(user.weightKg / Math.pow(user.heightCm / 100, 2)).toFixed(1);
  let bmiCat = '정상';
  if (bmi < 18.5) bmiCat = '저체중';
  else if (bmi >= 25) bmiCat = '과체중';
  else if (bmi >= 30) bmiCat = '비만';

  return (
    <>
      <TopNav userName={user.name} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 text-xl font-bold text-slate-800 md:text-2xl">마이페이지</h1>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="card">
            <p className="text-xs text-slate-500">BMI</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{bmi}</p>
            <p className="text-[11px] text-slate-500">{bmiCat}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">기초대사량 (BMR)</p>
            <p className="mt-1 text-2xl font-bold text-brand-700">{bmr.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500">kcal/일</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">일일 권장 (TDEE)</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{tdee.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500">kcal/일</p>
          </div>
        </div>

        <p className="mb-2 text-sm text-slate-600">계정: {user.email}</p>
        <ProfileForm
          initial={{
            name: user.name,
            heightCm: user.heightCm,
            weightKg: user.weightKg,
            age: user.age,
            gender: user.gender,
            activityLevel: user.activityLevel,
            includeBmr: user.includeBmr,
            dailyDeficit: user.dailyDeficit,
          }}
        />

        {/* PWA 설치 (잘 안 들어오는 곳에 배치) */}
        <div className="mt-4">
          <InstallButton />
        </div>
      </main>
    </>
  );
}
