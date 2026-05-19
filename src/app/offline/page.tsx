export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 text-5xl">📡</div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800">오프라인입니다</h1>
      <p className="mb-6 text-sm text-slate-500">
        인터넷에 연결되어 있지 않아요. 이전에 본 페이지는 캐시에서 그대로 열리고,
        새로 입력한 음식·운동은 연결되는 즉시 자동 전송됩니다.
      </p>
      <p className="text-[11px] text-slate-400">
        💡 AI 추정/이미지 분석은 인터넷 연결이 필요해요.
      </p>
    </main>
  );
}
