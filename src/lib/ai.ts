import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_AI_API_KEY;

// Resolved 2026-05 from https://ai.google.dev/gemini-api/docs/models
// Primary: gemini-3-flash-preview (frontier-class, low cost)
// Fallbacks (in order) if preview fails / model retired.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const FALLBACK_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash'];

function buildModel(name: string) {
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: name,
    generationConfig: { responseMimeType: 'application/json' },
  });
}

// Try primary model first; on 404 / NOT_FOUND fall back through the chain.
// Other errors bubble up unchanged.
async function generate(prompt: string): Promise<string> {
  const candidates = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastErr: unknown;
  for (const name of candidates) {
    try {
      const model = buildModel(name);
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isModelGone = /404|not found|no longer available|NOT_FOUND/i.test(msg);
      if (!isModelGone) throw e;
      // else: try next fallback
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All Gemini models failed');
}

// Multimodal variant — text prompt + image (base64 + mimeType)
async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string,
): Promise<string> {
  const candidates = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastErr: unknown;
  const parts = [
    { text: prompt },
    { inlineData: { data: imageBase64, mimeType } },
  ];
  for (const name of candidates) {
    try {
      const model = buildModel(name);
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isModelGone = /404|not found|no longer available|NOT_FOUND/i.test(msg);
      if (!isModelGone) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All Gemini Vision models failed');
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const arrStart = trimmed.indexOf('[');
  let from = start;
  if (arrStart >= 0 && (start < 0 || arrStart < start)) from = arrStart;
  if (from < 0) throw new Error('No JSON object found in AI response');
  const lastObj = trimmed.lastIndexOf('}');
  const lastArr = trimmed.lastIndexOf(']');
  const to = Math.max(lastObj, lastArr);
  const slice = trimmed.slice(from, to + 1);
  return JSON.parse(slice);
}

export type FoodEstimate = {
  name: string;
  calories: number;
  quantity: number;
  reasoning: string;
};

export async function estimateFoodCalories(query: string): Promise<FoodEstimate> {
  const prompt = `당신은 한국 음식 영양 분석 AI입니다. 사용자가 먹은 음식 설명을 받아 칼로리를 추정하세요.

사용자 입력: "${query}"

다음 JSON 형식으로만 응답하세요. 다른 텍스트 금지:
{
  "name": "음식의 표준화된 한국어 이름 (입력에 여러 음식이 있으면 콤마로 묶음)",
  "calories": 추정 총 칼로리(숫자, kcal, 전체 합계),
  "quantity": 1 (전체 합산이므로 항상 1),
  "reasoning": "산정 근거(한국어, 음식별 칼로리 합산 과정 1-3문장)"
}

규칙:
- calories는 양수 정수
- 입력에 "1마리", "300g", "1병", "1인분" 같은 명시적 수량이 있으면 정확히 반영
- 여러 음식이 콤마/공백/'와'로 연결되면 각각 계산 후 합산
- 한국 음식 기준 (예: 후라이드 치킨 1마리 ≈ 2000~2400kcal, 소주 1병 360ml ≈ 340kcal)
- 음료/주류 포함`;

  const text = await generate(prompt);
  const parsed = extractJson(text) as Record<string, unknown>;
  return {
    name: String(parsed.name ?? query),
    calories: Math.max(0, Math.round(Number(parsed.calories ?? 0))),
    quantity: Math.max(0.1, Number(parsed.quantity ?? 1)),
    reasoning: String(parsed.reasoning ?? ''),
  };
}

export async function estimateFoodFromImage(
  imageBase64: string,
  mimeType: string,
  hint?: string,
): Promise<FoodEstimate> {
  const prompt = `당신은 한국 음식 영양 분석 AI입니다. 첨부된 음식 사진을 분석해 칼로리를 추정하세요.

${hint ? `사용자 힌트: "${hint}"\n` : ''}
다음 JSON 형식으로만 응답하세요. 다른 텍스트 금지:
{
  "name": "사진 속 음식들의 표준화된 한국어 이름 (여러 개면 콤마로 묶음)",
  "calories": 추정 총 칼로리(숫자, kcal, 사진에 보이는 양 전체 합계),
  "quantity": 1,
  "reasoning": "사진에서 식별한 음식과 추정 근거 (한국어, 2-3문장)"
}

규칙:
- 사진 속 모든 음식을 식별하고 각 양을 추정 후 합산
- 그릇/접시 크기를 참고해 양을 가늠
- 칼로리는 양수 정수
- 음식이 보이지 않으면 calories=0, name="음식이 인식되지 않음"으로 응답
- 한국 음식 기준 표준 칼로리 사용`;

  const text = await generateWithImage(prompt, imageBase64, mimeType);
  const parsed = extractJson(text) as Record<string, unknown>;
  return {
    name: String(parsed.name ?? '인식 실패'),
    calories: Math.max(0, Math.round(Number(parsed.calories ?? 0))),
    quantity: Math.max(0.1, Number(parsed.quantity ?? 1)),
    reasoning: String(parsed.reasoning ?? ''),
  };
}

export type ExerciseEstimate = {
  activity: string;
  caloriesBurned: number;
  reasoning: string;
};

export async function estimateExerciseCaloriesAi(params: {
  activity: string;
  durationMin: number;
  intensity: 'light' | 'moderate' | 'vigorous';
  weightKg: number;
}): Promise<ExerciseEstimate> {
  const prompt = `당신은 운동 칼로리 분석 AI입니다. 사용자의 운동 정보를 받아 소모 칼로리를 추정하세요.

운동: "${params.activity}"
지속시간: ${params.durationMin}분
강도: ${params.intensity}
사용자 체중: ${params.weightKg}kg

다음 JSON 형식으로만 응답하세요:
{
  "activity": "표준화된 한국어 운동명",
  "caloriesBurned": 추정 소모 칼로리(숫자, kcal),
  "reasoning": "MET 값 기반 간단 산정 근거 (한국어, 1문장)"
}

규칙:
- caloriesBurned는 양수 정수
- MET 공식: 칼로리 = MET × 체중(kg) × 시간(h)
- light=낮은 강도, moderate=중간, vigorous=고강도`;

  const text = await generate(prompt);
  const parsed = extractJson(text) as Record<string, unknown>;
  return {
    activity: String(parsed.activity ?? params.activity),
    caloriesBurned: Math.max(0, Math.round(Number(parsed.caloriesBurned ?? 0))),
    reasoning: String(parsed.reasoning ?? ''),
  };
}

export type WeeklyReport = {
  headline: string;
  positives: string[];
  improvements: string[];
  recommendation: string;
};

export async function generateWeeklyReport(params: {
  weightKg: number;
  heightCm: number;
  age: number;
  tdee: number;
  dailyDeficit: number;
  targetWeightKg: number | null;
  weekDays: Array<{
    date: string;
    intake: number;
    exerciseBurn: number;
  }>;
  actualWeights: Array<{ date: string; weightKg: number }>;
}): Promise<WeeklyReport> {
  const targetIntake = Math.max(0, params.tdee - params.dailyDeficit);
  const intakes = params.weekDays.map((d) => d.intake).filter((v) => v > 0);
  const burns = params.weekDays.map((d) => d.exerciseBurn);
  const avgIntake =
    intakes.length > 0 ? Math.round(intakes.reduce((a, b) => a + b, 0) / intakes.length) : 0;
  const avgBurn = Math.round(burns.reduce((a, b) => a + b, 0) / Math.max(1, burns.length));
  const daysLogged = intakes.length;

  const weightTrend =
    params.actualWeights.length >= 2
      ? `실측 체중: ${params.actualWeights[0].date} ${params.actualWeights[0].weightKg}kg → ${
          params.actualWeights[params.actualWeights.length - 1].date
        } ${params.actualWeights[params.actualWeights.length - 1].weightKg}kg`
      : '실측 체중 기록 부족';

  const prompt = `당신은 친절하면서도 솔직한 다이어트 코치입니다. 사용자의 지난 주(최근 7일) 데이터를 보고 주간 리포트를 작성하세요.

[사용자 정보]
- 키 ${params.heightCm}cm, 체중 ${params.weightKg}kg, 나이 ${params.age}세
- TDEE ${params.tdee}kcal, 목표 일일 적자 ${params.dailyDeficit}kcal (목표 섭취 ${targetIntake}kcal)
- 목표 체중: ${params.targetWeightKg ?? '미설정'}kg

[지난 7일]
- 기록 일수: ${daysLogged}/7일
- 평균 섭취: ${avgIntake}kcal/일
- 평균 운동 소모: ${avgBurn}kcal/일
- ${weightTrend}

[일별 데이터]
${params.weekDays.map((d) => `${d.date}: 섭취 ${d.intake}, 운동 ${d.exerciseBurn}`).join('\n')}

다음 JSON 형식으로만 응답하세요. 다른 텍스트 금지:
{
  "headline": "한 줄 요약 (한국어, 칭찬/경고/응원 중 톤 선택)",
  "positives": ["잘한 점 1", "잘한 점 2"],
  "improvements": ["개선점 1", "개선점 2"],
  "recommendation": "다음 주 실행 가능한 1-2개 액션 제안 (구체적인 kcal·운동·시간 포함)"
}

규칙:
- positives와 improvements 각각 2-3개씩
- 한국어, 친근한 반말이 아닌 존댓말 사용
- 데이터가 부족하면 솔직히 지적 (예: "기록 일수가 적어 분석 정확도가 낮습니다")`;

  const text = await generate(prompt);
  const parsed = extractJson(text) as Record<string, unknown>;
  return {
    headline: String(parsed.headline ?? '한 주를 분석했습니다.'),
    positives: Array.isArray(parsed.positives)
      ? (parsed.positives as unknown[]).map(String)
      : [],
    improvements: Array.isArray(parsed.improvements)
      ? (parsed.improvements as unknown[]).map(String)
      : [],
    recommendation: String(parsed.recommendation ?? ''),
  };
}

export type DietTip = { tip: string };

export async function generateDietTip(params: {
  weightKg: number;
  heightCm: number;
  age: number;
  netCalories: number;
  goalCalories: number;
}): Promise<DietTip> {
  const prompt = `당신은 친절한 다이어트 코치입니다. 사용자의 오늘 데이터를 보고 간단한 조언 1개를 한국어로 제공하세요.

체중: ${params.weightKg}kg, 키: ${params.heightCm}cm, 나이: ${params.age}세
오늘 순 칼로리: ${params.netCalories}kcal (목표: ${params.goalCalories}kcal)

다음 JSON 형식으로만 응답:
{ "tip": "2-3문장 조언" }`;

  const text = await generate(prompt);
  const parsed = extractJson(text) as Record<string, unknown>;
  return { tip: String(parsed.tip ?? '오늘도 건강한 식단을 유지하세요!') };
}
