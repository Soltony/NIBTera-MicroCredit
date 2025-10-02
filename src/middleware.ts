
import {NextRequest, NextResponse} from 'next/server';
import {getSession} from '@/lib/session';

const protectedAdminRoutes = ['/admin'];
const publicRoutes = ['/admin/login'];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
  const userAgent = req.headers.get('user-agent') || 'N/A';
  
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
 const cspHeader = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://placehold.co https://play-lh.googleusercontent.com https://github.com;
  connect-src 'self';
  frame-ancestors 'self';
  frame-src 'self';
  child-src 'self';
  media-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  worker-src 'self';
  manifest-src 'self';
`.replace(/\s{2,}/g, ' ').trim();



  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set(
    'Content-Security-Policy',
    cspHeader
  )

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // These headers are still required for full protection.
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');


  // Do not run middleware on public admin routes like login
  if (publicRoutes.includes(path)) {
    return response;
  }

  // Check if the route is a protected admin route
  const isProtected = protectedAdminRoutes.some((prefix) => path.startsWith(prefix));

  if (isProtected) {
    const session = await getSession();
    if (!session?.userId) {
      console.log(JSON.stringify({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        reason: 'No valid session',
        path: path,
        ipAddress,
        userAgent,
      }));
      // If no session, redirect to the login page
      const loginUrl = new URL('/admin/login', req.nextUrl.origin);
      return NextResponse.redirect(loginUrl.toString());
    }
  }

  return response;
}

// Configure the matcher to run on all admin routes
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
