
import {NextRequest, NextResponse} from 'next/server';
import {getSession} from '@/lib/session';

const protectedRoutes = ['/admin'];
const publicRoutes = ['/admin/login'];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((prefix) =>
    path.startsWith(prefix)
  );

  // Allow login page access
  if (path === '/admin/login') {
    return NextResponse.next();
  }

  if (isProtectedRoute) {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.redirect(new URL('/admin/login', req.nextUrl));
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/admin/:path*'],
};
