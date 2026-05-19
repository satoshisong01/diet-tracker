import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'fallback-dev-secret-change-this-in-production-32',
);

const PROTECTED_PREFIXES = ['/dashboard', '/day', '/mypage'];
const AUTH_PAGES = ['/login', '/signup'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('diet_session')?.value;

  let isAuth = false;
  if (token) {
    try {
      await jwtVerify(token, SECRET);
      isAuth = true;
    } catch {
      isAuth = false;
    }
  }

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !isAuth) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (AUTH_PAGES.includes(pathname) && isAuth) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/day/:path*', '/mypage/:path*', '/login', '/signup'],
};
