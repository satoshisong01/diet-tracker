'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TopNav({ userName }: { userName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const links = [
    { href: '/dashboard', label: '대시보드' },
    { href: '/mypage', label: '마이페이지' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-lg font-bold text-brand-700">
          🥗 다이어트 트래커
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                pathname.startsWith(l.href)
                  ? 'bg-brand-100 text-brand-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <span className="ml-2 text-sm text-slate-500">{userName}님</span>
          <button onClick={handleLogout} className="btn-secondary ml-2">
            로그아웃
          </button>
        </nav>

        <button
          className="md:hidden rounded-md p-2 text-slate-600 hover:bg-slate-100"
          onClick={() => setOpen((v) => !v)}
          aria-label="menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  pathname.startsWith(l.href)
                    ? 'bg-brand-100 text-brand-800'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-sm text-slate-500">{userName}님</span>
              <button onClick={handleLogout} className="btn-secondary">
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
