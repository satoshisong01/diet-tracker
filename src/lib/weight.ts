// 칼로리 ↔ 체중 환산 유틸. 클라이언트/서버 양쪽에서 사용.
//
// 표준 환산: 1kg 체지방 ≈ 7,700kcal
// 출처: NHS / Wishnofsky 1958 (널리 사용되는 단순화 공식)
// 주의: 실제 체중 변화는 수분/근육/글리코겐 영향으로 단기적으론 변동성이 크다.

export const KCAL_PER_KG_FAT = 7700;

/**
 * 칼로리 적자/잉여를 그램 단위 체중 변화로 환산.
 * @param kcalDeficit  +값이면 적자(소모 > 섭취), -값이면 잉여
 * @returns gramsLost  +값이면 감량, -값이면 증가
 */
export function kcalToGrams(kcalDeficit: number): number {
  return Math.round((kcalDeficit / KCAL_PER_KG_FAT) * 1000);
}

/**
 * 오늘의 에너지 균형 계산.
 * - 유지 수준(maintenance) = TDEE (활동 수준 기반 1일 권장)
 * - 추가 운동(exerciseBurn)은 maintenance 위로 얹는다.
 * - 균형(balance) = (maintenance + 운동) - 섭취 ... +값이면 적자(감량), -값이면 잉여
 */
export function dailyEnergyBalance(params: {
  intake: number;
  exerciseBurn: number;
  tdee: number;
}): number {
  return params.tdee + params.exerciseBurn - params.intake;
}

/** 예상 체중 변화를 사람이 읽기 좋게 포매팅 */
export function formatWeightDelta(grams: number): string {
  if (grams === 0) return '변화 없음';
  const abs = Math.abs(grams);
  const sign = grams > 0 ? '감량' : '증가';
  if (abs < 1000) return `${abs.toLocaleString()}g ${sign}`;
  // 1kg 이상은 kg 표기 (소수 1자리)
  return `${(abs / 1000).toFixed(2)}kg ${sign}`;
}

/** 차트 페이스 기반 일/주/월 예상치 묶음 */
export function projectFromAvg(avgDailyKcalDeficit: number): {
  perDay: number;
  perWeek: number;
  perMonth: number;
} {
  const perDay = kcalToGrams(avgDailyKcalDeficit);
  return {
    perDay,
    perWeek: perDay * 7,
    perMonth: perDay * 30,
  };
}
