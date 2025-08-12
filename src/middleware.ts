
import {NextRequest, NextResponse} from 'next/server';
import {getSession} from '@/lib/session';

const protectedAdminRoutes = ['/admin'];
const publicRoutes = ['/admin/login'];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Do not run middleware on public admin routes like login
  if (publicRoutes.includes(path)) {
    return NextResponse.next();
  }

  // Check if the route is a protected admin route
  const isProtected = protectedAdminRoutes.some((prefix) => path.startsWith(prefix));

  if (isProtected) {
    const session = await getSession();
    if (!session?.userId) {
      // If no session, redirect to the login page
      return NextResponse.redirect(new URL('/admin/login', req.nextUrl));
    }
  }

  return NextResponse.next();
}

// Configure the matcher to run on all admin routes
export const config = {
  matcher: ['/admin/:path*'],
  runtime: 'nodejs',
};
