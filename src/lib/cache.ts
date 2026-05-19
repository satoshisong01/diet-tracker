'use client';
import { useEffect, useState, useCallback } from 'react';

// 2계층 캐시:
//  L1) 메모리 Map — 페이지 전환 사이 즉시 hit (가장 빠름)
//  L2) localStorage — 새로고침/탭 재오픈 후에도 hit (영구)
//
// 데이터 변경 시 invalidateCache() 호출 → 양쪽 모두 비움.
// SWR 패턴이 항상 백그라운드에서 refetch하므로 stale 데이터가 보여도 곧 갱신됨.

const memCache = new Map<string, unknown>();
const LS_PREFIX = 'diet:cache:v1:';

// localStorage 사용 가능 여부 (SSR / 시크릿 모드 / 권한 차단 대비)
function lsAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const t = '__diet_ls_test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

let lsOk: boolean | null = null;
function canUseLS(): boolean {
  if (lsOk === null) lsOk = lsAvailable();
  return lsOk;
}

export function getCached<T>(key: string): T | undefined {
  // L1
  if (memCache.has(key)) return memCache.get(key) as T;
  // L2
  if (canUseLS()) {
    try {
      const raw = window.localStorage.getItem(LS_PREFIX + key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        memCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // 손상된 JSON 등 — 무시
    }
  }
  return undefined;
}

export function setCached<T>(key: string, value: T): void {
  memCache.set(key, value);
  if (!canUseLS()) return;
  try {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    // quota 초과 — 가장 오래된 디트 키 일부 정리 후 재시도
    const msg = e instanceof Error ? e.message : String(e);
    if (/quota|exceeded/i.test(msg)) {
      pruneLocalStorage(0.5); // 50% 정리
      try {
        window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      } catch {
        // 다시 실패하면 그냥 메모리만
      }
    }
  }
}

/** prefix로 시작하는 모든 키 무효화. prefix 없으면 전체 비움. */
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    memCache.clear();
    if (canUseLS()) {
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k?.startsWith(LS_PREFIX)) toRemove.push(k);
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
      } catch {
        // ignore
      }
    }
    return;
  }
  // 메모리에서 prefix로 시작하는 키 제거
  for (const k of Array.from(memCache.keys())) {
    if (k.startsWith(prefix)) memCache.delete(k);
  }
  // localStorage에서도 동일하게
  if (canUseLS()) {
    try {
      const fullPrefix = LS_PREFIX + prefix;
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith(fullPrefix)) toRemove.push(k);
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
}

// quota 초과 시 우리 키들의 일부를 LRU 비슷하게 정리.
// 실제 LRU 메타데이터는 안 두니 그냥 일정 비율을 끝부터 자름.
function pruneLocalStorage(fraction = 0.5): void {
  if (!canUseLS()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(LS_PREFIX)) keys.push(k);
    }
    const removeCount = Math.ceil(keys.length * fraction);
    keys.slice(0, removeCount).forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * Stale-While-Revalidate 훅 (영구 캐시 사용).
 * - mount 즉시 캐시된 값으로 렌더 (메모리 → localStorage 순서)
 * - 동시에 백그라운드 refetch → 캐시 갱신 + state 업데이트
 * - key가 null이면 일시 정지 (SSR hydration 가드)
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
  // 초기값: 캐시 hit이면 즉시. (lazy init → 클라이언트에서만 실행)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!key) return;
    // 새 key가 들어오면 캐시 다시 확인
    const cached = getCached<T>(key);
    if (cached !== undefined) setData(cached);
    // 백그라운드 fetch
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

  const apply = useCallback(
    (v: T) => {
      if (key) setCached(key, v);
      setData(v);
    },
    [key],
  );

  return { data, loading, refetch, setData: apply };
}
