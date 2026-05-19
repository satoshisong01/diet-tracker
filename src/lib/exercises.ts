// 자주 하는 운동 프리셋. 클라이언트/서버 양쪽에서 import 가능 (순수 데이터).
// MET = Metabolic Equivalent of Task. 칼로리 = MET × 체중(kg) × 시간(h)

export type Intensity = 'light' | 'moderate' | 'vigorous';

export type ExercisePreset = {
  name: string;
  emoji: string;
  intensity: Intensity;
  durationMin: number;
  met: number;
  note?: string;
};

// 자주 하는 운동 칩 (DayDetail에서 사용)
export const QUICK_EXERCISES: ExercisePreset[] = [
  { name: '걷기', emoji: '🚶', intensity: 'moderate', durationMin: 30, met: 3.5 },
  { name: '빠르게 걷기', emoji: '🏃‍♂️', intensity: 'vigorous', durationMin: 30, met: 5.0 },
  { name: '조깅', emoji: '🏃', intensity: 'moderate', durationMin: 30, met: 7.0 },
  { name: '달리기', emoji: '🏃‍♀️', intensity: 'vigorous', durationMin: 30, met: 9.8 },
  { name: '12-3-30 트레드밀', emoji: '🏋️', intensity: 'vigorous', durationMin: 30, met: 8.0, note: '12% 경사 + 3mph + 30분' },
  { name: '자전거', emoji: '🚴', intensity: 'moderate', durationMin: 30, met: 6.8 },
  { name: '실내 사이클', emoji: '🚲', intensity: 'vigorous', durationMin: 30, met: 8.5 },
  { name: '수영', emoji: '🏊', intensity: 'moderate', durationMin: 30, met: 7.0 },
  { name: '등산', emoji: '🥾', intensity: 'moderate', durationMin: 60, met: 5.3 },
  { name: '헬스 (웨이트)', emoji: '💪', intensity: 'moderate', durationMin: 45, met: 5.0 },
  { name: '크로스핏', emoji: '🤸', intensity: 'vigorous', durationMin: 30, met: 8.0 },
  { name: '줄넘기', emoji: '🪢', intensity: 'vigorous', durationMin: 15, met: 11.0 },
  { name: '요가', emoji: '🧘', intensity: 'light', durationMin: 60, met: 3.0 },
  { name: '필라테스', emoji: '🤸‍♀️', intensity: 'moderate', durationMin: 60, met: 3.8 },
  { name: '배드민턴', emoji: '🏸', intensity: 'moderate', durationMin: 45, met: 5.5 },
  { name: '테니스', emoji: '🎾', intensity: 'vigorous', durationMin: 45, met: 7.3 },
  { name: '축구', emoji: '⚽', intensity: 'vigorous', durationMin: 60, met: 8.0 },
  { name: '농구', emoji: '🏀', intensity: 'vigorous', durationMin: 60, met: 7.5 },
  { name: '클라이밍', emoji: '🧗', intensity: 'vigorous', durationMin: 60, met: 8.0 },
];

// 칼로리 환산 표시용 — 섭취 칼로리를 이만큼의 운동으로 소모해야 함
export const EQUIVALENCE_ACTIVITIES: Array<{ label: string; emoji: string; met: number }> = [
  { label: '걷기 (보통)', emoji: '🚶', met: 3.5 },
  { label: '빠르게 걷기', emoji: '🏃‍♂️', met: 5.0 },
  { label: '조깅', emoji: '🏃', met: 7.0 },
  { label: '달리기 (빠르게)', emoji: '🏃‍♀️', met: 9.8 },
  { label: '자전거 (보통)', emoji: '🚴', met: 6.8 },
  { label: '수영', emoji: '🏊', met: 7.0 },
  { label: '12-3-30 트레드밀', emoji: '🏋️', met: 8.0 },
];

export function caloriesFromMet(met: number, weightKg: number, durationMin: number): number {
  return Math.round(met * weightKg * (durationMin / 60));
}

// kcal을 해당 운동에 필요한 분(min) 단위로 환산
export function minutesToBurn(kcal: number, met: number, weightKg: number): number {
  if (kcal <= 0 || met <= 0 || weightKg <= 0) return 0;
  return Math.round((kcal / (met * weightKg)) * 60);
}

export function formatDuration(min: number): string {
  if (min <= 0) return '0분';
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}
