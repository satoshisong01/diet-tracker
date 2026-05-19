import type { ActivityLevel, ExerciseIntensity, Gender } from '@prisma/client';

// Mifflin-St Jeor BMR formula
export function calcBmr(params: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
}): number {
  const { weightKg, heightCm, age, gender } = params;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'male') return Math.round(base + 5);
  if (gender === 'female') return Math.round(base - 161);
  return Math.round(base - 78); // gender-neutral average
}

// Total Daily Energy Expenditure (BMR * activity factor)
export function calcTdee(bmr: number, activityLevel: ActivityLevel): number {
  const factor = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  }[activityLevel];
  return Math.round(bmr * factor);
}

// MET-based exercise calorie burn estimate
// calories = MET * weight(kg) * duration(hours)
type MetRow = Record<ExerciseIntensity, number>;
const MET_TABLE: Record<string, MetRow> = {
  walking: { light: 2.8, moderate: 3.5, vigorous: 5.0 },
  running: { light: 6.0, moderate: 8.3, vigorous: 11.0 },
  cycling: { light: 4.0, moderate: 6.8, vigorous: 10.0 },
  swimming: { light: 5.0, moderate: 7.0, vigorous: 9.8 },
  weightlifting: { light: 3.0, moderate: 5.0, vigorous: 6.0 },
  yoga: { light: 2.0, moderate: 3.0, vigorous: 4.0 },
  hiking: { light: 4.0, moderate: 5.3, vigorous: 7.0 },
  dancing: { light: 3.0, moderate: 4.5, vigorous: 6.0 },
  default: { light: 2.5, moderate: 4.0, vigorous: 6.0 },
};

// Korean alias → MET key
const KO_ALIASES: Record<string, keyof typeof MET_TABLE> = {
  걷기: 'walking',
  산책: 'walking',
  달리기: 'running',
  조깅: 'running',
  러닝: 'running',
  자전거: 'cycling',
  싸이클: 'cycling',
  사이클: 'cycling',
  수영: 'swimming',
  헬스: 'weightlifting',
  근력: 'weightlifting',
  웨이트: 'weightlifting',
  요가: 'yoga',
  필라테스: 'yoga',
  등산: 'hiking',
  하이킹: 'hiking',
  댄스: 'dancing',
  춤: 'dancing',
};

export function findMet(activity: string, intensity: ExerciseIntensity): number {
  const key = activity.toLowerCase().trim();
  for (const koKey of Object.keys(KO_ALIASES)) {
    if (key.includes(koKey)) return MET_TABLE[KO_ALIASES[koKey]][intensity];
  }
  for (const k of Object.keys(MET_TABLE)) {
    if (key.includes(k)) return MET_TABLE[k][intensity];
  }
  return MET_TABLE.default[intensity];
}

export function estimateExerciseCalories(params: {
  activity: string;
  durationMin: number;
  intensity: ExerciseIntensity;
  weightKg: number;
}): number {
  const met = findMet(params.activity, params.intensity);
  const hours = params.durationMin / 60;
  return Math.round(met * params.weightKg * hours);
}
