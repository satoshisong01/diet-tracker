import { redirect, notFound } from 'next/navigation';
import TopNav from '@/components/TopNav';
import DayDetail from '@/components/DayDetail';
import { requireUser } from '@/lib/auth';
import { isValidDateKey } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function DayPage({ params }: { params: { date: string } }) {
  const user = await requireUser();
  if (!user) redirect('/login');
  if (!isValidDateKey(params.date)) notFound();

  const d = new Date(params.date);
  const formatted = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${
    ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  })`;

  return (
    <>
      <TopNav userName={user.name} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">{formatted}</h1>
          <p className="text-sm text-slate-500">{params.date}</p>
        </div>
        <DayDetail
          date={params.date}
          initialIncludeBmr={user.includeBmr}
          userWeightKg={user.weightKg}
          dailyDeficit={user.dailyDeficit}
        />
      </main>
    </>
  );
}
