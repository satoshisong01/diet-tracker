'use client';
import { useEffect, useState } from 'react';

// PWA beforeinstallprompt 이벤트 타입 (TS 표준 lib에 없음)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Platform = 'unknown' | 'android' | 'ios' | 'desktop';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export default function InstallButton() {
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());

    // 이미 설치된 PWA로 실행 중인지 감지
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari 전용
      window.navigator.standalone === true;
    if (isStandalone) setInstalled(true);

    function onBefore(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferred(null);
  }

  if (!mounted) {
    // SSR/CSR hydration mismatch 방지: mount 전에 빈 placeholder
    return <div className="h-[148px]" />;
  }

  if (installed) {
    return (
      <div className="card bg-emerald-50">
        <h3 className="text-base font-bold text-emerald-800">📱 앱으로 설치됨 ✓</h3>
        <p className="mt-1 text-xs text-emerald-700">
          홈 화면 아이콘으로 바로 실행할 수 있어요. 알림·오프라인 등 점진적 기능이 추가될 예정입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="mb-1 text-base font-bold text-slate-800">
        📱 홈 화면에 추가 (앱처럼 사용)
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        설치하면 브라우저 주소창 없이 독립 앱처럼 실행돼요. 데이터는 그대로 유지됩니다.
      </p>

      {deferred ? (
        <button type="button" onClick={install} className="btn-primary w-full sm:w-auto">
          📥 지금 앱으로 설치
        </button>
      ) : platform === 'ios' ? (
        <>
          <button
            type="button"
            onClick={() => setShowIosGuide((v) => !v)}
            className="btn-primary w-full sm:w-auto"
          >
            {showIosGuide ? '안내 숨기기' : '🍎 iOS Safari 설치 안내'}
          </button>
          {showIosGuide && (
            <div className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
              <p className="font-semibold">Safari에서 다음 순서로 진행하세요:</p>
              <ol className="ml-5 mt-1 list-decimal space-y-0.5 text-[13px]">
                <li>
                  하단 가운데 <span className="font-mono">⬆️ 공유</span> 버튼 탭
                </li>
                <li>
                  메뉴를 내려서 <span className="font-bold">홈 화면에 추가</span> 선택
                </li>
                <li>오른쪽 상단 추가 → 홈 화면에 "다이어트 트래커" 아이콘 생성 완료</li>
              </ol>
              <p className="mt-2 text-[11px] opacity-80">
                💡 iOS는 보안상 자동 설치가 불가능해 위 절차가 필요해요.
              </p>
            </div>
          )}
        </>
      ) : platform === 'android' ? (
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold">크롬에서 다음 순서로 진행하세요:</p>
          <ol className="ml-5 mt-1 list-decimal space-y-0.5 text-[13px]">
            <li>
              우측 상단 <span className="font-mono">⋮</span> 메뉴 탭
            </li>
            <li>
              <span className="font-bold">앱 설치</span> 또는 <span className="font-bold">홈 화면에 추가</span> 선택
            </li>
            <li>"설치" 확인 → 앱 서랍/홈에 아이콘 생성</li>
          </ol>
          <p className="mt-2 text-[11px] opacity-80">
            💡 브라우저가 자동 설치 가능해지면 위에 "지금 설치" 버튼이 나타납니다.
            인터넷 연결 상태에서 페이지를 한 번 둘러본 뒤 다시 와보세요.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold">데스크톱 Chrome / Edge에서:</p>
          <ol className="ml-5 mt-1 list-decimal space-y-0.5 text-[13px]">
            <li>
              주소창 오른쪽의 <span className="font-mono">⊕</span> 또는 <span className="font-mono">⋮</span> 메뉴
            </li>
            <li>
              <span className="font-bold">다이어트 트래커 설치</span> 클릭
            </li>
            <li>독립 앱 창으로 실행 가능</li>
          </ol>
          <p className="mt-2 text-[11px] opacity-80">
            💡 자동 설치 가능 조건이 충족되면 위에 "지금 설치" 버튼이 나타납니다.
          </p>
        </div>
      )}
    </div>
  );
}
