import nextPwa from 'next-pwa';

const withPWA = nextPwa({
  dest: 'public',
  // dev 모드에선 SW 끔 (캐시 디버깅 헬게이트 방지)
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // 3-tier caching strategy
  runtimeCaching: [
    // 1) 정적 자산 (JS/CSS/이미지/폰트) — Cache First
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // 2) AI 추정/이미지 API — 캐시 안 함 (항상 네트워크, 오프라인은 실패)
    {
      urlPattern: /\/api\/(foods|exercises)\/(estimate|estimate-image)/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /\/api\/(tip|report\/weekly)/i,
      handler: 'NetworkOnly',
    },
    // 3) 일반 GET API — Network First (오프라인이면 캐시 fallback)
    {
      urlPattern: /\/api\/(me|summary|foods|exercises|weights)(\?.*)?$/i,
      method: 'GET',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 80, maxAgeSeconds: 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // 4) POST/PATCH/DELETE 쓰기 요청 — 오프라인이면 background sync queue
    //    (workbox-background-sync를 next-pwa가 자동 처리)
    {
      urlPattern: /\/api\/(foods|exercises|weights|me)/i,
      method: 'POST',
      handler: 'NetworkOnly',
      options: {
        backgroundSync: {
          name: 'diet-write-queue',
          options: { maxRetentionTime: 24 * 60 }, // 24시간
        },
      },
    },
    {
      urlPattern: /\/api\/(foods|exercises|weights|me)\/?.*/i,
      method: 'PATCH',
      handler: 'NetworkOnly',
      options: {
        backgroundSync: {
          name: 'diet-write-queue',
          options: { maxRetentionTime: 24 * 60 },
        },
      },
    },
    {
      urlPattern: /\/api\/(foods|exercises|weights)\/.*/i,
      method: 'DELETE',
      handler: 'NetworkOnly',
      options: {
        backgroundSync: {
          name: 'diet-write-queue',
          options: { maxRetentionTime: 24 * 60 },
        },
      },
    },
    // 5) 페이지 자체 — Network First (HTML)
    {
      urlPattern: /^https?.*\/(dashboard|day|mypage|login|signup|$)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 30, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default withPWA(nextConfig);
