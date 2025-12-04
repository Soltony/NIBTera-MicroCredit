
import { NextRequest, NextResponse } from 'next/server';
import { decryptJwt } from '@/lib/session';
import { allMenuItems } from './lib/menu-items';
import type { Permissions } from '@/lib/types';

const protectedAdminRoutes = ['/admin'];
const publicRoutes = ['/admin/login', '/loan/connect'];

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // ✅ Edge-safe nonce using Web Crypto
  const nonce = btoa(self.crypto.randomUUID()); // base64 encode UUID

  // Build CSP header
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob: https://placehold.co https://play-lh.googleusercontent.com https://github.com;
    connect-src 'self';
    frame-ancestors 'self';
    media-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    worker-src 'self';
    manifest-src 'self';
  `.replace(/\s{2,}/g, ' ').trim();

  // Clone request headers and add nonce
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Set security headers
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // --- START PERMISSION-BASED ROUTE PROTECTION ---
  const isProtected = protectedAdminRoutes.some((prefix) => path.startsWith(prefix));

  if (isProtected && !publicRoutes.includes(path)) {
    // Read access token from cookie and decrypt locally (Edge-safe)
    const accessToken = req.cookies.get('accessToken')?.value;
    const session = accessToken ? await decryptJwt(accessToken) : null;

    // 1. If no session, redirect to login
    if (!session?.userId) {
      return NextResponse.redirect(new URL('/admin/login', req.nextUrl.origin).toString());
    }

    // 2. Parse permissions from the session token
    let permissions: Permissions = {};
    try {
        if (session?.permissions) {
            permissions = typeof session.permissions === 'string' 
                ? JSON.parse(session.permissions) 
                : session.permissions;
        }
    } catch (e) {
        console.error('Failed to parse session permissions in middleware', e);
        // If permissions are corrupt, treat as if they have none and redirect to login
        return NextResponse.redirect(new URL('/admin/login', req.nextUrl.origin).toString());
    }

    // Find the menu item that corresponds to the path being accessed.
    const currentRouteConfig = allMenuItems.find(item => path.startsWith(item.path));
    
    // If the path is a defined route in our menu system, check permissions.
      if (currentRouteConfig) {
      const moduleName = currentRouteConfig.label.toLowerCase().replace(/\s+/g, '-');
      const hasPermission = !!permissions[moduleName]?.read;

      // If the user does NOT have permission for this route, redirect to
      // a formal forbidden page that shows an Unauthorized message.
      if (!hasPermission) {
        return NextResponse.redirect(new URL('/admin/forbidden', req.nextUrl.origin).toString());
      }
    } else if (path !== '/admin') {
      // If the path is not the base '/admin' path and not found in our menu items,
      // it's an invalid route, so redirect to the base admin page.
      return NextResponse.redirect(new URL('/admin', req.nextUrl.origin).toString());
    }
  }

  return response;
}
