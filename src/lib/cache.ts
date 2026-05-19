'use client';
import { useEffect, useState, useCallback } from 'react';

// 클라이언트 라우팅 전환 사이에 유지되는 in-memory 캐시.
// 페이지 새로고침 시엔 비워짐 (의도된 동작 — 메모리 누수 방지).
const cache = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}

/** prefix로 시작하는 모든 키 무효화. prefix 없으면 전체 비움. */
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

/**
 * Stale-While-Revalidate 패턴 훅.
 * - mount 즉시 캐시된 값으로 렌더 (있다면)
 * - 동시에 백그라운드 refetch
 * - 응답 도착하면 캐시 갱신 + state 업데이트
 *
 * key가 null이면 일시 정지(예: SSR/CSR hydration 가드).
 */
export function useSWR<T>(
  key: string | null,
  fetcher: () => Promise<T>,
): {
  data: T | undefined;
  loading: boolean;
  refetch: () => Promise<T | undefined>;
  setData: (v: T) => void;
} {
  const [data, setData] = useState<T | undefined>(() =>
    key ? getCached<T>(key) : undefined,
  );
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!key) return undefined;
    setLoading(true);
    try {
      const fresh = await fetcher();
      setCached(key, fresh);
      setData(fresh);
      return fresh;
    } finally {
      setLoading(false);
    }
    // fetcher는 외부에서 자주 재생성될 수 있어서 deps에 안 넣음 (key가 같으면 같은 데이터)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!key) return;
    // 캐시 hit이면 stale 값 즉시 setState
    const cached = getCached<T>(key);
    if (cached !== undefined) setData(cached);
    // 항상 백그라운드 fetch
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((fresh) => {
        if (cancelled) return;
        setCached(key, fresh);
        setData(fresh);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const apply = useCallback((v: T) => {
    if (key) setCached(key, v);
    setData(v);
  }, [key]);

  return { data, loading, refetch, setData: apply };
}
