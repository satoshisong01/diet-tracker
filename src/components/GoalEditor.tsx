'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PRESETS = [
  { v: 0, label: '유지', desc: '체중 유지' },
  { v: 300, label: '-300', desc: '느린 감량 (월 ~1kg)' },
  { v: 500, label: '-500', desc: '표준 다이어트 (월 ~2kg)' },
  { v: 750, label: '-750', desc: '빠른 감량 (월 ~3kg)' },
  { v: 1000, label: '-1000', desc: '매우 빠른 감량 (월 ~4kg)' },
];

export default function GoalEditor({
  tdee,
  initialDeficit,
}: {
  tdee: number;
  initialDeficit: number;
}) {
  const router = useRouter();
  const [deficit, setDeficit] = useState(initialDeficit);
  const [custom, setCustom] = useState(String(initialDeficit));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const isPreset = PRESETS.some((p) => p.v === deficit);

  async function save(value: number) {
    setSaving(true);
    setMsg(null);
    try {
      const v = Math.max(0, Math.min(1500, Math.round(value)));
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyDeficit: v }),
      });
      if (!r.ok) throw new Error('저장 실패');
      setDeficit(v);
      setCustom(String(v));
      setMsg('저장됨 ✓');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 1500);
    }
  }

  const target = Math.max(0, tdee - deficit);

  return (
    <div className="card">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-slate-800">🎯 다이어트 목표 설정</h3>
        <p className="text-sm text-slate-600">
          오늘 목표 섭취량:{' '}
          <span className="font-bold text-brand-700">{target.toLocaleString()}kcal</span>
          <span className="ml-1 text-xs text-slate-500">
            (TDEE {tdee.toLocaleString()} − {deficit} = {target.toLocaleString()})
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.v}
            type="button"
            onClick={() => save(p.v)}
            disabled={saving}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              deficit === p.v
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'
            }`}
            title={p.desc}
          >
            <span className="font-bold">{p.label}kcal</span>
            <span className="ml-1 text-[10px] text-slate-500">· {p.desc}</span>
          </button>
        ))}

        <div className="flex items-center gap-1">
          <input
            type="number"
            className="input w-24 text-xs"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            min={0}
            max={1500}
            step={50}
            placeholder="직접 입력"
          />
          <button
            type="button"
            onClick={() => save(Number(custom))}
            disabled={saving || !custom}
            className={`btn-secondary text-xs ${!isPreset && Number(custom) === deficit ? 'ring-2 ring-brand-400' : ''}`}
          >
            적용
          </button>
        </div>

        {msg && <span className="text-xs text-emerald-600">{msg}</span>}
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        💡 1kg 체지방 ≈ 7,700kcal. 일일 500kcal 적자 시 월 약 2kg 감량.
        지나치게 큰 적자(&gt;1,000)는 근손실과 요요 위험이 있어요.
      </p>
    </div>
  );
}
